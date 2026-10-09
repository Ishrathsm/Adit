import { GoogleGenAI } from "@google/genai";
import { env } from "./env";
import { withRateLimitRetry } from "./rate-limit-retry";

export const veoEnabled = Boolean(env.googleCloudProjectId);

if (!veoEnabled) {
  console.warn(
    "[veo] GOOGLE_CLOUD_PROJECT_ID not set — video generation disabled.",
  );
}

const genAI = veoEnabled
  ? new GoogleGenAI({
      vertexai: true,
      project: env.googleCloudProjectId,
      location: env.googleCloudLocation,
    })
  : null;

export interface GeneratedVideo {
  videoBytes: string;
  mimeType: string;
}

export interface GenerateVideoOptions {
  generateAudio?: boolean;
  durationSeconds?: number;
  aspectRatio?: string;
  // Conditions the clip on a starting frame — used for the Storyboard flow, where a shot's
  // chosen candidate image becomes the first frame of that shot's video.
  image?: { imageBytes: string; mimeType: string };
  // Veo's dedicated negative-prompt parameter — unlike Nano Banana, Veo has a real one, so things
  // to avoid belong here rather than in the prompt text (where naming them primes them).
  negativePrompt?: string;
  // "720p" (default) or "1080p"; 1080p costs more per second.
  resolution?: VideoResolution;
}

export const VIDEO_RESOLUTIONS = ["720p", "1080p"] as const;
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];

// Veo generation is a long-running operation — kick it off, then poll until done.
export async function generateVideo(prompt: string, options: GenerateVideoOptions = {}): Promise<GeneratedVideo> {
  if (!genAI) {
    throw new Error("Veo is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  }

  const { generateAudio = true, durationSeconds = 8, aspectRatio = "16:9", image, negativePrompt, resolution } = options;

  let operation = await withRateLimitRetry("veo", () =>
    genAI.models.generateVideos({
      model: env.veoModel,
      source: { prompt, image },
      config: {
        numberOfVideos: 1,
        aspectRatio,
        durationSeconds,
        generateAudio,
        ...(negativePrompt ? { negativePrompt } : {}),
        ...(resolution && resolution !== "720p" ? { resolution } : {}),
      },
    }),
  );

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    operation = await genAI.operations.getVideosOperation({ operation });
  }

  if (operation.error) {
    throw new Error(`Veo generation failed: ${JSON.stringify(operation.error)}`);
  }

  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video?.videoBytes) {
    throw new Error("Veo returned no video bytes");
  }

  return { videoBytes: video.videoBytes, mimeType: video.mimeType ?? "video/mp4" };
}
