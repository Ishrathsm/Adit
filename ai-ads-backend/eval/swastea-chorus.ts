// Swastea's sip hook, built so the count is exact (user, 2026-10-08): "dhirena" FIVE times in ~2s,
// fast, sung by a chorus of women. Lyria won't hold a syllable count, so several Gemini TTS
// female voices sing the exact text; each take is checked for five, then fitted and layered in
// eval/swastea-chorus.sh. `npx tsx eval/swastea-chorus.ts` → ~/Desktop/swastea/chorus/<voice>.wav
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "../src/lib/env";

const out = join(homedir(), "Desktop", "swastea", "chorus");
const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const VOICES = ["Aoede", "Kore", "Leda", "Zephyr", "Callirrhoe", "Despina"];
const TEXT = "dhi-re-na, dhi-re-na, dhi-re-na, dhi-re-na, dhi-re-naaa!";
const DIRECTION = "Sing this, don't speak it: a bright, fast, bouncy Indian ad-jingle hook, like a tarana, on a clear melody, every 'dhi-re-na' on one quick beat, exactly five times, the last 'naaa' held and ringing. Smiling, joyful, energetic, very fast";

const wav = (pcm: Buffer) => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24);
  h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};

(async () => {
  mkdirSync(out, { recursive: true });
  await Promise.all(VOICES.map(async (voice) => {
    try {
      const r = await ai.models.generateContent({
        model: env.voiceoverModel,
        contents: `${DIRECTION}: ${TEXT}`,
        config: { responseModalities: ["AUDIO"], speechConfig: { languageCode: "hi-IN", voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
      });
      const data = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
      if (!data) throw new Error("no audio");
      writeFileSync(join(out, `${voice}.wav`), wav(Buffer.from(data, "base64")));
      console.log(`${voice} done`);
    } catch (err) {
      console.error(`${voice} failed:`, err instanceof Error ? err.message.slice(0, 160) : err);
    }
  }));
})();
