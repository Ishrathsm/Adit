// Removes the stray blurred bottle from the Aurelle shot 1 keyframe; nothing else changes.
import "../src/lib/gcp-credentials-bootstrap";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateCleanImage } from "../src/lib/image-gen";

const f = join(homedir(), "Desktop", "aurelle", "keyframes", "shot-1.png");
const img = { imageBytes: readFileSync(f).toString("base64"), mimeType: "image/png" };
(async () => {
  const out = await generateCleanImage(
    "Edit image 1. Remove the small blurred second bottle in the out-of-focus background on the right, replacing it with the same soft white background around it. Change nothing else: the main bottle, its label and every letter, the framing, the light and the colours stay exactly the same.",
    "16:9",
    [img],
    [img],
  );
  writeFileSync(f, Buffer.from(out.imageBytes, "base64"));
  console.log(`shot 1 cleaned${out.clean ? "" : " (text check flagged it)"}`);
})();
