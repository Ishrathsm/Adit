import { GoogleGenAI } from "@google/genai";
import { env } from "./env";
import { checkForUnwantedMarks } from "./image-check";
import { withRateLimitRetry } from "./rate-limit-retry";

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

// Start times are spaced env.imageMinIntervalMs apart across the whole process (keyframe
// candidates, clean-check re-rolls, cast sheets), since a burst is what trips the quota.
let nextImageSlot = 0;
async function waitForImageSlot(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextImageSlot - now);
  nextImageSlot = Math.max(now, nextImageSlot) + env.imageMinIntervalMs;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}

export interface GeneratedImage {
  imageBytes: string;
  mimeType: string;
}

export interface ReferenceImage {
  imageBytes: string;
  mimeType: string;
}

export async function generateImage(
  prompt: string,
  aspectRatio: string,
  // Images attached so Nano Banana matches them (image-to-image) instead of generating a fresh,
  // potentially inconsistent-looking subject from text alone — e.g. a storyboard shot gets both
  // the user's product photo and the previous shot's chosen frame.
  referenceImages: ReferenceImage[] = [],
  // Output size: "1K" (the model's default), "2K" or "4K".
  imageSize?: "1K" | "2K" | "4K",
): Promise<GeneratedImage> {
  if (!genAI) {
    throw new Error("Image generation is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  }

  const contents = referenceImages.length
    ? [...referenceImages.map((ref) => ({ inlineData: { data: ref.imageBytes, mimeType: ref.mimeType } })), prompt]
    : prompt;

  const response = await withRateLimitRetry("image-gen", async () => {
    await waitForImageSlot();
    return genAI.models.generateContent({
      model: env.imageModel,
      contents,
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio, ...(imageSize ? { imageSize } : {}) },
      },
    });
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error("Image generation returned no image data");
  }

  return { imageBytes: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType ?? "image/png" };
}

// Generation attempts per image before giving up on a clean result — each extra attempt is one
// more Nano Banana call, so this stays small.
const MAX_CLEAN_ATTEMPTS = 3;

// generateImage, then reject and regenerate any result that has stray text or real-brand marks
// painted into it (see image-check.ts). After MAX_CLEAN_ATTEMPTS the last image is returned
// anyway rather than failing the job; `clean` says whether it actually passed.
export async function generateCleanImage(
  prompt: string,
  aspectRatio: string,
  referenceImages: ReferenceImage[] = [],
  // The client's real product photos among the references — their genuine branding is allowed
  // through the check instead of getting every attempt rejected.
  allowedMarksFrom: ReferenceImage[] = [],
): Promise<GeneratedImage & { clean: boolean }> {
  let image = await generateImage(prompt, aspectRatio, referenceImages);

  for (let attempt = 1; ; attempt++) {
    const { clean, findings } = await checkForUnwantedMarks(image.imageBytes, image.mimeType, allowedMarksFrom);
    if (clean) return { ...image, clean: true };
    console.warn(`[image-gen] attempt ${attempt}/${MAX_CLEAN_ATTEMPTS} rejected — unwanted marks:`, findings.join("; "));
    if (attempt === MAX_CLEAN_ATTEMPTS) return { ...image, clean: false };
    try {
      image = await generateImage(prompt, aspectRatio, referenceImages);
    } catch (err) {
      // Nano Banana 429s easily; a failed regeneration shouldn't fail a job that already has an image.
      console.warn("[image-gen] regeneration failed, keeping flagged image:", err instanceof Error ? err.message : err);
      return { ...image, clean: false };
    }
  }
}
