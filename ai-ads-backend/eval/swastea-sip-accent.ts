// Swastea's sip accent (user, 2026-10-08): "draft 3 is good, but dhirena is very loud and its not
// suiting... replace something captivating at the place of dheerena". Four traditional candidates for the
// sip moment, where the mandala glows: swarmandal shimmer, bansuri phrase, jal tarang cascade, santoor glow.
// All in Raag Pahadi on D to match draft 3. Each take is screened and its loudest swell located.
// `npx tsx eval/swastea-sip-accent.ts` → ~/Desktop/swastea/music/accent/*.wav
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "../src/lib/env";
import { generateMusic } from "../src/lib/music";

const out = join(homedir(), "Desktop", "swastea", "music", "accent");
const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
const listen = async (f: string, q: string) => (await ai.models.generateContent({ model: env.textModel, contents: [{ inlineData: { data: readFileSync(f).toString("base64"), mimeType: "audio/wav" } }, q] })).text?.trim().replace(/\n+/g, " ");
const NEG = "vocals, singing, voice, drums, tabla, synth, electronic, guitar, piano, sad, gloomy, fast, song";
const TAKES: [string, string][] = [
  ["swarmandal", "A swarmandal (Indian zither) played with slow, shimmering upward glissandos, like golden light spreading, each sweep blooming and ringing out into silence, then a pause before the next sweep. Raag Pahadi, tonic D. Magical, warm, joyful, very gentle. Solo swarmandal only."],
  ["bansuri", "Solo bansuri flute: a single soaring, breathy, happy phrase rising slowly to a long held note that blooms and gently fades, then silence, then another similar phrase. Raag Pahadi, tonic D. Warm, uplifting, like a sigh of relief on a sunny morning. Only bansuri."],
  ["jaltarang", "Jal tarang (tuned water bowls) playing gentle twinkling cascades that sparkle upward and ring softly into silence, with pauses between cascades. Raag Pahadi, tonic D. Delicate, magical, smiling, like drops of light. Only jal tarang."],
  ["santoor-glow", "Solo santoor: a soft tremolo that slowly rises in pitch and volume like a glow spreading, opens into a bright, happy shimmering chord, then softly fades into silence; pauses, then repeats with variation. Raag Pahadi, tonic D. Only santoor."],
];
(async () => {
  mkdirSync(out, { recursive: true });
  await Promise.all(TAKES.flatMap(([k, p]) => [1, 2].map((t) => generateMusic(p, undefined, NEG).then(async (b) => {
    const f = join(out, `${k}-${t}.wav`);
    writeFileSync(f, b);
    console.log(`${k}-${t}: ${await listen(f, "This will play softly for 3–4 seconds at the emotional peak of a warm Indian tea ad (a man sips tea, eyes close, a golden glow appears behind him). One line: instruments heard; is it captivating, magical and happy (not sad, not busy)? any voices or drums? Then SCORE n/10.")}`);
  }).catch((e) => console.error(`${k}-${t}:`, String(e).slice(0, 120))))));
})();
