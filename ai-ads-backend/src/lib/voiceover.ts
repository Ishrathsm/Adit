import { GoogleGenAI, Type } from "@google/genai";
import { type Tone, type VoiceGender, type VoiceoverLanguage, VOICEOVER_LANGUAGE_NAMES, VOICEOVER_WORDS_PER_SECOND } from "./creative-brief";
import { splitAudioAtPauses, trimSilence } from "./video-stitch";
import { env } from "./env";
import { withRateLimitRetry } from "./rate-limit-retry";

// Voiceover via Gemini TTS on the same Vertex project as Veo/Lyria. (The ElevenLabs key in .env
// can't be used: its free tier was disabled for the account, and music needs a paid plan anyway.)
const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation })
  : null;

// Prebuilt Gemini TTS voices; both handle Hindi, Telugu, Tamil, and English.
const VOICES: Record<VoiceGender, string> = {
  female: process.env.VOICEOVER_VOICE_FEMALE ?? "Aoede",
  male: process.env.VOICEOVER_VOICE_MALE ?? "Charon",
};

// Gemini TTS takes delivery direction in plain language — matched to the film's tone.
const DELIVERY: Record<Tone, string> = {
  premium: "calm, confident, understated, unhurried",
  warm: "warm, gentle, heartfelt, like a trusted friend",
  bold: "energetic, punchy, confident",
  playful: "bright, cheerful, playful, smiling",
  trustworthy: "calm, reassuring, clear, sincere",
};

// English narration defaults to an Indian English accent — the brands and audiences here are
// Indian (the default voice read as American on the Turito ad). Override per deployment.
const ENGLISH_ACCENT = process.env.VOICEOVER_ENGLISH_ACCENT ?? "Indian English";

const SAMPLE_RATE = 24_000; // Gemini TTS returns 16-bit mono PCM at 24kHz

function wavFromPcm(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Gemini TTS takes a BCP-47 language code as well as prompt direction; the code is the stronger
// accent lever (the prompt alone let some reads drift toward a general American sound).
const LANGUAGE_CODES: Record<VoiceoverLanguage, string> = {
  en: process.env.VOICEOVER_ENGLISH_LOCALE ?? "en-IN",
  hi: "hi-IN",
  te: "te-IN",
  ta: "ta-IN",
};

const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").split(/\s+/).filter(Boolean);

// Narration for a video ad (only when the brief asked for a voiceover). Returns WAV bytes.
export async function synthesizeVoiceover(
  text: string,
  language: VoiceoverLanguage,
  gender: VoiceGender,
  tone: Tone,
  // The director's performance notes (pace, energy, pauses, emphasis), when the script has them.
  direction?: string | null,
  // A cast voice: who is speaking (replaces the default young narrator) and which prebuilt voice.
  cast?: { voice: string; persona: string; accent?: string },
): Promise<Buffer> {
  if (!genAI) throw new Error("Voiceover is not configured — missing GOOGLE_CLOUD_PROJECT_ID");

  const response = await withRateLimitRetry("voiceover", () =>
    genAI.models.generateContent({
      model: env.voiceoverModel,
      contents: `Read this ${VOICEOVER_LANGUAGE_NAMES[language]} advertisement voiceover aloud as ${cast ? cast.persona : gender === "female" ? "a young woman" : "a young man"} speaking with a natural ${language === "en" ? cast?.accent ?? ENGLISH_ACCENT : `native ${VOICEOVER_LANGUAGE_NAMES[language]}`} accent, in a ${DELIVERY[tone]} voice, with natural pauses between sentences.${direction ? ` Performance notes: ${direction}.` : ""}${
        // One- or two-word lines made TTS improvise ("Korikey!" came back repeated, with an invented
        // sentence after it), so short lines are pinned down hard.
        words(text).length <= 3 ? ` The line is only ${words(text).length === 1 ? "this one word" : "these few words"}: say ${words(text).length === 1 ? "it" : "them"} exactly once, then stop. Say nothing else — no repeats, no extra words.` : ""
      } The voiceover: ${text}`,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { languageCode: LANGUAGE_CODES[language], voiceConfig: { prebuiltVoiceConfig: { voiceName: cast?.voice ?? VOICES[gender] } } },
      },
    }),
  );

  const data = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
  if (!data) throw new Error("Voiceover generation returned no audio");
  return wavFromPcm(Buffer.from(data, "base64"));
}

