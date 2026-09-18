import { Router } from "express";
import { generationQueue } from "../lib/queue";
import { supabase } from "../lib/supabase";
import { veoEnabled } from "../lib/veo";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const { error } = await supabase.from("_health_check_probe").select("*").limit(1);
  // PGRST205 ("table not found in schema cache") is expected — it only tells us
  // PostgREST answered at all, not that anything is actually wrong.
  const supabaseReachable = !error || error.code === "PGRST205";

  res.json({
    status: "ok",
    supabase: supabaseReachable ? "reachable" : "unreachable",
    queue: generationQueue ? "connected" : "disabled",
    veo: veoEnabled ? "configured" : "disabled",
  });
});
