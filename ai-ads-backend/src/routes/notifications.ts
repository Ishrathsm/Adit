import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { listRecentActivity } from "../lib/notifications";

export const notificationsRouter = Router();

notificationsRouter.get("/", async (req: AuthedRequest, res) => {
  try {
    const activity = await listRecentActivity(req.userId!);
    res.json({ activity });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
