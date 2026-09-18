import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { createProject, getProject, listProjects } from "../lib/projects";

export const projectsRouter = Router();

projectsRouter.get("/", async (req: AuthedRequest, res) => {
  try {
    const projects = await listProjects(req.userId!);
    res.json({ projects });
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

projectsRouter.post("/", async (req: AuthedRequest, res) => {
  const { name, type, productId } = req.body ?? {};

  if (type !== "poster" && type !== "video") {
    res.status(400).json({ error: "type must be 'poster' or 'video'" });
    return;
  }

  try {
    const project = await createProject(
      req.userId!,
      typeof name === "string" && name.trim() ? name.trim() : "Untitled Project",
      type,
      typeof productId === "string" ? productId : null,
    );
    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
