// Swastea music takes (user, 2026-10-08): happy but SLOW, santoor only, plus voice layers (a warm female
// hum) and natural morning ambience. The composed MIDI santoor sounded like a cheap synth (4/10), so the
// santoor comes from Lyria, whose solo santoor sounds like a real player. Every take is screened.
// `npx tsx eval/swastea-music-takes.ts` → ~/Desktop/swastea/music/*.wav
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "../src/lib/env";
import { generateMusic } from "../src/lib/music";

const dir = join(homedir(), "Desktop", "swastea", "music");
const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
const listen = async (f: string, q: string) => (await ai.models.generateContent({ model: env.textModel, contents: [{ inlineData: { data: readFileSync(f).toString("base64"), mimeType: "audio/wav" } }, q] })).text?.trim().replace(/\n+/g, " ");
const NO_OTHERS = "tabla, drums, percussion, beat, synth, bass, tanpura, drone, strings, flute, sitar, guitar, piano, vocals, sad, gloomy, minor, fast";
const TAKES: [string, string, string, string][] = [
  ["santoor-hum-a", "Solo santoor playing a happy, gentle, slow melody in Raag Desh, and a woman softly hums along with closed lips ('mmm'), warm and motherly, wordless; just these two: one santoor and one humming female voice. Relaxed, smiling, homely morning.", "male voice, words, lyrics, tabla, drums, percussion, strings, flute, synth, sad", "SH"],
  ["santoor-hum-b", "A tender, cheerful duet of a single santoor and a woman's soft wordless humming, slow tempo, bright major raga, intimate and close like a mother humming in the kitchen while the santoor plays. Nothing else.", "male voice, words, lyrics, tabla, drums, percussion, strings, flute, synth, sad", "SH"],
  ["santoor-c", "Unaccompanied santoor, slow and happy: a warm, homely, optimistic melody in Raag Khamaj, relaxed tempo, delicate hammered notes and shimmering tremolo, feels like a smile and a cup of tea. Solo instrument only.", NO_OTHERS, "SANT"],
  ["ambience-a", "Calm morning ambience recorded inside an Indian home: gentle birdsong through an open window, soft room tone, very distant street murmur. Pure environmental sound, no music.", "music, melody, instruments, singing, drums, rhythm", "AMB"],
];
const Q: Record<string, string> = {
  SH: "One line: instruments heard (only santoor + a female humming voice? yes/no); any words or male voice; tempo; mood (happy/neutral/gloomy). Then SCORE n/10 for 'happy, slow, solo santoor with a soft female hum'.",
  SANT: "One line: instruments heard (ONLY santoor? yes/no); tempo (slow/medium/fast); mood (happy/neutral/gloomy); realism. Then SCORE n/10 for 'happy, slow, solo santoor, real-sounding'.",
  HUM: "One line: is it ONLY a female voice humming (no instruments, no words)? mood; tempo; pleasant? Then SCORE n/10 for 'warm happy slow female hum, voice only'.",
  AMB: "One line: what you hear; any music or instruments (yes/no)? Then SCORE n/10 for 'natural morning home ambience with birds, no music'.",
};
(async () => {
  await Promise.all(TAKES.map(([k, p, neg, q]) => generateMusic(p, undefined, neg).then(async (b) => {
    const f = join(dir, `${k}.wav`); writeFileSync(f, b);
    console.log(`${k}: ${await listen(f, Q[q])}`);
  }).catch((e) => console.error(`${k}:`, String(e).slice(0, 140)))));
})();
