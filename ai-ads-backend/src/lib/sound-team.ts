import { GoogleGenAI, Type } from "@google/genai";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "./env";
import { withRateLimitRetry } from "./rate-limit-retry";

// The sound team, alongside the ad direction team: a music director, a voice and dialogue
// director, a sound designer and a mixer plan the film's sound from its strategy and scenes, then
// a reviewer listens to every music take. Added after the user asked for one team to own
// background music and vocals — the earlier films' sound problems (a bed too loud under the voice,
// the brand name sounding like a rival's, dropped and mispronounced lines) were all sound calls
// nobody owned.

const genAI = env.googleCloudProjectId ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation }) : null;

export interface SoundScene {
  shot: number;
  seconds: string;
  action: string;
  line: string | null;
  speaker: string | null;
}

export interface SoundPlan {
  music: {
    idea: string;
    instruments: string[];
    mood: string;
    tempo: string;
    // How the energy moves across the film, shot by shot.
    curve: string;
    prompts: string[];
    avoid: string[];
  };
  voices: { character: string; casting: string; delivery: string; source: "veo" | "voiceover" }[];
  lines: { shot: number; speaker: string; line: string; delivery: string; risks: string[] }[];
  sfx: { shot: number; cues: string[] }[];
  mix: { musicUnderDialogueDb: number; musicAloneDb: number; dialogueLufs: number; notes: string[] };
  // Words to isolate and check after generation (brand names, invented or easily misheard words).
  checkWords: { word: string; say: string; mustNotSoundLike: string[] }[];
  review: { approved: boolean; notes: string[] };
}

const STR = { type: Type.STRING };
const STRS = { type: Type.ARRAY, items: STR };
const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    music: {
      type: Type.OBJECT,
      properties: { idea: STR, instruments: STRS, mood: STR, tempo: STR, curve: STR, prompts: STRS, avoid: STRS },
      required: ["idea", "instruments", "mood", "tempo", "curve", "prompts", "avoid"],
    },
    voices: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { character: STR, casting: STR, delivery: STR, source: { type: Type.STRING, enum: ["veo", "voiceover"] } }, required: ["character", "casting", "delivery", "source"] },
    },
    lines: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { shot: { type: Type.NUMBER }, speaker: STR, line: STR, delivery: STR, risks: STRS }, required: ["shot", "speaker", "line", "delivery", "risks"] },
    },
    sfx: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { shot: { type: Type.NUMBER }, cues: STRS }, required: ["shot", "cues"] } },
    mix: {
      type: Type.OBJECT,
      properties: { musicUnderDialogueDb: { type: Type.NUMBER }, musicAloneDb: { type: Type.NUMBER }, dialogueLufs: { type: Type.NUMBER }, notes: STRS },
      required: ["musicUnderDialogueDb", "musicAloneDb", "dialogueLufs", "notes"],
    },
    checkWords: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { word: STR, say: STR, mustNotSoundLike: STRS }, required: ["word", "say", "mustNotSoundLike"] },
    },
  },
  required: ["music", "voices", "lines", "sfx", "mix", "checkWords"],
};

// What the team knows from our own films; every plan is checked against it.
const LESSONS = `Our own lessons:
- The music bed at full level drowned the voice (Aurelle): under dialogue the bed sits about 18–22 dB below the voice, and it may come up only where nobody speaks.
- Veo said the invented brand "Aurelle" as "aw-RAY-el", which sounds like L'Oréal: every invented or brand word gets a pronunciation note and a check, and if it can be misheard as a rival, the line is rewritten so the brand is shown, not spoken.
- Veo said "Seriously" as "serially" and dropped the last line when one 8-second clip held about 20 words plus several actions: at most about 12–14 spoken words per 8-second clip, one speaker per clip, and the line ends at least 1.5s before the clip does.
- Prompting "Instagram" made Veo paint the Instagram logo: never name a platform or a real brand anywhere in a prompt.
- Lyria refused a prompt as too close to existing music: describe moods, instruments and forms, never a named song or composer; "inspired by the mood of a raga" is fine.
- Text-to-speech read soft lines slowly (about 5s for 8 words): when a voice-over is used, size the shots to the read.`;

// How ads are scored (knowledge/music-scoring-for-ads.md): an underscore written to picture, not a song.
// Added after every Swastea santoor take came out "more like a song" (2026-10-08).
const SCORING = (() => {
  const f = [join(__dirname, "../../../knowledge/music-scoring-for-ads.md"), join(__dirname, "../../knowledge/music-scoring-for-ads.md")].find(existsSync);
  return f ? readFileSync(f, "utf8") : "";
})();

