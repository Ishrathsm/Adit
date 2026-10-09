import { Router } from "express";
import multer from "multer";
import { type AuthedRequest, checkFeature } from "../middleware/auth";
import { getProject } from "../lib/projects";
import { generateAdScript } from "../lib/text-gen";
import { type CreativeBrief, fitShotCuts, footageSeconds, parseCreativeBrief, planShots } from "../lib/creative-brief";
import { getProductById, toBrandContext } from "../lib/products";
import { uploadReferenceImage } from "../lib/storage";
import { getTemplateById } from "../lib/templates";
import {
  type AssetKind,
  createAssets,
  createShots,
  createStoryboard,
  getAsset,
  getLatestStoryboardForProject,
  getStoryboard,
  listAssets,
  listShots,
  selectShotChoice,
  SHOT_CHOICE_COUNT,
  type ReferenceImageRole,
  updateAsset,
  updateStoryboardStatus,
} from "../lib/storyboards";
import { enqueueCharacterReference, enqueueShotChoices, enqueueShotVideo } from "../lib/queue";

export const storyboardsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Narrower than image generation's supported set — each shot's aspect ratio feeds both the
// image-choice step AND Veo's image-to-video step, and Veo rejects anything outside these two
// (e.g. "Invalid aspect ratio: 1:1").
const ASPECT_RATIOS = ["9:16", "16:9"];
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
  const { projectId, concept, aspectRatio, brief: rawBrief, referenceImageUrl, referenceImageRole, assets: rawAssets, characterSheet, templateId } =
    req.body ?? {};

  if (typeof projectId !== "string" || typeof concept !== "string" || !concept.trim()) {
    res.status(400).json({ error: "projectId and concept are required" });
    return;
  }
  if (typeof aspectRatio !== "string" || !ASPECT_RATIOS.includes(aspectRatio)) {
    res.status(400).json({ error: `aspectRatio must be one of ${ASPECT_RATIOS.join(", ")}` });
    return;
  }
  let brief: CreativeBrief;
  try {
    brief = parseCreativeBrief(rawBrief);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  }
  // Shot count and per-shot clip length follow from the brief's length + pacing.
  const plan = planShots(brief);
  if (referenceImageUrl !== undefined && typeof referenceImageUrl !== "string") {
    res.status(400).json({ error: "referenceImageUrl must be a string" });
    return;
  }
  if (referenceImageUrl && !REFERENCE_IMAGE_ROLES.includes(referenceImageRole)) {
    res.status(400).json({ error: `referenceImageRole must be one of ${REFERENCE_IMAGE_ROLES.join(", ")}` });
    return;
  }
  let assets: UploadedAsset[];
  try {
    assets = parseAssets(rawAssets);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    return;
  }
  const wantsCharacterSheet = characterSheet === true;
  if (templateId !== undefined && templateId !== null && typeof templateId !== "string") {
    res.status(400).json({ error: "templateId must be a string" });
    return;
  }

  // Access control: each part of the brief maps to a feature switch (plan defaults + admin overrides).
  if (!checkFeature(req, res, brief.format === "single" ? "video_quick" : "video_ad", brief.format === "single" ? "Quick video" : "Full video ads")) return;
  if (brief.format === "ad" && footageSeconds(brief) > 20 && !checkFeature(req, res, "long_ads", "Ads over 20 seconds")) return;
  if (brief.voiceover && !checkFeature(req, res, "voiceover", "Voiceover")) return;
  if (assets.length && !checkFeature(req, res, "reference_assets", "Reference assets")) return;
  if (wantsCharacterSheet && !checkFeature(req, res, "character_sheet", "Character sheet")) return;

  try {
    const project = await getProject(req.userId!, projectId);
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }

    const template = templateId ? await getTemplateById(templateId) : null;
    if (templateId && template?.type !== "video") {
      res.status(400).json({ error: "templateId must be a video template" });
      return;
    }

    const product = project.product_id ? await getProductById(project.product_id) : null;
    const script = await generateAdScript(concept.trim(), brief, plan, {
      template: template?.template_prompt,
      brand: toBrandContext(product),
      assets: assets.map((a) => ({ kind: a.kind, name: a.name, description: a.description })),
      characterSheet: wantsCharacterSheet,
    });
    const casting = script.characters.length > 0;
    const storyboard = await createStoryboard(projectId, concept.trim(), plan.shotCount, plan.clipSeconds, {
      aspectRatio,
      referenceImageUrl: referenceImageUrl || null,
      referenceImageRole: referenceImageUrl ? referenceImageRole : null,
      lookSheet: script.lookSheet,
      creativeBrief: {
        ...brief,
        audio: {
          musicPrompt: script.musicPrompt,
          voiceoverScript: script.voiceoverScript,
          voiceoverDirection: script.voiceoverDirection,
          // The client's own narration is read as one piece; the director's is placed per shot.
          voiceoverLines: brief.voiceoverScript ? undefined : script.shots.map((s) => s.spec.voLine),
        },
        exclusions: script.look.exclusions,
        endCardTagline: script.endCardTagline,
        soundDesign: { ambience: script.soundAmbience, cues: script.shots.map((s) => s.spec.sfx) },
        transitions: brief.look === "stopmotion" || brief.look === "puppet" || brief.look === "folkpuppet" ? script.shots.map((s) => s.spec.transition ?? null) : undefined,
        shotCuts: brief.variableShots ? fitShotCuts(script.shots.map((s) => s.spec.seconds), footageSeconds(brief)) : undefined,
      },
      status: casting ? "casting" : "drafting",
    });
    const shots = await createShots(
      storyboard.id,
      script.shots.map((s) => ({ ...s, screenUrl: s.spec.screen !== null ? brief.screens[s.spec.screen]?.url ?? null : null })),
    );
    const createdAssets = await createAssets(storyboard.id, [
      ...assets.map((a) => ({ ...a, source: "uploaded" as const })),
      ...script.characters.map((c) => ({ kind: "character" as const, name: c.name, description: c.description, imageUrl: null, source: "generated" as const })),
    ]);

    if (casting) {
      // Character sheet first: generate each character's reference, then wait for the user to
      // approve the cast (POST /:id/start) before any shot is generated.
      for (const asset of createdAssets.filter((a) => a.status === "pending")) await enqueueCharacterReference(asset.id);
    } else {
      // Only kick off the first shot — the worker auto-picks its keyframe, then starts its video
      // and the next shot's choices, so shots are generated one after another rather than
      // bursting the image API into its rate limit. PATCH below lets the user override a pick.
      await enqueueShotChoices(shots[0].id);
    }

    res.status(201).json({ storyboard, shots, assets: createdAssets });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Latest storyboard for a project (?projectId=...), or null — used to resume a video project.
