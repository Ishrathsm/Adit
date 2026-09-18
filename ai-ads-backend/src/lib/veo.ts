import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

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
}

// Veo generation is a long-running operation — kick it off, then poll until done.
export async function generateVideo(prompt: string, options: GenerateVideoOptions = {}): Promise<GeneratedVideo> {
  if (!genAI) {
    throw new Error("Veo is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  }

  const { generateAudio = true, durationSeconds = 8, aspectRatio = "16:9", image } = options;

  let operation = await genAI.models.generateVideos({
    model: env.veoModel,
    source: { prompt, image },
    config: {
      numberOfVideos: 1,
      aspectRatio,
      durationSeconds,
      generateAudio,
    },
  });

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
