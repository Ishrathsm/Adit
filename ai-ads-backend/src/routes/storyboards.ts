import { Router } from "express";
import multer from "multer";
import type { AuthedRequest } from "../middleware/auth";
import { getProject } from "../lib/projects";
import { generateShotDescriptions } from "../lib/text-gen";
import { uploadReferenceImage } from "../lib/storage";
import {
  createShots,
  createStoryboard,
  getStoryboard,
  listShots,
  selectShotChoice,
  SHOT_CHOICE_COUNT,
  type ReferenceImageRole,
} from "../lib/storyboards";
import { enqueueShotChoices, enqueueShotVideo } from "../lib/queue";

export const storyboardsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Narrower than image generation's supported set — each shot's aspect ratio feeds both the
// image-choice step AND Veo's image-to-video step, and Veo rejects anything outside these two
// (e.g. "Invalid aspect ratio: 1:1").
const ASPECT_RATIOS = ["9:16", "16:9"];
const MIN_SHOT_COUNT = 2;
const MAX_SHOT_COUNT = 4;
// Veo's image-to-video feature only supports these — anything else gets rejected outright.
const SHOT_DURATIONS = [4, 6, 8];
const REFERENCE_IMAGE_ROLES: ReferenceImageRole[] = ["subject", "style"];

storyboardsRouter.post("/reference-image", upload.single("image"), async (req: AuthedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "image file is required" });
    return;
  }

  try {
    const extension = req.file.originalname.split(".").pop() || "png";
    const referenceImageUrl = await uploadReferenceImage(req.userId!, req.file.buffer, req.file.mimetype, extension);
    res.json({ referenceImageUrl });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

storyboardsRouter.post("/", async (req: AuthedRequest, res) => {
  const { projectId, concept, aspectRatio, shotCount, shotDurationSeconds, referenceImageUrl, referenceImageRole } =
    req.body ?? {};

  if (typeof projectId !== "string" || typeof concept !== "string" || !concept.trim()) {
    res.status(400).json({ error: "projectId and concept are required" });
    return;
  }
  if (typeof aspectRatio !== "string" || !ASPECT_RATIOS.includes(aspectRatio)) {
    res.status(400).json({ error: `aspectRatio must be one of ${ASPECT_RATIOS.join(", ")}` });
    return;
  }
  if (typeof shotCount !== "number" || shotCount < MIN_SHOT_COUNT || shotCount > MAX_SHOT_COUNT) {
    res.status(400).json({ error: `shotCount must be between ${MIN_SHOT_COUNT} and ${MAX_SHOT_COUNT}` });
    return;
  }
  if (typeof shotDurationSeconds !== "number" || !SHOT_DURATIONS.includes(shotDurationSeconds)) {
    res.status(400).json({ error: `shotDurationSeconds must be one of ${SHOT_DURATIONS.join(", ")}` });
    return;
  }
  if (referenceImageUrl !== undefined && typeof referenceImageUrl !== "string") {
    res.status(400).json({ error: "referenceImageUrl must be a string" });
    return;
  }
  if (referenceImageUrl && !REFERENCE_IMAGE_ROLES.includes(referenceImageRole)) {
    res.status(400).json({ error: `referenceImageRole must be one of ${REFERENCE_IMAGE_ROLES.join(", ")}` });
    return;
  }

  try {
    const project = await getProject(req.userId!, projectId);
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }

    const storyboard = await createStoryboard(projectId, concept.trim(), shotCount, shotDurationSeconds, {
      aspectRatio,
      referenceImageUrl: referenceImageUrl || null,
      referenceImageRole: referenceImageUrl ? referenceImageRole : null,
    });
    const descriptions = await generateShotDescriptions(concept.trim(), shotCount);
    const shots = await createShots(storyboard.id, descriptions);

    // Only kick off the first shot — each next shot's choices are enqueued once its
    // predecessor gets a selection (see PATCH below), so we don't burst the image API
    // and hit its rate limit generating all shots' choices at once.
    await enqueueShotChoices(shots[0].id);

    res.status(201).json({ storyboard, shots });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

storyboardsRouter.get("/:id", async (req: AuthedRequest, res) => {
  try {
    const storyboard = await getStoryboard(req.userId!, req.params.id);
    if (!storyboard) {
      res.status(404).json({ error: "storyboard not found" });
      return;
    }
    const shots = await listShots(storyboard.id);
    res.json({ storyboard, shots });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

storyboardsRouter.patch("/:id/shots/:shotId", async (req: AuthedRequest, res) => {
  const { selectedChoice } = req.body ?? {};

  if (typeof selectedChoice !== "number" || selectedChoice < 0 || selectedChoice >= SHOT_CHOICE_COUNT) {
    res.status(400).json({ error: `selectedChoice must be between 0 and ${SHOT_CHOICE_COUNT - 1}` });
    return;
  }

  try {
    const storyboard = await getStoryboard(req.userId!, req.params.id);
    if (!storyboard) {
      res.status(404).json({ error: "storyboard not found" });
      return;
    }
    const shot = await selectShotChoice(req.params.shotId, selectedChoice);

    // Picking a choice (first time or re-picking) immediately kicks off this shot's video —
    // no separate "generate final video" step. `processShotVideo` auto-enqueues the stitch
    // once every shot has a video, so the whole storyboard finishes itself from here.
    await enqueueShotVideo(shot.id);

    // Kick off the next shot's choices now that this one is picked, if it hasn't started yet.
    const shots = await listShots(storyboard.id);
    const next = shots.find((s) => s.shot_index === shot.shot_index + 1);
    if (next && next.status === "pending" && !next.choice_urls) {
      await enqueueShotChoices(next.id);
    }

    res.json({ shot });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
