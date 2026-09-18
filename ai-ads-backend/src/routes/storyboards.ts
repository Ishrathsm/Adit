import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { getProject } from "../lib/projects";
import { generateShotDescriptions } from "../lib/text-gen";
import {
  createShots,
  createStoryboard,
  getStoryboard,
  listShots,
  selectShotChoice,
  updateStoryboardStatus,
} from "../lib/storyboards";
import { enqueueShotChoices, enqueueShotVideo, enqueueStoryboardStitch } from "../lib/queue";

export const storyboardsRouter = Router();

const SHOT_COUNT = 4;
const SHOT_DURATION_SECONDS = 5;

storyboardsRouter.post("/", async (req: AuthedRequest, res) => {
  const { projectId, concept } = req.body ?? {};

  if (typeof projectId !== "string" || typeof concept !== "string" || !concept.trim()) {
    res.status(400).json({ error: "projectId and concept are required" });
    return;
  }

  try {
    const project = await getProject(req.userId!, projectId);
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }

    const storyboard = await createStoryboard(projectId, concept.trim(), SHOT_COUNT, SHOT_DURATION_SECONDS);
    const descriptions = await generateShotDescriptions(concept.trim(), SHOT_COUNT);
    const shots = await createShots(storyboard.id, descriptions);

    await Promise.all(shots.map((shot) => enqueueShotChoices(shot.id)));

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

  if (typeof selectedChoice !== "number" || selectedChoice < 0 || selectedChoice > 2) {
    res.status(400).json({ error: "selectedChoice must be 0, 1, or 2" });
    return;
  }

  try {
    const storyboard = await getStoryboard(req.userId!, req.params.id);
    if (!storyboard) {
      res.status(404).json({ error: "storyboard not found" });
      return;
    }
    const shot = await selectShotChoice(req.params.shotId, selectedChoice);
    res.json({ shot });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

storyboardsRouter.post("/:id/generate", async (req: AuthedRequest, res) => {
  try {
    const storyboard = await getStoryboard(req.userId!, req.params.id);
    if (!storyboard) {
      res.status(404).json({ error: "storyboard not found" });
      return;
    }

    const shots = await listShots(storyboard.id);
    const unselected = shots.filter((shot) => shot.selected_choice === null);
    if (unselected.length > 0) {
      res.status(400).json({ error: "every shot needs a selected choice before generating the final video" });
      return;
    }

    await updateStoryboardStatus(storyboard.id, { status: "generating_video" });

    // Only (re-)generate shots that don't already have a video — re-picking a single shot
    // clears just that shot's video_url, so untouched shots stay cached per the product plan.
    const pending = shots.filter((shot) => !shot.video_url);
    if (pending.length === 0) {
      await enqueueStoryboardStitch(storyboard.id);
    } else {
      await Promise.all(pending.map((shot) => enqueueShotVideo(shot.id)));
    }

    res.status(202).json({ storyboard });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
