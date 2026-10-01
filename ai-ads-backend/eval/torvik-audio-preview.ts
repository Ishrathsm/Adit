// Torvik audio preview: the director's score (Lyria, as the edit would make it) and the end-card
// line as a slow, bassy whisper in a few voices — for review before the film is rendered.
// Usage: npx tsx eval/torvik-audio-preview.ts <outDir>
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateMusic } from "../src/lib/music";
import { synthesizeVoiceover } from "../src/lib/voiceover";
import { WHISPER_PERSONA, WHISPER_READ } from "./torvik-bike";

const VOICES = ["Charon", "Algenib", "Enceladus"];

const [outDir] = process.argv.slice(2);
(async () => {
  mkdirSync(outDir, { recursive: true });
  const script = JSON.parse(readFileSync(join(__dirname, "out", "torvik-script.json"), "utf8")).script;
  const [music] = await Promise.all([
    generateMusic(script.musicPrompt, "Instrumental background music for a bold 30-second ad: simple, steady, gentle dynamics, no vocals."),
    ...VOICES.map(async (voice) => {
      const wav = await synthesizeVoiceover("Torvik. Ride with the wind.", "en", "male", "bold", WHISPER_READ, { voice, persona: WHISPER_PERSONA });
      writeFileSync(join(outDir, `${voice}.wav`), wav);
      console.log(voice, wav.length);
    }),
  ]);
  writeFileSync(join(outDir, "music.wav"), music);
  console.log("music", music.length);
  process.exit(0);
})();
