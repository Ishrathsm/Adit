import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { isAspectRatio, VALID_ASPECT_RATIOS } from "../lib/aspect-ratio";
import { createTemplate, listTemplates, type TemplateType } from "../lib/templates";

export const templatesRouter = Router();

const VALID_TYPES: TemplateType[] = ["poster", "video"];

templatesRouter.get("/", async (req: AuthedRequest, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  if (type && !VALID_TYPES.includes(type as TemplateType)) {
    res.status(400).json({ error: `type must be one of ${VALID_TYPES.join(", ")}` });
    return;
  }

  try {
    const templates = await listTemplates(type as TemplateType | undefined);
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Hand-authored templates are added by whoever curates the library — no admin UI yet, so
// this endpoint exists for that manual curation step (e.g. via a one-off script or request).
templatesRouter.post("/", async (req: AuthedRequest, res) => {
  const { type, name, description, thumbnailUrl, templatePrompt, aspectRatio } = req.body ?? {};

  if (!VALID_TYPES.includes(type)) {
    res.status(400).json({ error: `type must be one of ${VALID_TYPES.join(", ")}` });
    return;
  }
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (typeof templatePrompt !== "string" || !templatePrompt.trim()) {
    res.status(400).json({ error: "templatePrompt is required" });
    return;
  }
  // No default: the ratio must reflect this specific template's own image, not a guess.
  if (!isAspectRatio(aspectRatio)) {
    res.status(400).json({ error: `aspectRatio is required and must be one of ${VALID_ASPECT_RATIOS.join(", ")}` });
    return;
  }

  try {
    const template = await createTemplate({
      type,
      name: name.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      thumbnailUrl: typeof thumbnailUrl === "string" && thumbnailUrl.trim() ? thumbnailUrl.trim() : null,
      templatePrompt: templatePrompt.trim(),
      aspectRatio,
    });
    res.status(201).json({ template });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
