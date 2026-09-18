import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

export const imageGenEnabled = Boolean(env.googleCloudProjectId);

// Gemini's native image output ("Nano Banana") lives in a different location than Veo for
// this project — see the comment on env.imageModel for why this needs its own client.
const genAI = imageGenEnabled
  ? new GoogleGenAI({
      vertexai: true,
      project: env.googleCloudProjectId,
      location: env.imageLocation,
    })
  : null;

export interface GeneratedImage {
  imageBytes: string;
  mimeType: string;
}

export async function generateImage(prompt: string, aspectRatio: string): Promise<GeneratedImage> {
  if (!genAI) {
    throw new Error("Image generation is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  }

  const response = await genAI.models.generateContent({
    model: env.imageModel,
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error("Image generation returned no image data");
  }

  return { imageBytes: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType ?? "image/png" };
}