export async function planSound(concept: string, scenes: SoundScene[], direction: string): Promise<SoundPlan> {
  if (!genAI) throw new Error("Text generation is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  const shared = `The film: "${concept}"
Direction from the client: ${direction}

Scenes:
${scenes.map((s) => `${s.shot}. [${s.seconds}] ${s.action}${s.line ? ` — ${s.speaker}: "${s.line}"` : ""}`).join("\n")}

${LESSONS}${SCORING ? `\n\nHOW ADS ARE SCORED (follow this; the music is an underscore built from stems by role, not a song):\n${SCORING}` : ""}`;
  const fields = `Return JSON:
- music: idea (one sentence), instruments, mood, tempo, curve (how the energy moves shot by shot, and where it must stay low under dialogue), prompts (two alternative prompts for an AI music model, each 40–70 words: moods, instruments, form; never a named song, composer or artist; "no vocals" unless vocals are wanted), avoid.
- voices: for each speaking character, casting (age, region, accent, timbre), delivery, source ("veo" = the video model speaks on camera with lip sync; "voiceover" = recorded separately).
- lines: every spoken line, with the shot, speaker, the exact words (Hinglish in Roman script), delivery notes, and risks (words a model may mispronounce or drop, lines too long for the clip).
- sfx: for each shot, 1–4 natural sound cues (room tone counts).
- mix: musicUnderDialogueDb and musicAloneDb (music level relative to the dialogue, negative dB), dialogueLufs, notes.
- checkWords: brand and invented words to isolate and check after generation, how each must be said, and what it must not sound like.`;
  const draft = await json<Omit<SoundPlan, "review">>(
    "sound-plan",
    `You are the sound team on an Indian ad agency's film: a music director, a voice and dialogue director, a sound designer and a mixer, working together. Plan the whole soundtrack.\n\n${shared}\n\n${fields}`,
    SCHEMA,
  );
  // The supervising sound editor: checks the plan against the lessons and the scenes, and fixes it.
  const reviewed = await json<Omit<SoundPlan, "review"> & { approved: boolean; review_notes: string[] }>(
    "sound-review",
    `You are the supervising sound editor. Check the sound team's plan and return it corrected in the same JSON shape, plus approved and review_notes (what you changed and why).
Check: does every spoken line fit its clip (about 12–14 words per 8s, ending 1.5s early)? Is every brand or invented word in checkWords with a pronunciation and the rivals it must not sound like? Is the music level low enough under dialogue? Do the music prompts avoid named songs, composers and artists? Does the music match the client's direction exactly? Are the sound cues real and quiet enough for the film's tone?

${shared}

${fields}
- approved, review_notes.

The plan:
${JSON.stringify(draft, null, 2)}`,
    { ...SCHEMA, properties: { ...SCHEMA.properties, approved: { type: Type.BOOLEAN }, review_notes: STRS }, required: [...SCHEMA.required, "approved", "review_notes"] },
  );
  const { approved, review_notes, ...plan } = reviewed;
  return { ...plan, review: { approved: Boolean(approved), notes: review_notes ?? [] } };
}

// The music director listens to a take: right instruments and mood, no vocals or drums unless wanted,
// nothing that sounds like a famous melody.
export async function reviewMusicTake(wav: Buffer, plan: SoundPlan): Promise<{ ok: boolean; notes: string }> {
  if (!genAI) return { ok: true, notes: "not checked" };
  const r = await withRateLimitRetry("music-review", () =>
    genAI.models.generateContent({
      model: env.textModel,
      contents: [
        { inlineData: { data: wav.toString("base64"), mimeType: "audio/wav" } },
        `You are the music director. The brief: ${plan.music.idea} Instruments: ${plan.music.instruments.join(", ")}. Mood: ${plan.music.mood}. Avoid: ${plan.music.avoid.join(", ")}.
Listen and answer in 3–5 short lines: does it play as an ad underscore (sparse, leaving space for dialogue) or as a song (a continuous melody that would fight the lines)? which instruments you hear; the mood; any vocals, drums or percussion; anything harsh, sudden or out of mood; whether it sounds like a famous melody. End with a line "VERDICT: OK" or "VERDICT: REJECT — <reason>".`,
      ],
    }),
  );
  const notes = r.text?.trim() ?? "";
  return { ok: /VERDICT:\s*OK/i.test(notes), notes };
}

async function json<T>(label: string, contents: string, schema: object): Promise<T> {
  const response = await withRateLimitRetry(label, () =>
    genAI!.models.generateContent({ model: env.textModel, contents, config: { responseMimeType: "application/json", responseSchema: schema } }),
  );
  if (!response.text) throw new Error(`${label} returned no text`);
  return JSON.parse(response.text) as T;
}
