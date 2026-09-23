import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { enqueueGenerationJob } from "../lib/queue";
import { createJob, getJob, type ReferenceImageRole } from "../lib/jobs";
import { getProject } from "../lib/projects";
import { getTemplateById } from "../lib/templates";

export const jobsRouter = Router();

const VALID_ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"];
// Veo rejects anything outside this pair (e.g. "Invalid aspect ratio: 1:1") — unlike image
// generation, which supports the wider VALID_ASPECT_RATIOS set above.
const VIDEO_ASPECT_RATIOS = ["9:16", "16:9"];
const REFERENCE_IMAGE_ROLES: ReferenceImageRole[] = ["subject", "style"];
// Veo 3.1's hard cap is 8 seconds per single generation (longer requires separate
// video-extension calls, not implemented here) — these three are the same durations
// already proven against Veo by the storyboard flow.
const VIDEO_DURATIONS = [4, 6, 8];

jobsRouter.post("/", async (req: AuthedRequest, res) => {
  const { projectId, prompt, aspectRatio, durationSeconds, tagline, templateId, referenceImageUrl, referenceImageRole } =
    req.body ?? {};

  if (typeof projectId !== "string" || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "projectId and prompt are required" });
    return;
  }
  if (aspectRatio !== undefined && !VALID_ASPECT_RATIOS.includes(aspectRatio)) {
    res.status(400).json({ error: `aspectRatio must be one of ${VALID_ASPECT_RATIOS.join(", ")}` });
    return;
  }
  if (durationSeconds !== undefined && !VIDEO_DURATIONS.includes(durationSeconds)) {
    res.status(400).json({ error: `durationSeconds must be one of ${VIDEO_DURATIONS.join(", ")}` });
    return;
  }
  if (templateId !== undefined && typeof templateId !== "string") {
    res.status(400).json({ error: "templateId must be a string" });
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

    const outputType = project.type === "poster" ? "poster" : "video";

    if (outputType === "video" && aspectRatio !== undefined && !VIDEO_ASPECT_RATIOS.includes(aspectRatio)) {
      res.status(400).json({ error: `aspectRatio for video must be one of ${VIDEO_ASPECT_RATIOS.join(", ")}` });
      return;
    }

    if (templateId) {
      const template = await getTemplateById(templateId);
      if (!template) {
        res.status(404).json({ error: "template not found" });
        return;
      }
      if (template.type !== outputType) {
        res.status(400).json({ error: `template is for ${template.type} projects, not ${outputType}` });
        return;
      }
    }

    const job = await createJob(projectId, prompt.trim(), {
      outputType,
      // The jobs table's aspect_ratio default ('1:1') is poster-oriented and Veo rejects it —
      // video jobs need an explicit video-safe fallback when the caller doesn't specify one.
      aspectRatio:
        typeof aspectRatio === "string" ? aspectRatio : outputType === "video" ? "16:9" : undefined,
      durationSeconds: outputType === "video" && typeof durationSeconds === "number" ? durationSeconds : undefined,
      tagline: typeof tagline === "string" && tagline.trim() ? tagline.trim() : undefined,
      templateId: typeof templateId === "string" ? templateId : undefined,
      referenceImageUrl: referenceImageUrl || null,
      referenceImageRole: referenceImageUrl ? referenceImageRole : null,
    });
    await enqueueGenerationJob(job.id);
    res.status(201).json({ job });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

jobsRouter.get("/:id", async (req: AuthedRequest, res) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    // Jobs aren't directly user-scoped — verify via the owning project instead.
    const project = await getProject(req.userId!, job.project_id);
    if (!project) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.json({ job });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
