import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { createFolder, deleteFolder, listFolders, renameFolder } from "../lib/folders";

export const foldersRouter = Router();

foldersRouter.get("/", async (req: AuthedRequest, res) => {
  const productId = typeof req.query.productId === "string" ? req.query.productId : null;
  try {
    const folders = await listFolders(req.userId!, productId);
    res.json({ folders });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

foldersRouter.post("/", async (req: AuthedRequest, res) => {
  const { name, productId } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    const folder = await createFolder(
      req.userId!,
      name.trim(),
      typeof productId === "string" ? productId : null,
    );
    res.status(201).json({ folder });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

foldersRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    const folder = await renameFolder(req.userId!, req.params.id, name.trim());
    if (!folder) {
      res.status(404).json({ error: "folder not found" });
      return;
    }
    res.json({ folder });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

foldersRouter.delete("/:id", async (req: AuthedRequest, res) => {
  try {
    const deleted = await deleteFolder(req.userId!, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "folder not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
