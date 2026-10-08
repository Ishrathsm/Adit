// Keyframes for the Aurelle film before any video: one frame per shot, the ivory-white bottle as
// the product reference where it appears. `npx tsx eval/aurelle-keyframes.ts` → ~/Desktop/aurelle/keyframes
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { directionText } from "../src/lib/creative-brief";
import { generateCleanImage, type ReferenceImage } from "../src/lib/image-gen";
import { refineShotImagePrompt } from "../src/lib/prompt-refiner";
import { composeLookSheet, composeShot } from "../src/lib/text-gen";

const dir = join(homedir(), "Desktop", "aurelle");
const out = join(dir, "keyframes");
const d = JSON.parse(readFileSync(join(__dirname, "out", "aurelle-script.json"), "utf8"));
const script = d.script;
const lookSheet = composeLookSheet(script.look, script.continuity);
const bottle: ReferenceImage = { imageBytes: readFileSync(join(dir, "bottle-ref.png")).toString("base64"), mimeType: "image/png" };
// Shots (1-based) where the bottle is on screen.
const WITH_BOTTLE = new Set([2, 8]);
const BRAND = { productName: "Aurelle", primaryColor: "#c9a66b", secondaryColor: "#111111", font: null, tagline: d.script.endCardTagline };

(async () => {
  mkdirSync(out, { recursive: true });
  const only = process.argv[2] ? new Set(process.argv[2].split(",").map(Number)) : null;
  for (let i = 0; i < script.shots.length; i++) {
    const n = i + 1;
    if (only ? !only.has(n) : existsSync(join(out, `shot-${n}.png`))) continue;
    const description = composeShot(script.shots[i].spec);
    const refs = WITH_BOTTLE.has(n) ? [bottle] : [];
    const labels = refs.length ? ["the Aurelle bottle — match this exact bottle: shape, matte ivory-white colour (never cream), brushed champagne-gold pump, and its label text and layout"] : undefined;
    let prompt = await refineShotImagePrompt(description, d.concept, i, script.shots.length, "16:9", BRAND, undefined, lookSheet, directionText(d.brief), labels);
    // The refiner keeps brand names out of prompts (so the model doesn't paint them as stray
    // text) and here wrote the bottle as "unadorned"; the model then invented other brands'
    // labels. A reference product keeps its real label, so say so last, where it wins.
    if (refs.length) prompt = `${prompt.replace(/[^.]*\b(unadorned|unlabell?ed|blank|no (?:label|text|logo)s?)\b[^.]*\./gi, "")}\n\nPRODUCT (overrides anything above): the bottle is exactly the one in the reference image, including its full printed front label exactly as shown: the AURELLE wordmark in black, BIO-PROTEIN REPAIR SHAMPOO in serif capitals beneath it, the thin gold rule, the ingredient line, SULPHATE-FREE and 250 ml. Copy the label from the reference; never change, add or invent any text, brand or product name. Matte ivory-white bottle (never cream), brushed champagne-gold pump.`;
    writeFileSync(join(out, `shot-${n}.prompt.txt`), prompt);
    const img = await generateCleanImage(prompt, "16:9", refs, refs);
    writeFileSync(join(out, `shot-${n}.png`), Buffer.from(img.imageBytes, "base64"));
    console.log(`shot ${n} done${img.clean ? "" : " (text check flagged it)"}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
