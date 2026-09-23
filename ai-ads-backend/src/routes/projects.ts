import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth";
import {
  createProject,
  deleteProject,
  getProject,
  getProjectPreviews,
  listProjects,
  updateProject,
} from "../lib/projects";
import { getLatestJobForProject } from "../lib/jobs";
import { getAccount } from "../lib/accounts";
import { getOrCreateDefaultProduct } from "../lib/products";

export const projectsRouter = Router();

projectsRouter.get("/", async (req: AuthedRequest, res) => {
  const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
  const folderId = typeof req.query.folderId === "string" ? req.query.folderId : undefined;

  try {
    const projects = await listProjects(req.userId!, { productId, folderId });
    const previews = await getProjectPreviews(projects.map((p) => p.id));
    const withPreviews = projects.map((project) => {
      const preview = previews.get(project.id);
      return {
        ...project,
        preview_url: preview?.url ?? null,
        preview_type: preview?.type ?? null,
      };
    });
    res.json({ projects: withPreviews });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

projectsRouter.get("/:id", async (req: AuthedRequest, res) => {
  try {
    const project = await getProject(req.userId!, req.params.id);
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

projectsRouter.get("/:id/jobs/latest", async (req: AuthedRequest, res) => {
  try {
    const project = await getProject(req.userId!, req.params.id);
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    const job = await getLatestJobForProject(project.id);
    res.json({ job });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

projectsRouter.post("/", async (req: AuthedRequest, res) => {
  const { name, type, productId } = req.body ?? {};

  if (type !== "poster" && type !== "video") {
    res.status(400).json({ error: "type must be 'poster' or 'video'" });
    return;
  }

  try {
    let resolvedProductId = typeof productId === "string" ? productId : null;
    if (!resolvedProductId) {
      // Individual accounts have exactly one implicit brand kit — attach it here so brand
      // context (logo/colors/tone) applies during generation without ever showing them a
      // product picker. Organisation accounts always pass an explicit productId.
      const account = await getAccount(req.userId!);
      if (account?.account_type === "individual") {
        const product = await getOrCreateDefaultProduct(req.userId!);
        resolvedProductId = product.id;
      }
    }

    const project = await createProject(
      req.userId!,
      typeof name === "string" && name.trim() ? name.trim() : "Untitled Project",
      type,
      resolvedProductId,
    );
    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

projectsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const { name, folderId } = req.body ?? {};

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    res.status(400).json({ error: "name must be a non-empty string" });
    return;
  }
  if (folderId !== undefined && folderId !== null && typeof folderId !== "string") {
    res.status(400).json({ error: "folderId must be a string or null" });
    return;
  }

  try {
    const project = await updateProject(req.userId!, req.params.id, {
      name: typeof name === "string" ? name.trim() : undefined,
      folderId,
    });
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

projectsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  try {
    const deleted = await deleteProject(req.userId!, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
