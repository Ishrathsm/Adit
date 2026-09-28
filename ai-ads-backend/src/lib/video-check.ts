import { GoogleGenAI, Type } from "@google/genai";
import { env } from "./env";
import { withRateLimitRetry } from "./rate-limit-retry";
import { checkForUnwantedMarks } from "./image-check";
import { sampleFrames } from "./video-stitch";

const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation })
  : null;

// A clean keyframe isn't enough: Veo can paint marks in while animating (seen in testing — a logo
// appeared on a runner's leggings that wasn't in the starting frame). Checks a few frames across
// the clip with the same vision check used for images.
export async function findMarksInVideo(clip: Buffer, allowedFrom: { imageBytes: string; mimeType: string }[] = []): Promise<string[]> {
  const frames = await sampleFrames(clip);
  const results = await Promise.all(frames.map((frame) => checkForUnwantedMarks(frame.toString("base64"), "image/png", allowedFrom)));
  return results.flatMap((r) => r.findings);
}

// Veo also adds unmotivated effects mid-shot — in testing a puff of smoke rose under a corridor
// ceiling a second into an otherwise calm shot. Compares later frames against the opening frame
// and reports anything that appears from nowhere or deforms.
export async function findSuddenEffects(clip: Buffer): Promise<string[]> {
  if (!genAI) return [];
  try {
    const frames = await sampleFrames(clip, [0.02, 0.3, 0.55, 0.8, 0.97]);
    const parts: ({ inlineData: { data: string; mimeType: string } } | string)[] = [];
    frames.forEach((frame, i) => {
      parts.push(i === 0 ? "FRAME 0 (opening frame):" : `FRAME ${i}:`);
      parts.push({ inlineData: { data: frame.toString("base64"), mimeType: "image/png" } });
    });
    parts.push(`These frames are in order from one short live-action ad shot. Compared with FRAME 0, list every visual artifact that appears or changes without a real-world cause:
- smoke, fog, haze, mist, steam, dust clouds, or floating particles appearing
- sudden flashes, glows, light leaks, or lens effects
- objects or people appearing, vanishing, melting, morphing, or duplicating; warped faces, hands, or limbs
Normal motion does not count: people moving, camera moves, focus changes, natural light already present in FRAME 0. Each finding must name what appears and where. Return an empty list if the shot is clean.`);

    const response = await withRateLimitRetry("video-check", () =>
      genAI.models.generateContent({
        model: env.imageCheckModel,
        contents: parts,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { findings: { type: Type.ARRAY, items: { type: Type.STRING } } },
            required: ["findings"],
          },
        },
      }),
    );
    const parsed = JSON.parse(response.text ?? "{}") as { findings?: string[] };
    return Array.isArray(parsed.findings) ? parsed.findings : [];
  } catch (err) {
    // A checker outage shouldn't fail an otherwise-finished shot.
    console.warn("[video-check] effects check failed, accepting clip unchecked:", err instanceof Error ? err.message : err);
    return [];
  }
}
