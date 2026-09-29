// Runs the per-take video checks on local clips: npx tsx eval/check-clips.ts a.mp4 b.mp4 ...
// SKIP_MARKS=1 runs only the effects check; VIDEO_CHECK_MODEL picks the checker model.
import "../src/lib/gcp-credentials-bootstrap";
import { readFile } from "node:fs/promises";
import { findMarksInVideo, findSuddenEffects } from "../src/lib/video-check";

async function main() {
  for (const path of process.argv.slice(2)) {
    const clip = await readFile(path);
    const [marks, effects] = await Promise.all([process.env.SKIP_MARKS ? [] : findMarksInVideo(clip), findSuddenEffects(clip)]);
    const problems = [...marks, ...effects];
    console.log(`\n${path}: ${problems.length ? `${problems.length} problem(s)` : "clean"}`);
    for (const p of problems) console.log(`  - ${p.issue}\n    avoid: ${p.avoid}\n    direction: ${p.direction}`);
  }
}

main();
