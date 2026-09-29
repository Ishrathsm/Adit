// One keyframe for a KoriKey script-B shot through the real refiner + image model, to check the
// stop-motion look before a full run. Usage: npx tsx eval/korikey-keyframe-test.ts <shotIndex> <out.png>
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { directionText, STOP_MOTION_IMAGE_STYLE } from "../src/lib/creative-brief";
import { generateCleanImage } from "../src/lib/image-gen";
import { refineShotImagePrompt } from "../src/lib/prompt-refiner";
import type { AdScript } from "../src/lib/text-gen";

const [shotArg, out] = process.argv.slice(2);
(async () => {
  const run = JSON.parse(readFileSync(join(__dirname, "out", "korikey-scripts.json"), "utf8"));
  const script: AdScript = run.scripts[1];
  const i = Number(shotArg);
  const prompt = await refineShotImagePrompt(script.shots[i].description, run.concept, i, script.shots.length, "16:9", run.brand, undefined, script.lookSheet, directionText(run.brief), []);
  console.log(prompt);
  const image = await generateCleanImage(`${prompt}\n\n${STOP_MOTION_IMAGE_STYLE}`, "16:9", [], []);
  writeFileSync(out, Buffer.from(image.imageBytes, "base64"));
  console.log("wrote", out);
})();
