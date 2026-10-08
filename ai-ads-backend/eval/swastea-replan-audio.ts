// Audio for the Swastea replan page (2026-10-08). (1) The brand line in a controlled TTS voice, so
// "Swastea" is always "swas-TEA" (the English word tea); every take is transcribed to check.
// (2) Santoor score takes in Raag Ahir Bhairav: plain, and with the women's "dhi-re-naaa"
// woven into the music (so it rises and falls in the same key instead of being pasted on).
// `npx tsx eval/swastea-replan-audio.ts` → ~/Desktop/swastea/replan/
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "../src/lib/env";
import { generateMusic } from "../src/lib/music";

const out = join(homedir(), "Desktop", "swastea", "replan");
const tts = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const ear = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
const wav = (pcm: Buffer) => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24);
  h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};
const listen = async (f: string, mime: string, q: string) =>
  (await ear.models.generateContent({ model: env.textModel, contents: [{ inlineData: { data: readFileSync(f).toString("base64"), mimeType: mime } }, q] })).text?.trim();

const VO_VOICES = ["Aoede", "Sulafat", "Vindemiatrix"];
const VO = "Swas-tea. Roj piyo, swasth raho.";
const VO_DIRECTION = "Say this as a warm, clear Indian woman's voice-over for a tea ad, at a natural, unhurried but not slow pace, every word crisp. The brand name is said 'swas' then the English word 'tea', stressed on TEA: ";
const SCORE = [
  "Cinematic Indian instrumental in Raag Ahir Bhairav, morning warmth: a santoor leads with gentle tremolo phrases over a soft tanpura drone, a warm bansuri answers, light strings underneath. Begins sparse and tender, grows warmer and fuller in the middle, then resolves calmly with a final santoor phrase. Sincere, hopeful, homely. No drums, no vocals.",
  "Warm Indian film score led by santoor in a morning raga like Ahir Bhairav: delicate santoor arpeggios and tremolo, tanpura drone, soft cello pad, a few bansuri notes, slowly building to an emotional high and settling peacefully. Elegant, cinematic, sincere. No percussion, no vocals.",
];
const WOVEN = [
  "Cinematic Indian instrumental in Raag Ahir Bhairav led by santoor over a tanpura drone and soft strings. Midway, a soft chorus of three women sings one gentle wordless aalap 'dhi-re-naaa' that rises out of the music and melts back into it over about four seconds, then the santoor continues and resolves calmly. Warm, sincere, homely. No drums, no words.",
  "Warm santoor-led Indian film score in a morning raga: santoor tremolo and tanpura, light strings and bansuri; in the middle a small women's choir softly breathes a wordless 'dhi-re-naaa' aalap in harmony, swelling gently and fading into the santoor, never sudden. Then a calm, resolved ending. No percussion, no lyrics.",
];
const NEG_VOCAL = "male voice, lyrics, english words, drums, tabla, sudden, harsh, pop, electronic";

(async () => {
  mkdirSync(out, { recursive: true });
  const jobs: Promise<void>[] = [];
  for (const v of VO_VOICES) jobs.push((async () => {
    const r = await tts.models.generateContent({ model: env.voiceoverModel, contents: VO_DIRECTION + VO, config: { responseModalities: ["AUDIO"], speechConfig: { languageCode: "hi-IN", voiceConfig: { prebuiltVoiceConfig: { voiceName: v } } } } });
    const data = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
    if (!data) return console.error(`vo ${v}: no audio`);
    const f = join(out, `vo-${v}.wav`);
    writeFileSync(f, wav(Buffer.from(data, "base64")));
    console.log(`VO ${v}: ${await listen(f, "audio/wav", "Write phonetically, syllable by syllable, exactly how the FIRST word (a brand name) is pronounced, then the rest of the line as heard. Is the first word 'swas-TEA' (the English word tea)? One or two lines.")}`);
  })());
  SCORE.forEach((p, i) => jobs.push(generateMusic(p).then((b) => { writeFileSync(join(out, `score-${i + 1}.wav`), b); console.log(`score ${i + 1} done`); }).catch((e) => console.error(`score ${i + 1}:`, String(e).slice(0, 150)))));
  WOVEN.forEach((p, i) => jobs.push(generateMusic(p, undefined, NEG_VOCAL).then(async (b) => {
    const f = join(out, `woven-${i + 1}.wav`);
    writeFileSync(f, b);
    console.log(`woven ${i + 1}: ${await listen(f, "audio/wav", "This is a santoor-led Indian score that should contain ONE short wordless women's chorus 'dhi-re-naaa'. Give: where any voices appear (start–end s), how many times, whether they enter and leave smoothly, any real words or male voice, and whether santoor clearly leads. 4 short lines.")}`);
  }).catch((e) => console.error(`woven ${i + 1}:`, String(e).slice(0, 150)))));
  await Promise.all(jobs);
})();
