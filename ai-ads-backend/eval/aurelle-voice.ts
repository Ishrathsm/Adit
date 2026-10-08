// Voice-over samples for the Aurelle film: the whole script read by three prebuilt female voices,
// cast as a soft-spoken Indian woman of about 25. → ~/Desktop/aurelle/voice/<voice>.wav
import "../src/lib/gcp-credentials-bootstrap";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { synthesizeVoiceover } from "../src/lib/voiceover";

const SCRIPT =
  "Heat, sun and harsh washes wear hair down. ... Aurelle Bio-Protein Repair Shampoo. ... Argan oil adds shine. Vitamin E protects. ... Bio-protein fills the worn gaps. ... Sulphate-free, so it cleans without stripping. ... Smooth from root to tip. ... Aurelle. Your hair’s true nature, restored.";
const PERSONA = "a soft-spoken 25-year-old Indian woman from Bengaluru, warm and gentle, speaking close to the microphone";
const DIRECTION = "soft, warm and unhurried, like a quiet confidence; a gentle smile in the voice; a clear pause at each '...'; never an announcer, never breathy or whispery";
const VOICES = ["Aoede", "Kore", "Leda"];

(async () => {
  const dir = join(homedir(), "Desktop", "aurelle", "voice");
  mkdirSync(dir, { recursive: true });
  for (const voice of VOICES) {
    const wav = await synthesizeVoiceover(SCRIPT, "en", "female", "warm", DIRECTION, { voice, persona: PERSONA, accent: "Indian English" });
    writeFileSync(join(dir, `${voice.toLowerCase()}.wav`), wav);
    console.log(`${voice} done, ${((wav.length - 44) / 48000).toFixed(1)}s`);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
