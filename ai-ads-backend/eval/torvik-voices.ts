// End-card voice samples for Torvik: the same line in a few dusky male Gemini TTS voices.
// Usage: npx tsx eval/torvik-voices.ts <outDir>
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { synthesizeVoiceover } from "../src/lib/voiceover";

const PERSONA = "a man in his forties with a very deep, dusky, husky chest voice, calm and unhurried, like a rider speaking quietly at dawn";
export const SLOW_READ =
  "Speak very slowly, about 80 words per minute: say \"Torvik\" slowly and let it land, then a full one-second pause, then \"Ride with the wind\" drawn out and low, with a slight stretch on \"wind\". Deep chest resonance, low pitch, relaxed breath; never rushed, never an announcer";
const VOICES = ["Algenib", "Enceladus", "Charon"];
const [outDir] = process.argv.slice(2);
(async () => {
  mkdirSync(outDir, { recursive: true });
  for (const voice of VOICES) {
    const wav = await synthesizeVoiceover("Torvik. Ride with the wind.", "en", "male", "bold", SLOW_READ, { voice, persona: PERSONA });
    writeFileSync(join(outDir, `${voice}.wav`), wav);
    console.log(voice, wav.length);
  }
  process.exit(0);
})();
