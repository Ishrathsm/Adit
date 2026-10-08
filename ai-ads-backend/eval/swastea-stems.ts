// Swastea score as stems (user, 2026-10-08: the santoor takes were "more like a song... learn how
// music is scored for ads... teach this to music team"). The music director, given
// knowledge/music-scoring-for-ads.md, writes one prompt per stem role (bed, motif, bloom, button) for the
// picture; Lyria makes two takes of each; each take is screened for its role ("underscore, not song").
// v2 (user, 2026-10-08, on draft 1): "make it happier and sparser". The director is told Raag Desh read
// as pensive. `npx tsx eval/swastea-stems.ts [v2]` → ~/Desktop/swastea/music/stems[-v2]/*.wav, eval/out/swastea-team/stems-plan[-v2].json
import "../src/lib/gcp-credentials-bootstrap";
import { GoogleGenAI } from "@google/genai";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "../src/lib/env";
import { generateMusic } from "../src/lib/music";

const V = process.argv[2] ? `-${process.argv[2]}` : "";
const out = join(homedir(), "Desktop", "swastea", "music", `stems${V}`);
const ai = new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation });
const LESSON = readFileSync(join(__dirname, "..", "..", "knowledge", "music-scoring-for-ads.md"), "utf8");
const PICTURE = readFileSync(join(__dirname, "swastea-music-team.ts"), "utf8").match(/const PICTURE = `([\s\S]*?)`;/)![1];
const listen = async (f: string, q: string) => (await ai.models.generateContent({ model: env.textModel, contents: [{ inlineData: { data: readFileSync(f).toString("base64"), mimeType: "audio/wav" } }, q] })).text?.trim().replace(/\n+/g, " ");

(async () => {
  mkdirSync(out, { recursive: true });
  const r = await ai.models.generateContent({
    model: env.textModel,
    config: { temperature: 0.5, responseMimeType: "application/json" },
    contents: `You are the music director. Study this lesson on how ads are scored and follow it exactly:\n\n${LESSON}\n\nTHE FILM:\n${PICTURE}\n\nTHE USER'S BRIEF:
- Faint.
- Happy but slow.
${V === "-v3" ? "- ANY traditional Indian instruments (user, 2026-10-08: \"dont just fix on santoor, u can use any instruments just use traditional ones\"): e.g. bansuri, santoor, sitar, sarod, shehnai, sarangi, harmonium, jal tarang, veena, light tabla or dholak, manjira, ghungroo. Choose a small, characterful palette per stem; no western or electronic instruments." : "- Santoor is the ONLY instrument."}
- Natural sounds come from the shots.
- A women's wordless "dhi-re-naaa" chorus on the sip only (we already have it, in D-ish).
- It must NOT sound like a song.${V ? `
FEEDBACK ON DRAFT 1 (from the user): "make it happier and sparser". Draft 1 in Raag Desh read as pensive and too melodic. So choose a BRIGHT, smiling raga (e.g. Bilawal, Pahadi or Khamaj, your call), keep tonic D, and make every stem sparser: fewer notes, more air, short phrases, light and sunny strokes; the bed is mostly silence with a few high shimmering notes.` : ""}
Plan the score as stems by role${V === "-v3" ? " (choose the best traditional instrument(s) for each role)" : ", all santoor"}, all with tonic D in the raga you choose, and write a Lyria prompt for each. Return JSON:
{"spotting": string (the cue sheet against picture seconds: where music is silent, where the bed sits under lines, the hush, the bloom, the button; max 3 sync points),
 "stems": [{"role": "bed"|"motif"|"bloom"|"button", "prompt": string (40–70 words, names the instrument(s), says tonic D and the raga, says exactly what to play and what NOT to play), "place": string (film seconds and how it enters and leaves), "level": string}]}
Give exactly 4 stems: bed, motif, bloom, button.`,
  });
  const plan = JSON.parse((r.text ?? "").replace(/^```json\s*|```\s*$/g, ""));
  writeFileSync(join(__dirname, "out", "swastea-team", `stems-plan${V}.json`), JSON.stringify(plan, null, 2));
  console.log(`SPOTTING: ${plan.spotting}\n`);
  for (const s of plan.stems) console.log(`${s.role.toUpperCase()} @ ${s.place} (${s.level})\n  ${s.prompt}\n`);
  const NEG = V === "-v3" ? "synth, electronic, drum kit, bass guitar, guitar, piano, orchestra, vocals, sad, gloomy, pensive, melancholic, minor, fast, song" : "tabla, drums, percussion, beat, synth, bass, tanpura, drone instrument, strings, flute, sitar, guitar, piano, vocals, sad, gloomy, pensive, melancholic, minor, fast, song";
  const Q: Record<string, string> = {
    bed: "As an ad UNDERSCORE BED to sit under dialogue: is it sparse texture with NO continuous melody (good) or a song-like melody (bad)? Only traditional Indian instruments (which)? Is it HAPPY (bright, smiling) and SPARSE? One line, then SCORE n/10.",
    motif: "We need ONE short santoor motif (3–5 notes) we can lift cleanly. Is there a short, memorable, happy phrase with silence around it? Give its start–end seconds if so. Only traditional Indian instruments (which)? Happy? One line, then SCORE n/10.",
    bloom: "For the emotional peak: does it swell gently and release softly, warm and HAPPY (not pensive), sparse, not a full song? Only traditional Indian instruments (which)? One line, then SCORE n/10.",
    button: "We need a short, clean santoor ending phrase (a sonic logo) that resolves brightly. Is there one, and where (start–end s)? Only traditional Indian instruments (which)? Happy? One line, then SCORE n/10.",
  };
  await Promise.all(plan.stems.flatMap((s: { role: string; prompt: string }) => [1, 2].map((t) =>
    generateMusic(s.prompt, undefined, NEG).then(async (b) => {
      const f = join(out, `${s.role}-${t}.wav`);
      writeFileSync(f, b);
      console.log(`${s.role}-${t}: ${await listen(f, Q[s.role])}`);
    }).catch((e) => console.error(`${s.role}-${t}:`, String(e).slice(0, 120))))));
})().catch((e) => { console.error(e); process.exit(1); });
