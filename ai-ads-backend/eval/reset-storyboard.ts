// Clears a storyboard's queued jobs (local QUEUE_PREFIX only) and resets shots from <fromShot> on,
// so a local re-run starts clean. Usage: npx tsx eval/reset-storyboard.ts <storyboardId> <fromShot>
import "../src/lib/gcp-credentials-bootstrap";
import { Queue } from "bullmq";
import { env } from "../src/lib/env";
import { redisConnection } from "../src/lib/queue";
import { listShots, updateShot } from "../src/lib/storyboards";

const [storyboardId, fromArg] = process.argv.slice(2);
(async () => {
  if (env.queuePrefix === "bull") throw new Error("QUEUE_PREFIX is the production prefix; refusing to touch that queue");
  const queue = new Queue("generation", { connection: redisConnection!, prefix: env.queuePrefix });
  const shots = await listShots(storyboardId);
  const ids = new Set(shots.map((s) => s.id));
  let removed = 0;
  for (const job of await queue.getJobs(["waiting", "active", "delayed", "prioritized"])) {
    const d = job.data as { shotId?: string; storyboardId?: string };
    if ((d.shotId && ids.has(d.shotId)) || d.storyboardId === storyboardId) {
      await job.remove().catch(async () => { await job.moveToFailed(new Error("reset"), "0", false).catch(() => {}); });
      removed++;
    }
  }
  for (const s of shots.filter((s) => s.shot_index >= Number(fromArg))) {
    await updateShot(s.id, { status: "pending", choice_urls: null, selected_choice: null, video_url: null, error: null });
  }
  console.log(`removed ${removed} job(s); reset shots ${fromArg}+`);
  process.exit(0);
})();
