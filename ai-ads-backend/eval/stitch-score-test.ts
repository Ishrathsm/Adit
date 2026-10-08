// End-to-end check of the production sound path (2026-10-08): planScore → generateScoreParts →
// stitchVideos with the score, each clip's levelled voice, auto room tone and an end card, on the
// Swastea v3 takes. `npx tsx eval/stitch-score-test.ts` → ~/Desktop/swastea/prod-sound-test.mp4
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateScoreParts, planScore } from "../src/lib/score";
import { stitchVideos } from "../src/lib/video-stitch";

const d = join(homedir(), "Desktop", "swastea");
const SHOTS: [string, number, number, boolean, string][] = [
  ["s1-t2", 0.0, 4.8, true, "he asks for ginger and sneezes"],
  ["s2-t2", 0.3, 2.1, true, "Aunty: looks like a cold"],
  ["s3-t1", 0.0, 2.3, true, "come in"],
  ["s4a-t1", 0.3, 2.1, false, "Swastea spooned into chai"],
  ["s4b-t1", 0.4, 1.3, false, "poured into the steel cup"],
  ["s5-t2", 0.4, 6.5, true, "the sip, relief"],
  ["s6-t2", 3.4, 2.6, true, "like mother's"],
  ["s7-t1", 1.0, 4.7, true, "he reads the pack"],
];
(async () => {
  const t0 = Date.now();
  const plan = await planScore("Swastea herbal tea — a bachelor with a cold, a kind neighbour, chai that feels like home", "warm, happy, sparse, traditional Indian instruments", "warm", SHOTS.map(([, , len, spoken, note]) => ({ seconds: len, spoken, note })), true);
  console.log("plan:", JSON.stringify({ key: plan.key, peakShot: plan.peakShot, bedFromShot: plan.bedFromShot }));
  const parts = await generateScoreParts(plan);
  // (reuses fresh parts each run; ~₹20 of Lyria)
  console.log("parts:", Object.entries(parts).filter(([k, v]) => k !== "plan" && v).map(([k, v]) => `${k} ${(v as Buffer).length}B`).join(", "));
  const out = await stitchVideos(SHOTS.map(([f]) => readFileSync(join(d, "video-v3", `${f}.mp4`))), {
    cutSeconds: SHOTS.map(([, , len]) => len),
    clipStarts: SHOTS.map(([, start]) => start),
    endCard: readFileSync(join(d, "frames-v3", "s8-hero.png")),
    endCardSeconds: 4,
    clipAudio: true,
    roomTone: "auto",
    score: parts,
    musicLevel: 0.6,
  });
  writeFileSync(join(d, "prod-sound-test.mp4"), out);
  console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s → ~/Desktop/swastea/prod-sound-test.mp4`);
})().catch((e) => { console.error(e); process.exit(1); });
