// Swastea's sip cue (user, 2026-10-08): a woman's wordless aalap in a raga, rising as the bachelor
// sips with his eyes closed (shot 4). `npx tsx eval/swastea-aalap.ts` → ~/Desktop/swastea/aalap-N.wav
import "../src/lib/gcp-credentials-bootstrap";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateMusic } from "../src/lib/music";

const PROMPTS = [
  "A solo Indian female classical vocalist singing a slow, wordless Hindustani aalap in Raag Malhar, using only open vowel sounds like 'aa' with soft meend glides, over a gentle tanpura drone. Tender, serene, intimate, like relief after rain. No percussion, no lyrics.",
  "Hindustani classical aalap by a woman's voice in Raag Yaman, slow and meditative: long held 'aa' notes gliding between swaras, a soft tanpura drone and a faint swarmandal shimmer. Warm, peaceful, sacred calm. No drums, no words.",
];
(async () => {
  for (const [i, p] of PROMPTS.entries()) {
    try {
      writeFileSync(join(homedir(), "Desktop", "swastea", `aalap-${i + 1}.wav`), await generateMusic(p, undefined, "male voice, lyrics, words, drums, tabla, harsh, pop, electronic"));
      console.log(`aalap ${i + 1} done`);
    } catch (err) {
      console.error(`aalap ${i + 1} failed:`, err instanceof Error ? err.message.slice(0, 200) : err);
    }
  }
})();
