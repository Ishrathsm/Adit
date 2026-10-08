// Swastea music team, round 3 (user, 2026-10-08): "make the music faint and it should be happy and
// slow paced... only santoor is enough and some natural sound... make use of music team effectively
// vocals, hum, bg, music... creative music... increase temperature".
// Three composers pitch at high temperature, the music director picks and writes the cue sheet and
// the santoor melody (sargam, beats) at low temperature. Text only.
// `npx tsx eval/swastea-music-team.ts` → eval/out/swastea-team/music-*.md, music-final.json
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "../src/lib/env";
import { withRateLimitRetry } from "../src/lib/rate-limit-retry";

const out = join(__dirname, "out", "swastea-team");
const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
const PICTURE = `Swastea 30s film (plan v3), sincere and warm, no humour, Hinglish dialogue:
- 0–3.5s: a young man with a cold at the neighbour's door, "Aunty, thodi adrak milegi?", sneeze.
- 3.5–6.5s: Aunty, concerned: "Lagta hai zukaam hai."
- 6.5–9s: "Andar aao, beta." She walks him in.
- 9–12s: kitchen close-ups: Swastea spooned into boiling chai, poured through a strainer into a steel cup.
- 12–16.5s: THE SIP. Eyes close, a golden mandala glows and turns behind his head, relief, "Aah… kitna aaram mila."
- 16.5–20s: "Aunty, bilkul maa ke haath jaisi."
- 20–24s: he picks up the Swastea pack and reads it; Aunty off-screen: "Adrak, ashwagandha aur tulsi se bani hai."
- 24–30s: pack hero on the kitchen counter; a female VO: "Swastea. Roj piyo, swasth raho."; logo and tagline.`;
const BRIEF = `${PICTURE}

Music brief from the user:
- FAINT in the mix, under the dialogue.
- HAPPY but SLOW-paced: gentle and smiling, never fast, never gloomy or sad.
- SANTOOR is the only instrument. No tanpura, strings, tabla, flute or drums.
- Natural sounds belong in the soundtrack: morning birds, the chai boiling, the spoon, the pour, home ambience.
- Use human VOICES creatively: a soft female hum, a women's wordless chorus "dhi-re-naaa" on the sip (only there, entering and leaving smoothly), maybe a breathy vocal texture. Make it a creative, memorable, warm score, a real sound identity for the brand.
Tools: Google Lyria can make ~30s takes of santoor and/or wordless voices (it can't hold exact syllables or tempo). I can also COMPOSE the santoor part note by note (MIDI, rendered with a hammered-dulcimer sample) exactly to picture, and layer voice takes and natural sounds in the edit.`;

const gen = (prompt: string, temperature: number) =>
  withRateLimitRetry("music-team", () => ai.models.generateContent({ model: env.textModel, contents: prompt, config: { temperature, topP: 0.97 } }));

(async () => {
  const pitches = await Promise.all([1, 2, 3].map(async (i) => {
    const r = await gen(`You are composer #${i} on an Indian ad film's music team. Be bold and original, and don't play it safe. ${BRIEF}

Pitch ONE distinct, creative concept (different from the obvious). Give:
- the name and a one-line idea;
- the raga or scale and why it smiles;
- the tempo in BPM, which must be slow, about 66–84;
- the santoor's role and its signature motif, written in sargam;
- where the hum, chorus and any other vocal textures come in, and what they do emotionally;
- the natural-sound design per shot;
- how the music lands on the pack and becomes the brand's sonic signature;
- a cue sheet against the picture timings.`, 1.4);
    const t = r.text?.trim() ?? "";
    writeFileSync(join(out, `music-pitch-${i}.md`), t);
    console.log(`pitch ${i} done`);
    return t;
  }));

  const r = await gen(`You are the music director. Three composers pitched:\n\n${pitches.map((p, i) => `=== PITCH ${i + 1}\n${p}`).join("\n\n")}\n\n${BRIEF}

Pick the strongest pitch, borrowing the best ideas from the others, and write the FINAL plan so I can build it exactly. Output ONLY JSON:
{
 "chosen": string, "why": string,
 "raga": string, "tonic": "C"|"C#"|"D"|"D#"|"E"|"F"|"F#"|"G"|"G#"|"A"|"A#"|"B", "bpm": number,
 "santoor": [{"bar": number, "beat": number, "sargam": string, "beats": number, "tremolo": boolean, "velocity": number}],
 "santoorNotes": string,
 "vocals": [{"name": string, "start": number, "end": number, "fadeIn": number, "fadeOut": number, "level_db": number, "lyriaPrompt": string, "role": string}],
 "nature": [{"sound": string, "start": number, "end": number, "level_db": number}],
 "mix": string,
 "signature": string
}
Rules for the santoor list:
- It covers the whole 30s at the chosen bpm, which must be slow (66–84).
- The sargam uses S r R g G m M P d D n N with ' for the upper octave and . for the lower octave (e.g. "S", "R", "G", "P", "D", "S'", "N.").
- "bar" and "beat" are 1-based in 4/4.
- Include rests as sargam "-".
- Use tremolo for held notes (the santoor technique).
- Make the melody sing: a happy, memorable motif stated early, varied in the kitchen, opening on the sip, and resolving to a short signature on the pack. Keep it sparse under dialogue.
- Vocals' start/end are in film seconds.`, 0.4);
  const t = (r.text?.trim() ?? "").replace(/^```json\s*|```\s*$/g, "");
  writeFileSync(join(out, "music-final.json"), t);
  const p = JSON.parse(t);
  console.log(`\nCHOSEN: ${p.chosen}\nWHY: ${p.why}\nRAGA ${p.raga} · tonic ${p.tonic} · ${p.bpm} bpm · ${p.santoor.length} santoor events\nSANTOOR: ${p.santoorNotes}`);
  for (const v of p.vocals) console.log(`VOCAL ${v.name} ${v.start}–${v.end}s (${v.level_db} dB): ${v.role}`);
  for (const n of p.nature) console.log(`NATURE ${n.sound} ${n.start}–${n.end}s ${n.level_db} dB`);
  console.log(`MIX: ${p.mix}\nSIGNATURE: ${p.signature}`);
})().catch((e) => { console.error(e); process.exit(1); });