// Gemini TTS is unreliable on its own: it sometimes repeats a line three times, adds words that
// were never in the script, or fails outright. Every take is checked before it is used.
const checker = env.googleCloudProjectId ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation }) : null;
const MAX_TAKES = 3;


// A take passes when its length is plausible for the words (repeats double or triple it) and a
// transcript of it matches the script closely, with nothing substantial added.
async function takeMatches(wav: Buffer, script: string): Promise<boolean> {
  const seconds = (wav.length - 44) / (SAMPLE_RATE * 2);
  // Romanized Telugu (and other Indian languages written in Latin letters) packs more syllables per
  // word than English, so a word-count estimate of its length needs a slower rate.
  const latinIndic = !/^[\x00-\x7F…’‘“”—–]*$/.test(script) ? false : !/\b(the|and|is|of|to|you|your|a)\b/i.test(script);
  const expected = words(script).length / (latinIndic ? 1.6 : VOICEOVER_WORDS_PER_SECOND);
  if (seconds > expected * 1.9 + 1.5 || seconds < expected * 0.35) {
    console.warn(`[voiceover] take rejected: ${seconds.toFixed(1)}s for ~${expected.toFixed(1)}s of script`);
    return false;
  }
  if (!checker) return true;
  if (latinIndic) return judgeTake(wav, script);
  try {
    const r = await withRateLimitRetry("voiceover-check", () =>
      checker.models.generateContent({
        model: env.imageCheckModel,
        contents: [{ inlineData: { data: wav.toString("base64"), mimeType: "audio/wav" } }, "Write only the exact words spoken in this recording, nothing else."],
      }),
    );
    const heard = words(r.text ?? "");
    const want = new Set(words(script));
    const extra = heard.filter((w) => !want.has(w)).length;
    const missing = [...want].filter((w) => !heard.includes(w)).length;
    const ok = extra <= Math.max(1, want.size * 0.15) && missing <= Math.max(1, want.size * 0.15);
    if (!ok) console.warn(`[voiceover] take rejected: heard "${r.text?.trim().slice(0, 120)}"`);
    return ok;
  } catch {
    return true; // a failed check shouldn't block the voiceover; the length check already ran
  }
}

// Word matching fails when the script is an Indian language written in English letters: the
// transcript comes back in the native script, so every take looked wrong. Instead the model listens
// against the expected line and judges it — every word, nothing added, no other language.
async function judgeTake(wav: Buffer, script: string): Promise<boolean> {
  try {
    const r = await withRateLimitRetry("voiceover-check", () =>
      checker!.models.generateContent({
        model: env.imageCheckModel,
        contents: [
          { inlineData: { data: wav.toString("base64"), mimeType: "audio/wav" } },
          `The recording should say exactly this line (an Indian language written in English letters): "${script}". Does it say every word of that line, once, in that language, with nothing added and no repeats? Answer as JSON.`,
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: { type: Type.OBJECT, properties: { matches: { type: Type.BOOLEAN }, heard: { type: Type.STRING } }, required: ["matches", "heard"] },
        },
      }),
    );
    const { matches, heard } = JSON.parse(r.text ?? "{}") as { matches?: boolean; heard?: string };
    // The judge sometimes says no to a take whose own transcript is the line; trust a close spelling.
    if (matches || similarity(heard ?? "", script) >= 0.85) return true;
    console.warn(`[voiceover] take rejected: heard "${(heard ?? "").slice(0, 120)}"`);
    return false;
  } catch {
    return true;
  }
}

// 0–1 closeness of two lines by letters only (spacing, punctuation and case ignored).
function similarity(a: string, b: string): number {
  const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const x = norm(a), y = norm(b);
  if (!x.length || !y.length) return 0;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}

async function verifiedTake(script: string, read: () => Promise<Buffer>): Promise<Buffer> {
  let last: Buffer | null = null;
  let lastError: unknown = null;
  for (let take = 0; take < MAX_TAKES; take++) {
    try {
      const wav = await trimSilence(await read()).catch(async () => read());
      if (await takeMatches(wav, script)) return wav;
      last = wav;
    } catch (err) {
      lastError = err;
    }
  }
  if (last) return last;
  throw lastError ?? new Error("Voiceover generation failed");
}

