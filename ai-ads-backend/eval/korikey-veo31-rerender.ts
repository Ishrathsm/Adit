// KoriKey "Ramayya's Korikey" on Veo 3.1: puts the approved shot-2 take (shot_index 1) in place,
// clears the other shots' Lite videos (backed up in ~/Desktop/korikey/lite-takes/) so the stitch
// waits for all of them, and queues each remaining shot once — attempts: 1, so a failure never
// triggers a paid re-render. Run the worker with VEO_MODEL=veo-3.1-generate-001 VIDEO_MAX_TAKES=1.
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generationQueue } from "../src/lib/queue";
import { uploadVideo } from "../src/lib/storage";
import { listShots, updateShot } from "../src/lib/storyboards";

const STORYBOARD = "575a6193-c51d-4235-8891-9430295ad6ae";
const KEEP_INDEX = 1;
const KEEP_CLIP = join(__dirname, "out", "veo-compare", "shot1-veo-3.1-v2.mp4");

(async () => {
  const shots = await listShots(STORYBOARD);
  const keep = shots.find((s) => s.shot_index === KEEP_INDEX)!;
  const url = await uploadVideo(keep.id, readFileSync(KEEP_CLIP), "video/mp4");
  await updateShot(keep.id, { video_url: url, status: "video_ready" });
  console.log("shot", KEEP_INDEX, "->", url);
  const rest = shots.filter((s) => s.shot_index !== KEEP_INDEX);
  for (const s of rest) await updateShot(s.id, { video_url: null });
  for (const s of rest) {
    await generationQueue!.add("storyboard-shot-video", { kind: "storyboard-shot-video", shotId: s.id }, { attempts: 1, deduplication: { id: `storyboard-shot-video:${s.id}` } });
    console.log("queued shot", s.shot_index);
  }
  process.exit(0);
})();
