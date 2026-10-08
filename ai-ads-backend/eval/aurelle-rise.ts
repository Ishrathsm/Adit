// Shot 7's first and last frames: the bottle rising out of a pool of shampoo. The last frame is
// for Veo's lastFrame, so the label lands clean. → ~/Desktop/aurelle/keyframes/shot-7{,-end}.png
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateCleanImage } from "../src/lib/image-gen";

const dir = join(homedir(), "Desktop", "aurelle");
const bottle = { imageBytes: readFileSync(join(dir, "bottle-ref.png")).toString("base64"), mimeType: "image/png" };
const SCENE =
  "Photorealistic high-end product still, 16:9, medium close-up, locked-off camera at label height, the bottle centred. An all-white minimalist set: a matte white stone counter and a soft white wall. Bright, high-key soft daylight from high to one side with generous white fill; faint pale shadows; whites stay pure white. The bottle is exactly the one in the reference image, with its full printed front label exactly as shown (the AURELLE wordmark in black, BIO-PROTEIN REPAIR SHAMPOO in serif capitals, the thin gold rule, the ingredient line, SULPHATE-FREE and 250 ml); matte ivory-white bottle, brushed champagne-gold pump. Never change, add or invent any text.";
const FRAMES: Record<string, string> = {
  "shot-7": `${SCENE} The bottle stands perfectly upright, rising out of a still, wide pool of glossy pearly-white shampoo that covers the counter: the pool's surface reaches just below the gold rule on the label, so AURELLE and BIO-PROTEIN REPAIR SHAMPOO are clear above it while the lower label is still under the shampoo. Thick, glossy shampoo coats the bottle's shoulders and slides down its sides in smooth sheets; a soft ring of liquid is drawn up around the bottle where it meets the pool.`,
  "shot-7-end": `${SCENE} The bottle stands perfectly upright and still, clean and dry, its whole label sharp and fully visible, its base resting just above a still, wide, mirror-smooth pool of glossy pearly-white shampoo that covers the counter. A soft reflection of the bottle in the pool. Calm, clean, finished.`,
};

(async () => {
  for (const [name, prompt] of Object.entries(FRAMES)) {
    const img = await generateCleanImage(prompt, "16:9", [bottle], [bottle]);
    writeFileSync(join(dir, "keyframes", `${name}.png`), Buffer.from(img.imageBytes, "base64"));
    console.log(`${name} done${img.clean ? "" : " (text check flagged it)"}`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