storyboardsRouter.get("/", async (req: AuthedRequest, res) => {
  const projectId = req.query.projectId;
  if (typeof projectId !== "string") {
    res.status(400).json({ error: "projectId is required" });
    return;
  }
  try {
    const storyboard = await getLatestStoryboardForProject(req.userId!, projectId);
    if (!storyboard) {
      res.json({ storyboard: null, shots: [], assets: [] });
      return;
    }
    const [shots, assets] = await Promise.all([listShots(storyboard.id), listAssets(storyboard.id)]);
    res.json({ storyboard, shots, assets });
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
    const [shots, assets] = await Promise.all([listShots(storyboard.id), listAssets(storyboard.id)]);
    res.json({ storyboard, shots, assets });
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

// Approve the character sheet and start generating shots.
storyboardsRouter.post("/:id/start", async (req: AuthedRequest, res) => {
  try {
    const storyboard = await getStoryboard(req.userId!, req.params.id);
    if (!storyboard) {
      res.status(404).json({ error: "storyboard not found" });
      return;
    }
    if (storyboard.status !== "casting") {
      res.status(409).json({ error: "storyboard is not waiting for cast approval" });
      return;
    }
    const assets = await listAssets(storyboard.id);
    if (assets.some((a) => a.status !== "ready")) {
      res.status(409).json({ error: "every character reference must be ready before starting" });
      return;
    }
    await updateStoryboardStatus(storyboard.id, { status: "drafting" });
    const shots = await listShots(storyboard.id);
    await enqueueShotChoices(shots[0].id);
    res.json({ storyboard: { ...storyboard, status: "drafting" } });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Regenerate one generated character reference while the cast is still being reviewed.
storyboardsRouter.post("/:id/assets/:assetId/regenerate", async (req: AuthedRequest, res) => {
  try {
    const storyboard = await getStoryboard(req.userId!, req.params.id);
    if (!storyboard) {
      res.status(404).json({ error: "storyboard not found" });
      return;
    }
    const asset = await getAsset(req.params.assetId);
    if (!asset || asset.storyboard_id !== storyboard.id || asset.source !== "generated") {
      res.status(404).json({ error: "generated asset not found" });
      return;
    }
    if (storyboard.status !== "casting") {
      res.status(409).json({ error: "the cast can only be changed before shots start" });
      return;
    }
    await updateAsset(asset.id, { status: "pending", error: null });
    await enqueueCharacterReference(asset.id);
    res.json({ asset: { ...asset, status: "pending" } });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

interface UploadedAsset {
  kind: AssetKind;
  name: string;
  description: string | null;
  imageUrl: string;
}

const ASSET_KINDS: AssetKind[] = ["character", "product", "location"];
const MAX_ASSETS = 6;

function parseAssets(raw: unknown): UploadedAsset[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new Error("assets must be a list");
  if (raw.length > MAX_ASSETS) throw new Error(`at most ${MAX_ASSETS} assets`);
  const assets = raw.map((a, i) => {
    const { kind, name, description, imageUrl } = (a ?? {}) as Record<string, unknown>;
    if (!ASSET_KINDS.includes(kind as AssetKind)) throw new Error(`assets[${i}].kind must be one of ${ASSET_KINDS.join(", ")}`);
    if (typeof name !== "string" || !name.trim() || name.trim().length > 60) throw new Error(`assets[${i}].name is required (max 60 characters)`);
    if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) throw new Error(`assets[${i}].imageUrl must be an uploaded image URL`);
    if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 300)) {
      throw new Error(`assets[${i}].description must be text (max 300 characters)`);
    }
    return { kind: kind as AssetKind, name: name.trim(), description: (description as string | undefined)?.trim() || null, imageUrl };
  });
  if (new Set(assets.map((a) => a.name.toLowerCase())).size !== assets.length) throw new Error("asset names must be unique");
  return assets;
}
