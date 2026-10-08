// Swastea end-line voices (user, 2026-10-08: "give more voices, it should be soothing to hear"). Eight
// Gemini TTS female voices read "स्वस टी। रोज़ पियो, स्वस्थ रहो।" softly and soothingly; each take is fully
// transcribed (to catch instructions read aloud) and checked for the short "SWAS-tea".
// `npx tsx eval/swastea-vo-voices.ts` → ~/Desktop/swastea/vo/*.wav
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "../src/lib/env";
import { withRateLimitRetry } from "../src/lib/rate-limit-retry";

const out = join(homedir(), "Desktop", "swastea", "vo");
const tts = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const ear = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
const wav = (pcm: Buffer) => { const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
const VOICES = ["Aoede", "Sulafat", "Achernar", "Despina", "Leda", "Callirrhoe", "Vindemiatrix", "Laomedeia"];
const LINE = "स्वस टी। रोज़ पियो, स्वस्थ रहो।";
const DIRECTION = "Say this softly and soothingly, like a gentle, sweet Indian woman's voice at the end of a warm tea ad: calm, smiling, close to the microphone, unhurried, every word clear:";

(async () => {
  mkdirSync(out, { recursive: true });
  await Promise.all(VOICES.map(async (v) => {
    try {
      const r = await withRateLimitRetry("tts", () => tts.models.generateContent({ model: env.voiceoverModel, contents: `${DIRECTION} ${LINE}`, config: { responseModalities: ["AUDIO"], speechConfig: { languageCode: "hi-IN", voiceConfig: { prebuiltVoiceConfig: { voiceName: v } } } } }));
      const d = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
      if (!d) return console.log(`${v}: no audio`);
      const f = join(out, `${v}.wav`);
      writeFileSync(f, wav(Buffer.from(d, "base64")));
      const q = await withRateLimitRetry("listen", () => ear.models.generateContent({ model: env.textModel, contents: [{ inlineData: { data: readFileSync(f).toString("base64"), mimeType: "audio/wav" } },
        "1) Transcribe EVERYTHING said, in Devanagari. 2) First word: is its first vowel SHORT (स्वस) or LONG (स्वास), and does it end in the English word 'tea' (टी)? 3) How soothing/sweet is the voice, 1–10? One line each."] }));
      console.log(`${v}: ${q.text?.trim().replace(/\n+/g, " | ")}`);
    } catch (e) { console.error(`${v}:`, String(e).slice(0, 120)); }
  }));
  // durations
})();
