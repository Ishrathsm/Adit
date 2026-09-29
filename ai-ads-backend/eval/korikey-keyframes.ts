// Storyboard frames for "Ramayya's Korikey" before any video: character sheets for the dragon and
// Ramayya, then two candidate keyframes per shot (drawn with those sheets as references) and the
// picker's choice. Usage: npx tsx eval/korikey-keyframes.ts <outDir>
import "../src/lib/gcp-credentials-bootstrap";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { directionText, FOLK_IMAGE_STYLE } from "../src/lib/creative-brief";
import { generateCleanImage, generateImage, type ReferenceImage } from "../src/lib/image-gen";
import { refineShotImagePrompt } from "../src/lib/prompt-refiner";
import { composeLookSheet, composeShot } from "../src/lib/text-gen";

const out = process.argv[2];
const d = JSON.parse(readFileSync(join(__dirname, "out", "korikey-ramayya-final.json"), "utf8"));
const script = d.script;
const lookSheet = composeLookSheet(script.look, script.continuity);

const SHEETS = {
  Dragon:
    "A character model sheet of one figure: a large, friendly-grand, comic dragon as a flat Telugu folk-art cut-out puppet — KoriKey red (#e3262b) all over with darker red Kalamkari patterning on its scales, a cream belly, big expressive almond eyes, small curled horns, a long curling tail, jointed at neck, legs, jaw and tail. Full body in side profile, alone on a plain warm cream background.",
  Ramayya:
    "A character model sheet of one figure: Ramayya, a humble, thin, middle-aged Telugu snack-maker as a flat Telugu folk-art cut-out puppet — a kind face with a small moustache and large almond eyes, a white dhoti, a simple bottle-green kurta, a red cloth tied at the waist, barefoot, jointed at neck, shoulders, elbows and knees. Full body in side profile, alone on a plain warm cream background.",
};
// Which recurring characters appear in each shot (1-based).
const CAST_IN: Record<number, (keyof typeof SHEETS)[]> = { 2: ["Dragon"], 3: ["Dragon"], 4: ["Ramayya"], 5: ["Dragon", "Ramayya"], 6: ["Dragon", "Ramayya"], 7: ["Dragon"], 8: ["Dragon"] };

const b64 = (p: string): ReferenceImage => ({ imageBytes: readFileSync(p).toString("base64"), mimeType: "image/png" });

(async () => {
  mkdirSync(out, { recursive: true });
  const sheets: Record<string, ReferenceImage> = {};
  for (const [name, prompt] of Object.entries(SHEETS)) {
    const file = join(out, `${name.toLowerCase()}-sheet.png`);
    if (!existsSync(file)) {
      const img = await generateImage(`${prompt}\n\n${FOLK_IMAGE_STYLE}`, "1:1");
      writeFileSync(file, Buffer.from(img.imageBytes, "base64"));
    }
    sheets[name] = b64(file);
    console.log("sheet", name);
  }
  for (let i = 0; i < script.shots.length; i++) {
    const n = i + 1;
    if (existsSync(join(out, `shot-${n}.png`))) continue;
    const description = composeShot(script.shots[i].spec);
    const cast = CAST_IN[n] ?? [];
    const labels = cast.map((c) => `the ${c} character reference — match this exact design, colours, patterns and outline in the shot`);
    const prompt = await refineShotImagePrompt(description, d.story, i, script.shots.length, "16:9", d.brand, undefined, lookSheet, directionText(d.brief), labels);
    const refs = cast.map((c) => sheets[c]);
    // The text check stays on: a preview frame without it came back with invented film credits.
    const img = await generateCleanImage(`${prompt}\n\n${FOLK_IMAGE_STYLE}`, "16:9", refs, []);
    writeFileSync(join(out, `shot-${n}.png`), Buffer.from(img.imageBytes, "base64"));
    console.log(`shot ${n} done`);
  }
})();
