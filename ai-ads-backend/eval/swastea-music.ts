// Swastea's music bed: an original piece in the mood of Raag Malhar (the monsoon raga of rain and
// relief), as the user asked — bansuri and sitar over a tanpura drone, played faint under the dialogue.
import "../src/lib/gcp-credentials-bootstrap";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateMusic } from "../src/lib/music";

const PROMPTS = [
  "Original calm Indian classical instrumental in the mood of a monsoon morning raga like Raag Malhar: slow, tender bansuri flute phrases over a soft tanpura drone, a few gentle sitar notes, the feeling of rain beginning and relief. Warm, peaceful, unhurried. No percussion, no vocals.",
  "Original gentle Hindustani instrumental inspired by monsoon ragas such as Malhar: a soft sitar alaap with a low tanpura drone and light santoor shimmer, slowly swelling and settling into calm. Intimate, warm, serene. No drums, no vocals.",
];
(async () => {
  for (const [i, p] of PROMPTS.entries()) {
    try {
      writeFileSync(join(homedir(), "Desktop", "swastea", `malhar-${i + 1}.wav`), await generateMusic(p));
      console.log(`malhar ${i + 1} done`);
    } catch (err) {
      console.error(`malhar ${i + 1} failed:`, err instanceof Error ? err.message.slice(0, 160) : err);
    }
  }
})();
