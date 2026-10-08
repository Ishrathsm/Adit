// The Aurelle film's sound: the voice-over line by line (Aoede, a soft-spoken 25-year-old woman
// from Bengaluru, sped to 1.15x as the user asked), each take transcribed and checked, and two
// takes of the music bed. → ~/Desktop/aurelle/voice/line-N.wav, ~/Desktop/aurelle/music-N.wav
import "../src/lib/gcp-credentials-bootstrap";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { env } from "../src/lib/env";
import { generateMusic } from "../src/lib/music";
import { withRateLimitRetry } from "../src/lib/rate-limit-retry";
import { synthesizeVoiceover } from "../src/lib/voiceover";

const dir = join(homedir(), "Desktop", "aurelle");
// shot = the shot the line sits on (9 = the end card).
export const LINES = [
  { shot: 1, text: "Heat, sun and harsh washes wear hair down." },
  { shot: 2, text: "Aurelle Bio-Protein Repair Shampoo." },
  { shot: 3, text: "Argan oil adds shine. Vitamin E protects." },
  { shot: 4, text: "Bio-protein fills the worn gaps." },
  { shot: 5, text: "Sulphate-free, so it cleans without stripping." },
  { shot: 6, text: "Smooth from root to tip." },
  { shot: 9, text: "Aurelle. Your hair’s true nature, restored." },
];
const PERSONA = "a soft-spoken 25-year-old Indian woman from Bengaluru, warm and gentle, speaking close to the microphone";
// Pronunciation notes only for lines that contain the word: a note naming words not in the line
// got read aloud ("Orl, Orl, protein…") on line 1's first take.
const direction = (text: string) =>
  [
    "soft and warm with a gentle smile in the voice, at a natural, easy conversational pace of about 155 words per minute, flowing, with no long pauses inside the line; never slow or drawn out, never an announcer, never breathy or whispery",
    /aurelle/i.test(text) && "the brand name is pronounced oh-REL",
    "say only the words of the line, exactly once",
  ].filter(Boolean).join("; ");
const MUSIC =
  "Original ambient instrumental underscore: airy, bright and calm. Soft evolving pads, a few gentle felt-piano notes, light shimmer, a slow subtle swell toward the end that settles on an open, hopeful chord. No drums, no vocals, no melody hook.";

const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
const norm = (t: string) => t.toLowerCase().replace(/sulfate/g, "sulphate").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim().replace(/\bbio protein\b/g, "bioprotein");

(async () => {
  mkdirSync(join(dir, "voice"), { recursive: true });
  for (const [i, line] of LINES.entries()) {
    if (existsSync(join(dir, "voice", `line-${i + 1}.wav`))) continue;
    for (let take = 1; take <= 3; take++) {
      const wav = await synthesizeVoiceover(line.text, "en", "female", "warm", direction(line.text), { voice: "Aoede", persona: PERSONA, accent: "Indian English" });
      const r = await withRateLimitRetry("voice-check", () => ai.models.generateContent({ model: env.imageCheckModel, contents: [{ inlineData: { data: wav.toString("base64"), mimeType: "audio/wav" } }, "Write only the exact words spoken, nothing else."] }));
      const heard = norm(r.text ?? "").replace(/\b(orelle|orell|oral|aurel)\b/g, "aurelle");
      // The brand name is invented, so the transcript spells it any which way; everything else must match.
      const ok = heard.replace(/\baurelle\b/g, "") === norm(line.text).replace(/\baurelle\b/g, "");
      const raw = join(dir, "voice", `line-${i + 1}-raw.wav`);
      writeFileSync(raw, wav);
      console.log(`line ${i + 1} take ${take}: heard "${r.text?.trim()}" ${ok ? "OK" : "MISMATCH"}`);
      if (ok || take === 3) {
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", "atempo=1.15", join(dir, "voice", `line-${i + 1}.wav`)]);
        break;
      }
    }
  }
  for (const i of [1, 2].filter((n) => !existsSync(join(dir, `music-${n}.wav`)))) {
    try {
      writeFileSync(join(dir, `music-${i}.wav`), await generateMusic(MUSIC));
      console.log(`music ${i} done`);
    } catch (err) {
      console.error(`music ${i} failed:`, err instanceof Error ? err.message.slice(0, 200) : err);
    }
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
