import { GoogleGenAI, Type } from "@google/genai";
import { env } from "./env";
import { withRateLimitRetry } from "./rate-limit-retry";

const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation })
  : null;

export interface MarkCheckResult {
  clean: boolean;
  findings: string[];
}

// Nano Banana doesn't reliably obey "no text/logos" — it paints brand names it was given, fake
// headline lettering, and real competitors' marks (a Nike swoosh, Adidas stripes) onto products.
// The brand's own logo/tagline get composited afterward, so anything like that already in the
// raw image is wrong. This is a cheap vision read used to reject and regenerate those images.
export async function checkForUnwantedMarks(
  imageBytes: string,
  mimeType: string,
  // The client's real product photos: branding that genuinely appears on them is allowed (their own
  // logo should stay), while anything else is still flagged.
  allowedFrom: { imageBytes: string; mimeType: string }[] = [],
): Promise<MarkCheckResult> {
  if (!genAI) return { clean: true, findings: [] };

  try {
    const references = allowedFrom.flatMap((ref, i) => [
      `REFERENCE ${i + 1} (the client's real product — its genuine markings are allowed):`,
      { inlineData: { data: ref.imageBytes, mimeType: ref.mimeType } },
    ]);
    const response = await withRateLimitRetry("image-check", () =>
      genAI.models.generateContent({
        model: env.imageCheckModel,
        contents: [
          ...references,
          ...(references.length ? ["IMAGE TO INSPECT:"] : []),
          { inlineData: { data: imageBytes, mimeType } },
          `${references.length ? "Text, logos, and markings that genuinely appear on the product in the REFERENCE images, in the same place on the same product, are allowed — do not list them. " : ""}Inspect this generated advertising image closely, including small details on products, clothing, props, and backgrounds. List every instance of:
1. Any written language — letters, words, numbers, or text-like glyphs/pseudo-lettering, however small or partial.
2. Any logo, emblem, monogram, or recognizable trademark or trade-dress design of a real brand (e.g. a swoosh, three parallel stripes, a signature pattern).
Ordinary design details that are not text or brand marks (plain seams, stitching, tread patterns, laces, abstract textures) do not count.
Each finding must name something physically visible in the image — quote the exact characters you can read, or name the specific mark and where it is. Never describe the scene, its mood, or what it means; if you find nothing, return an empty list.`,
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              findings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "One short description per instance found (what and where); empty if none.",
              },
            },
            required: ["findings"],
          },
        },
      }),
    );

    const parsed = JSON.parse(response.text ?? "{}") as { findings?: string[] };
    const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
    return { clean: findings.length === 0, findings };
  } catch (err) {
    // A checker outage shouldn't fail an otherwise-finished generation — let the image through.
    console.warn("[image-check] check failed, accepting image unchecked:", err instanceof Error ? err.message : err);
    return { clean: true, findings: [] };
  }
}
