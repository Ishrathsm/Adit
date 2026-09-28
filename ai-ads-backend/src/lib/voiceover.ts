import { GoogleGenAI } from "@google/genai";
import { type Tone, type VoiceGender, type VoiceoverLanguage, VOICEOVER_LANGUAGE_NAMES, VOICEOVER_WORDS_PER_SECOND } from "./creative-brief";
import { splitAudioAtPauses } from "./video-stitch";
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

// Narration for a video ad (only when the brief asked for a voiceover). Returns WAV bytes.
export async function synthesizeVoiceover(
  text: string,
  language: VoiceoverLanguage,
  gender: VoiceGender,
  tone: Tone,
  // The director's performance notes (pace, energy, pauses, emphasis), when the script has them.
  direction?: string | null,
): Promise<Buffer> {
  if (!genAI) throw new Error("Voiceover is not configured — missing GOOGLE_CLOUD_PROJECT_ID");

  const response = await withRateLimitRetry("voiceover", () =>
    genAI.models.generateContent({
      model: env.voiceoverModel,
      contents: `Read this ${VOICEOVER_LANGUAGE_NAMES[language]} advertisement voiceover aloud as a ${gender === "female" ? "young woman" : "young man"} speaking with a natural ${language === "en" ? ENGLISH_ACCENT : `native ${VOICEOVER_LANGUAGE_NAMES[language]}`} accent, in a ${DELIVERY[tone]} voice, with natural pauses between sentences.${direction ? ` Performance notes: ${direction}.` : ""} The voiceover: ${text}`,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { languageCode: LANGUAGE_CODES[language], voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[gender] } } },
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

const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").split(/\s+/).filter(Boolean);

// A take passes when its length is plausible for the words (repeats double or triple it) and a
// transcript of it matches the script closely, with nothing substantial added.
async function takeMatches(wav: Buffer, script: string): Promise<boolean> {
  const seconds = (wav.length - 44) / (SAMPLE_RATE * 2);
  const expected = words(script).length / VOICEOVER_WORDS_PER_SECOND;
  if (seconds > expected * 1.9 + 1.5 || seconds < expected * 0.35) {
    console.warn(`[voiceover] take rejected: ${seconds.toFixed(1)}s for ~${expected.toFixed(1)}s of script`);
    return false;
  }
  if (!checker) return true;
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

async function verifiedTake(script: string, read: () => Promise<Buffer>): Promise<Buffer> {
  let last: Buffer | null = null;
  let lastError: unknown = null;
  for (let take = 0; take < MAX_TAKES; take++) {
    try {
      const wav = await read();
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
): Promise<{ shot: number; audio: Buffer }[]> {
  const spoken = lines.flatMap((line, shot) => (line?.trim() ? [{ shot, text: line.trim() }] : []));
  if (!spoken.length) return [];
  const script = spoken.map((l) => l.text).join(" ");
  const pausedDirection = [direction, `Read it as ${spoken.length} separate lines with a clear one-second pause after each line; read every line exactly once, word for word, and add nothing`]
    .filter(Boolean)
    .join(". ");
  try {
    const take = await verifiedTake(script, () =>
      synthesizeVoiceover(spoken.map((l) => l.text).join("\n"), language, gender, tone, pausedDirection),
    );
    const pieces = await splitAudioAtPauses(take, spoken.length);
    if (pieces) return pieces.map((audio, i) => ({ shot: spoken[i].shot, audio }));
    console.warn("[voiceover] couldn't find the pauses between lines, reading lines separately");
  } catch (err) {
    console.warn("[voiceover] one-take narration failed, reading lines separately:", err instanceof Error ? err.message : err);
  }
  const out: { shot: number; audio: Buffer }[] = [];
  for (const l of spoken) {
    out.push({ shot: l.shot, audio: await verifiedTake(l.text, () => synthesizeVoiceover(l.text, language, gender, tone, direction)) });
  }
  return out;
}
