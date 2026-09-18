import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { enqueueGenerationJob } from "../lib/queue";
import { createJob, getJob } from "../lib/jobs";
import { getProject } from "../lib/projects";
import { getTemplateById } from "../lib/templates";

export const jobsRouter = Router();

const VALID_ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"];

jobsRouter.post("/", async (req: AuthedRequest, res) => {
  const { projectId, prompt, aspectRatio, tagline, templateId } = req.body ?? {};

  if (typeof projectId !== "string" || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "projectId and prompt are required" });
    return;
  }
  if (aspectRatio !== undefined && !VALID_ASPECT_RATIOS.includes(aspectRatio)) {
    res.status(400).json({ error: `aspectRatio must be one of ${VALID_ASPECT_RATIOS.join(", ")}` });
    return;
  }
  if (templateId !== undefined && typeof templateId !== "string") {
    res.status(400).json({ error: "templateId must be a string" });
    return;
  }

  try {
    const project = await getProject(req.userId!, projectId);
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }

    const outputType = project.type === "poster" ? "poster" : "video";

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
      aspectRatio: typeof aspectRatio === "string" ? aspectRatio : undefined,
      tagline: typeof tagline === "string" && tagline.trim() ? tagline.trim() : undefined,
      templateId: typeof templateId === "string" ? templateId : undefined,
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
