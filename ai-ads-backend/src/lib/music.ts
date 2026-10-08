import { GoogleAuth } from "google-auth-library";
import { env } from "./env";
import { withRateLimitRetry } from "./rate-limit-retry";

// Background score for video ads, from Google's Lyria on the same Vertex project as Veo — no extra
// vendor or plan (ElevenLabs' music API needs a paid tier). Lyria returns a ~32s instrumental WAV;
// the stitch step trims and fades it to the ad's length.
const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

// Lyria sometimes 500s with "Could not generate audio. Please try again with a different prompt"
// (seen on a director's beat-by-beat prompt; the ad went out silent). One retry of the same prompt,
// then the plain fallback prompt, before giving up.
// `negativePrompt` overrides the default no-vocals guard, for a cue that wants a voice (e.g. a wordless aalap).
export async function generateMusic(prompt: string, fallbackPrompt?: string, negativePrompt = "vocals, singing, spoken words, lyrics"): Promise<Buffer> {
  const attempts = [prompt, prompt, ...(fallbackPrompt ? [fallbackPrompt] : [])];
  let lastError: unknown;
  for (const [i, p] of attempts.entries()) {
    try {
      return await generateMusicOnce(p, negativePrompt);
    } catch (err) {
      const status = (err as { status?: number }).status ?? 0;
      if (status < 500) throw err;
      lastError = err;
      if (i < attempts.length - 1) console.warn(`[music] Lyria ${status}, retrying${attempts[i + 1] === prompt ? "" : " with the fallback prompt"}`);
    }
  }
  throw lastError;
}

async function generateMusicOnce(prompt: string, negativePrompt: string): Promise<Buffer> {
  if (!env.googleCloudProjectId) {
    throw new Error("Music generation is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  }

  const url = `https://${env.musicLocation}-aiplatform.googleapis.com/v1/projects/${env.googleCloudProjectId}/locations/${env.musicLocation}/publishers/google/models/${env.musicModel}:predict`;
  const token = await auth.getAccessToken();

  const body = await withRateLimitRetry("music", async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt, negative_prompt: negativePrompt }],
        parameters: {},
      }),
    });
    const text = await res.text();
    if (!res.ok) throw Object.assign(new Error(`Lyria ${res.status}: ${text.slice(0, 300)}`), { status: res.status });
    return JSON.parse(text) as { predictions?: { bytesBase64Encoded?: string }[] };
  });

  const audio = body.predictions?.[0]?.bytesBase64Encoded;
  if (!audio) throw new Error("Lyria returned no audio");
  return Buffer.from(audio, "base64");
}
