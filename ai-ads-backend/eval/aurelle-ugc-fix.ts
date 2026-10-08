// Edits the chosen UGC opening frame (keyframe-5): removes the stray tripod phone and the branded
// skincare tubes, and makes her hair smooth and glossy (the review's result), keeping her face.
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateCleanImage } from "../src/lib/image-gen";

const dir = join(homedir(), "Desktop", "aurelle");
const png = (f: string) => ({ imageBytes: readFileSync(f).toString("base64"), mimeType: "image/png" });
const PROMPT =
  "Edit image 1. Keep the same woman exactly — her face, skin texture, acne marks, nose pin, expression, pose, t-shirt — and the same room, light and camera framing. Change only: 1. Remove the phone on the tripod at the right edge; continue the desk, her arm and the room behind it naturally. 2. Remove all the small skincare tubes, jars and products at the bottom-left of the desk; leave the bare desk, the charger cable, the phone lying flat and the hair clip. 3. Her long jet-black hair becomes smooth, straight and glossy, falling neatly over her shoulders, with only a few natural flyaways at the crown — not frizzy. The Aurelle bottle stays exactly as it is (image 2 is its reference). No new text anywhere.";

(async () => {
  for (const i of [1, 2]) {
    const img = await generateCleanImage(PROMPT, "9:16", [png(join(dir, "ugc", "keyframe-5.png")), png(join(dir, "bottle-ref.png"))], [png(join(dir, "bottle-ref.png"))]);
    writeFileSync(join(dir, "ugc", `keyframe-5-fix-${i}.png`), Buffer.from(img.imageBytes, "base64"));
    console.log(`fix ${i}${img.clean ? "" : " (text check flagged it)"}`);
  }
})();
