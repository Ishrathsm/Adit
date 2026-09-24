import { GoogleGenAI } from "@google/genai";
import { type Tone, type VoiceGender, type VoiceoverLanguage, VOICEOVER_LANGUAGE_NAMES } from "./creative-brief";
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

// Narration for a video ad (only when the brief asked for a voiceover). Returns WAV bytes.
export async function synthesizeVoiceover(text: string, language: VoiceoverLanguage, gender: VoiceGender, tone: Tone): Promise<Buffer> {
  if (!genAI) throw new Error("Voiceover is not configured — missing GOOGLE_CLOUD_PROJECT_ID");

  const response = await withRateLimitRetry("voiceover", () =>
    genAI.models.generateContent({
      model: env.voiceoverModel,
      contents: `Read this ${VOICEOVER_LANGUAGE_NAMES[language]} advertisement voiceover aloud in a ${DELIVERY[tone]} voice, with natural pauses between sentences: ${text}`,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[gender] } } },
      },
    }),
  );

  const data = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
  if (!data) throw new Error("Voiceover generation returned no audio");
  return wavFromPcm(Buffer.from(data, "base64"));
}
