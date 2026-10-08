// Character sheets for the Swastea film, so each person keeps one face across every shot: the
// bachelor, Aunty and Uncle. Ordinary, real-looking people (the user's direction after the UGC
// film), photographed like a casting reference. → ~/Desktop/swastea/cast/<name>-N.png
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateCleanImage } from "../src/lib/image-gen";

const out = join(homedir(), "Desktop", "swastea", "cast");
const LOOK =
  "Photorealistic casting reference photograph, natural soft window daylight, plain light-grey wall behind, a real ordinary person with natural skin texture — visible pores, small imperfections, no retouching, no beauty filter, not a model. Two views side by side in one 16:9 image: on the left a front-facing head-and-shoulders portrait, on the right the same person in a three-quarter view from the waist up. Neutral, relaxed expression. No text, no captions, no logos anywhere.";
const CAST: Record<string, string> = {
  bachelor:
    "A 27-year-old Indian man who lives alone in a rented flat: slightly messy, slept-in black hair, a few days of stubble, a tired face with a slightly red nose, medium-brown skin, an old faded navy hoodie over a grey t-shirt, track pants; thin and ordinary, kind eyes.",
  aunty:
    "A 62-year-old Indian woman, a warm, motherly neighbour: grey-streaked hair in a low bun, a small red bindi, reading glasses on a beaded chain around her neck, a soft maroon cotton saree with a simple border, thin gold bangles, gentle laugh lines, medium-brown skin.",
  uncle:
    "A 66-year-old Indian man, a calm, kind retired neighbour: thinning grey hair, a neat grey moustache, rimless spectacles, a light-cream cotton kurta with a sleeveless brown sweater vest over it, a wristwatch with a leather strap, medium-brown skin, a slight stoop.",
};

(async () => {
  mkdirSync(out, { recursive: true });
  for (const [name, who] of Object.entries(CAST)) {
    for (const i of [1, 2]) {
      const img = await generateCleanImage(`${who}\n\n${LOOK}`, "16:9");
      writeFileSync(join(out, `${name}-${i}.png`), Buffer.from(img.imageBytes, "base64"));
      console.log(`${name} ${i}${img.clean ? "" : " (text check flagged it)"}`);
    }
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
