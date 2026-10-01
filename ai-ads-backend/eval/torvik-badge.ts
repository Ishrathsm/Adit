// The Torvik R7 reference with its own badge: the wordmark on the tank side, image 2 as the
// authority for the letters. `npx tsx eval/torvik-badge.ts [count]` → ~/Desktop/torvik/bike-ref-badge-N.png
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateImage } from "../src/lib/image-gen";

const dir = join(homedir(), "Desktop", "torvik");
const ref = (f: string) => ({ imageBytes: readFileSync(join(dir, f)).toString("base64"), mimeType: "image/png" });
const PROMPT =
  "Edit image 1, a studio photo of the Torvik R7 motorcycle. Add one badge: the word TORVIK from image 2 as a slim brushed-copper metal badge mounted flat on the side of the matte graphite fuel tank, centred on the tank's side panel, about a third of the tank's length, following the tank's curve, with a crisp edge and a soft real reflection. Image 2 is the authority for the exact letters T-O-R-V-I-K, their spacing and the square-cornered typeface; copy them exactly. Change nothing else: the same bike, every part, colour and finish, the same camera angle, studio background and lighting. No other text, logos, numbers or marks anywhere.";

(async () => {
  const count = Number(process.argv[2] ?? 2);
  for (let i = 1; i <= count; i++) {
    const img = await generateImage(PROMPT, "16:9", [ref("bike-ref-2.png"), ref("torvik-wordmark-orbitron.png")]);
    const out = join(dir, `bike-ref-badge-${i}.png`);
    writeFileSync(out, Buffer.from(img.imageBytes, "base64"));
    console.log(out);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
