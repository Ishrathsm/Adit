// Torvik (fictional motorcycle brand) — hero reference of the bike, generated before any
// storyboard so its design can be approved and then locked across every keyframe.
// Usage: npx tsx eval/torvik-reference.ts <outDir> [count]
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateCleanImage } from "../src/lib/image-gen";
import { BIKE } from "./torvik-bike";

const [outDir, count = "2"] = process.argv.slice(2);
(async () => {
  mkdirSync(outDir, { recursive: true });
  const prompt = `Studio product photograph of a motorcycle, three-quarter front view from the right, whole bike in frame, on a plain seamless warm-grey background with a soft floor shadow. ${BIKE} Soft large key light from above-left, gentle rim light tracing the tank and exhaust, true-to-life color. Nobody in frame.`;
  for (let i = 1; i <= Number(count); i++) {
    const img = await generateCleanImage(prompt, "16:9");
    const file = join(outDir, `bike-ref-${i}.png`);
    writeFileSync(file, Buffer.from(img.imageBytes, "base64"));
    console.log(file, img.clean ? "clean" : "MARKS FLAGGED");
  }
  process.exit(0);
})();
