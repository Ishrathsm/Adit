// Swastea replan round 2 (user, 2026-10-08):
// - "its swas not swaas": short a, so "स्वस टी".
// - "compose happy music and fast paced... dont use multiple instruments": one instrument, solo santoor.
// - "when he drinks there should be like glow behind his head like a circulating mandala showing relief".
// - "camera angles avoid them looking like theatre act, make it like more shot in real movie type shooting".
// Director+DOP revise the shots, the creative director checks them; music and voice takes are made and checked.
// `npx tsx eval/swastea-replan-2.ts` → eval/out/swastea-team/8-*.md, 9-*.md, ~/Desktop/swastea/replan/
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "../src/lib/env";
import { generateMusic } from "../src/lib/music";
import { withRateLimitRetry } from "../src/lib/rate-limit-retry";

const team = join(__dirname, "out", "swastea-team");
const rep = join(homedir(), "Desktop", "swastea", "replan");
const text = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
const tts = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation });
const gen = (c: unknown) => withRateLimitRetry("text", () => text.models.generateContent({ model: env.textModel, contents: c as string }));
const listen = async (f: string, q: string) => (await gen([{ inlineData: { data: readFileSync(f).toString("base64"), mimeType: "audio/wav" } }, q])).text?.trim().replace(/\n+/g, " ");
const wav = (pcm: Buffer) => { const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };

const NOTES = `New notes from the user on plan v2:
- The brand is "SWAS-tea": short 'a' as in 'swasth', not "swaas".
- The music should be happy and fast-paced, not gloomy or slow, and use ONE instrument only.
- When he drinks, a glowing mandala circulates behind his head to show relief. This is a code-made overlay, slowly rotating, golden, behind the head only.
- The camera angles must not look like a theatre act. Shoot it like a real movie.`;

(async () => {
  const plan = readFileSync(join(team, "plan.json"), "utf8");
  const jobs: Promise<unknown>[] = [];

  // 1. Director + DOP revise for real-movie coverage; then the creative director checks.
  jobs.push((async () => {
    const r1 = await gen(`You are the film director and DOP. Here is the current Swastea shot plan (JSON) with the lead's corrections: tea is Swastea spooned into chai boiling in a steel saucepan and poured through a strainer into a steel cup with a handle; the young man (navy hoodie over a grey t-shirt) is in every keyframe he appears in; Uncle never waves; there are 8 shots and 30s, and the brand name is said only by the VO on the pack shot.
${plan}

${NOTES}

Revise every shot so it plays like a real film, not a theatre act.
- Nobody faces or presents to the camera, and nobody stands side by side posing.
- Use over-the-shoulder and profile angles and eyelines just off the lens.
- Use foreground layering (door frame, plants, a kettle edge) for depth, and off-centre compositions.
- Use natural, unperformed behaviour (fidgets, small looks, half-turns) and slightly handheld or slow-dolly camera.
- Coverage should feel stolen from real life.
- The pack reveal in particular must NOT be Aunty holding the box up to the lens. Make it a natural moment: she sets it down by his cup, or he picks it up and turns it, or he notices it on the tray. Choose the most natural option that still shows the front clearly for a few frames, so the real pack can be composited.
- In the sip shot, frame him so there is clean, softly lit background behind his head for the mandala glow. Keep him centred or slightly off-centre, with a plain wall or soft window behind, and nothing busy.
For each shot give: n, seconds, framing and lens, camera, blocking, light, line, the keyframe description, and a short reason why it reads as film, not stage. Keep it practical for Veo: one action and one move.`);
    writeFileSync(join(team, "8-director-real-movie.md"), r1.text ?? "");
    const r2 = await gen(`You are the creative director. Check this revised shot list against the user's notes and the earlier rules (no humour, brisk clear speech, at most 8 words and one speaker per shot, 30s total, no theatre look, the mandala on the sip, the pack front clearly visible for compositing, Veo-practical). List anything still staged or impractical, and the exact fix. Be brief.\n\n${NOTES}\n\n${r1.text}`);
    writeFileSync(join(team, "9-cd-check.md"), r2.text ?? "");
    console.log("director + CD done");
  })());

  // 2. Happy, fast, single-instrument music: solo santoor.
  const MUSIC = [
    "Solo santoor only, no other instruments: a happy, bright, fast-paced Indian melody at about 120 BPM in a cheerful major-sounding raga like Raag Desh or Khamaj, sparkling tremolo and quick hammered runs, joyful and light like a sunny morning. Nothing else, no drone, no percussion, no vocals.",
    "A single santoor playing alone: an upbeat, playful, fast Indian folk-style tune, bouncy rhythmic strokes and bright arpeggios, happy and energetic, around 125 BPM, in a sunny major mode. Strictly one instrument. No tabla, no tanpura, no strings, no vocals.",
    "Solo santoor performance, cheerful and fast: lively hammered melody with crisp repeated notes and sparkling flourishes, feel-good morning energy, major key, steady quick tempo. Only the santoor. No other instruments, no voice, no drums.",
  ];
  MUSIC.forEach((p, i) => jobs.push(generateMusic(p, undefined, "tabla, drums, percussion, tanpura, drone, strings, flute, bansuri, sitar, vocals, sad, slow, gloomy, minor").then(async (b) => {
    const f = join(rep, `santoor-happy-${i + 1}.wav`);
    writeFileSync(f, b);
    console.log(`santoor ${i + 1}: ${await listen(f, "In 3 short lines: which instruments you hear (is it ONLY santoor?); tempo (slow/medium/fast, rough BPM); mood (happy/neutral/gloomy). Then SCORE n/10 for 'happy, fast, solo santoor'.")}`);
  }).catch((e) => console.error(`santoor ${i + 1}:`, String(e).slice(0, 150)))));

  // 3. Brand voice with a short "swas".
  const SPELL: [string, string][] = [["a", "स्वस टी। रोज़ पियो, स्वस्थ रहो।"], ["b", "स्वसटी। रोज़ पियो, स्वस्थ रहो।"], ["c", "स्वस्टी। रोज़ पियो, स्वस्थ रहो।"]];
  for (const voice of ["Aoede", "Sulafat"]) for (const [k, line] of SPELL) jobs.push((async () => {
    const r = await withRateLimitRetry("tts", () => tts.models.generateContent({ model: env.voiceoverModel, contents: `Warm, clear Indian woman's voice-over for a tea ad, natural pace, every word crisp: ${line}`, config: { responseModalities: ["AUDIO"], speechConfig: { languageCode: "hi-IN", voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }));
    const d = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data; if (!d) return;
    const f = join(rep, `vo2-${voice}-${k}.wav`);
    writeFileSync(f, wav(Buffer.from(d, "base64")));
    console.log(`VO ${voice}-${k}: ${await listen(f, "Transcribe everything said in Devanagari, with times. Then, for the FIRST word only: is its first vowel SHORT (स्वस, like the start of स्वस्थ) or LONG (स्वास)? Is the second part the English word 'tea' (टी)? Answer: SHORT/LONG, TEA yes/no.")}`);
  })().catch((e) => console.error(`vo ${voice}-${k}:`, String(e).slice(0, 120))));

  await Promise.all(jobs);
})();
