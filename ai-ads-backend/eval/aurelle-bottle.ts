// The Aurelle bottle in ivory white (not cream) with a black wordmark, edited from the user's
// cream version. `npx tsx eval/aurelle-bottle.ts [count]` → ~/Desktop/aurelle/bottle-white-N.png
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateImage } from "../src/lib/image-gen";

const dir = join(homedir(), "Desktop", "aurelle");
const ref = (f: string) => ({ imageBytes: readFileSync(join(dir, f)).toString("base64"), mimeType: "image/png" });
const PROMPT =
  "Edit image 1, a studio photo of a shampoo bottle. Keep everything identical (bottle shape, size, proportions, the brushed champagne-gold pump, label layout, every line of text and its spacing, camera angle) except: 1. The bottle's colour changes from cream to a clean ivory white, a soft near-white (#F7F6F2) with only the faintest warmth, matte soft-touch finish; it must read as white, never cream, beige or yellow. 2. The AURELLE wordmark in solid black (#111111); image 2 is the authority for its exact letters and typeface. 3. The other label text stays black; the thin rule stays gold. 4. The background becomes a bright, clean, very light warm-grey seamless (#EEEDEA) with bright, soft, high-key light and a faint pale contact shadow; no cream or beige anywhere. Photoreal commercial packshot. Do not change, add or misspell any text.";

(async () => {
  const count = Number(process.argv[2] ?? 2);
  for (let i = 1; i <= count; i++) {
    const img = await generateImage(PROMPT, "1:1", [ref("bottle-front.png"), ref("logo-black.png")]);
    const out = join(dir, `bottle-white-${i}.png`);
    writeFileSync(out, Buffer.from(img.imageBytes, "base64"));
    console.log(out);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
