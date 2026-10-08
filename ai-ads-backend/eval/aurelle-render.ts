// Renders the Aurelle film's 8 clips from the approved keyframes: one take per shot (the user's
// rule), silent (music and voice-over come in the edit), each checked for sudden effects and
// stray text but never re-rendered automatically. → ~/Desktop/aurelle/clips/shot-N.mp4
// Usage: npx tsx eval/aurelle-render.ts [shots, e.g. 1,4]
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { clipSecondsFor, directionText } from "../src/lib/creative-brief";
import { refineShotVideoPrompt, splitNegativePrompt } from "../src/lib/prompt-refiner";
import { composeLookSheet, composeShot } from "../src/lib/text-gen";
import { findMarksInVideo, findSuddenEffects } from "../src/lib/video-check";
import { generateVideo } from "../src/lib/veo";

const dir = join(homedir(), "Desktop", "aurelle");
const out = join(dir, "clips");
const d = JSON.parse(readFileSync(join(__dirname, "out", "aurelle-script.json"), "utf8"));
const script = d.script;
const lookSheet = composeLookSheet(script.look, script.continuity);
const BRAND = { productName: "Aurelle", primaryColor: "#c9a66b", secondaryColor: "#111111", font: null, tagline: script.endCardTagline };
const png = (f: string) => ({ imageBytes: readFileSync(f).toString("base64"), mimeType: "image/png" });
const bottle = png(join(dir, "bottle-ref.png"));
const WITH_BOTTLE = new Set([2, 8]);

async function render(n: number) {
  const file = join(out, `shot-${n}.mp4`);
  if (existsSync(file)) return;
  const spec = script.shots[n - 1].spec;
  const seconds = clipSecondsFor(spec.seconds);
  const start = png(join(dir, "keyframes", `shot-${n}.png`));
  const refined = await refineShotVideoPrompt(composeShot(spec), d.concept, n - 1, script.shots.length, seconds, "16:9", BRAND, lookSheet, directionText(d.brief), start, true);
  const { prompt, negativePrompt } = splitNegativePrompt(refined);
  const negative = [negativePrompt, "fast motion, real-time speed, sudden movement, camera shake, dark background, glow, particles, morphing, changing label text"].filter(Boolean).join(", ");
  writeFileSync(join(out, `shot-${n}.prompt.json`), JSON.stringify({ prompt, negative, seconds }, null, 2));
  const video = await generateVideo(prompt, { image: start, durationSeconds: seconds, generateAudio: false, negativePrompt: negative });
  const clip = Buffer.from(video.videoBytes, "base64");
  writeFileSync(file, clip);
  const effects = await findSuddenEffects(clip, spec.action, d.brief.look);
  const marks = await findMarksInVideo(clip, WITH_BOTTLE.has(n) ? [bottle] : []);
  const problems = [...effects, ...marks].map((p) => p.issue);
  writeFileSync(join(out, `shot-${n}.check.json`), JSON.stringify(problems, null, 2));
  console.log(`shot ${n} done (${seconds}s clip)${problems.length ? ` — check: ${problems.join(" | ")}` : " — check clean"}`);
}

(async () => {
  mkdirSync(out, { recursive: true });
  const only = process.argv[2] ? process.argv[2].split(",").map(Number) : script.shots.map((_: unknown, i: number) => i + 1);
  // Three at a time: Veo's quota handles it, and the film renders in about a third of the time.
  const queue = [...only];
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
        try {
          await render(n);
        } catch (err) {
          console.error(`shot ${n} failed:`, err instanceof Error ? err.message : err);
        }
      }
    }),
  );
})();
