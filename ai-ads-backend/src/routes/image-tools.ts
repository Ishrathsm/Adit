import { Router } from "express";
import multer from "multer";
import { isAspectRatio, VALID_ASPECT_RATIOS } from "../lib/aspect-ratio";
import { IMAGE_TOOLS, type ImageTool, NEEDS_INSTRUCTION, runImageTool } from "../lib/image-tools";
import { createJob, updateJobStatus } from "../lib/jobs";
import { createProject } from "../lib/projects";
import { uploadPoster } from "../lib/storage";
import { type AuthedRequest, checkFeature } from "../middleware/auth";

export const imageToolsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const TOOL_NAMES: Record<ImageTool, string> = {
  upscale: "Upscale",
  background: "New background",
  expand: "Expand",
  restyle: "Restyle",
  relight: "Relight",
  remove: "Remove object",
};

// POST /api/image-tools (multipart): image, tool, instruction?, aspectRatio? (expand), size? (upscale).
// Runs the edit and saves the result as a finished poster project, so it shows up in Projects.
imageToolsRouter.post("/", upload.single("image"), async (req: AuthedRequest, res) => {
  if (!checkFeature(req, res, "image_tools", "Image tools")) return;
  const tool = req.body?.tool as ImageTool;
  const instruction = typeof req.body?.instruction === "string" ? req.body.instruction.trim().slice(0, 300) || null : null;
  const aspectRatio = req.body?.aspectRatio;
  const size = req.body?.size === "4K" ? "4K" : "2K";

  if (!req.file) {
    res.status(400).json({ error: "image is required" });
    return;
  }
  if (!IMAGE_TOOLS.includes(tool)) {
    res.status(400).json({ error: `tool must be one of ${IMAGE_TOOLS.join(", ")}` });
    return;
  }
  if (NEEDS_INSTRUCTION[tool] && !instruction) {
    res.status(400).json({ error: "Describe what you want for this tool" });
    return;
  }
  if (tool === "expand" && !isAspectRatio(aspectRatio)) {
    res.status(400).json({ error: `aspectRatio must be one of ${VALID_ASPECT_RATIOS.join(", ")}` });
    return;
  }

  try {
    const result = await runImageTool({ tool, image: req.file.buffer, instruction, aspectRatio, size });
    const name = `${TOOL_NAMES[tool]}${instruction ? `: ${instruction}` : ""}`.slice(0, 80);
    const productId = typeof req.body?.productId === "string" && req.body.productId ? req.body.productId : null;
    const project = await createProject(req.userId!, name, "poster", productId);
    const job = await createJob(project.id, name, { outputType: "poster", aspectRatio: result.aspectRatio });
    const outputUrl = await uploadPoster(job.id, Buffer.from(result.imageBytes, "base64"));
    await updateJobStatus(job.id, { status: "completed", output_url: outputUrl });
    res.status(201).json({ projectId: project.id, outputUrl });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