// Narration written per shot: read as ONE take (so it flows as a single performance) with a pause
// between lines, then split at those pauses so each line can be placed on its own shot. Falls back
// to separately read, separately verified lines when the pauses can't be found.
export async function synthesizeVoiceoverLines(
  lines: (string | null)[],
  language: VoiceoverLanguage,
  gender: VoiceGender,
  tone: Tone,
  direction?: string | null,
  cast?: { voice: string; persona: string; accent?: string },
): Promise<{ shot: number; audio: Buffer }[]> {
  const spoken = lines.flatMap((line, shot) => (line?.trim() ? [{ shot, text: line.trim() }] : []));
  if (!spoken.length) return [];
  const script = spoken.map((l) => l.text).join(" ");
  const pausedDirection = [direction, `Read it as ${spoken.length} separate lines with a clear one-second pause after each line; read every line exactly once, word for word, and add nothing`]
    .filter(Boolean)
    .join(". ");
  try {
    const take = await verifiedTake(script, () =>
      synthesizeVoiceover(spoken.map((l) => l.text).join("\n"), language, gender, tone, pausedDirection, cast),
    );
    const pieces = await splitAudioAtPauses(take, spoken.length);
    if (pieces) return pieces.map((audio, i) => ({ shot: spoken[i].shot, audio }));
    console.warn("[voiceover] couldn't find the pauses between lines, reading lines separately");
  } catch (err) {
    console.warn("[voiceover] one-take narration failed, reading lines separately:", err instanceof Error ? err.message : err);
  }
  const out: { shot: number; audio: Buffer }[] = [];
  for (const l of spoken) {
    out.push({ shot: l.shot, audio: await verifiedTake(l.text, () => synthesizeVoiceover(l.text, language, gender, tone, direction, cast)) });
  }
  return out;
}

// A film with speaking characters: vo lines hold "NAME: line" segments (one per line of text) next
// to plain narration. The narration is still read as one flowing take by the narrator; each
// character line is read separately in that character's cast voice. A shot's segments are joined in
// order with a short pause (longer before a reply, so a question can land), one clip per shot.
export async function synthesizeCastLines(
  lines: (string | null)[],
  language: VoiceoverLanguage,
  cast: Record<string, { voice: string; persona: string; accent?: string }>,
  tone: Tone,
  direction?: string | null,
): Promise<{ shot: number; audio: Buffer }[]> {
  const segments = lines.flatMap((line, shot) =>
    (line ?? "")
      // Models sometimes write the break between two speakers as a literal "\\n".
      .split(/\r?\n|\\n/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const m = part.match(/^([A-Z][A-Z .'-]{1,30}):\s*(.+)$/);
        const speaker = m && cast[m[1].trim()] ? m[1].trim() : "NARRATOR";
        return { shot, speaker, text: m && speaker !== "NARRATOR" ? m[2].trim() : part };
      }),
  );
  if (!segments.length) return [];
  const narrator = cast.NARRATOR;
  const narration = segments.filter((s) => s.speaker === "NARRATOR");
  const audio = new Map<(typeof segments)[number], Buffer>();
  // Narration lines in a cast film sit shots apart, so each is read and verified on its own (one
  // long take split at its pauses mis-cut them).
  for (const seg of narration) {
    audio.set(seg, await verifiedTake(seg.text, () => synthesizeVoiceover(seg.text, language, "female", tone, direction, narrator)));
  }
  for (const seg of segments.filter((s) => s.speaker !== "NARRATOR")) {
    audio.set(seg, await verifiedTake(seg.text, () => synthesizeVoiceover(seg.text, language, "male", tone, null, cast[seg.speaker])));
  }
  const byShot = new Map<number, Buffer[]>();
  segments.forEach((seg, i) => {
    const clip = audio.get(seg);
    if (!clip) return;
    const parts = byShot.get(seg.shot) ?? [];
    // A reply waits a beat after the line before it (the dragon's question, then "Korikey!").
    if (parts.length) parts.push(silence(segments[i - 1]?.text.trim().endsWith("?") ? 0.9 : 0.35));
    parts.push(pcmOf(clip));
    byShot.set(seg.shot, parts);
  });
  return [...byShot.entries()].map(([shot, parts]) => ({ shot, audio: wavFromPcm(Buffer.concat(parts)) }));
}

const pcmOf = (wav: Buffer) => wav.subarray(44);
const silence = (seconds: number) => Buffer.alloc(Math.round(seconds * SAMPLE_RATE) * 2);
