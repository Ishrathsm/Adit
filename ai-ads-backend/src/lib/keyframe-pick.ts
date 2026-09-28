import { GoogleGenAI, Type } from "@google/genai";
import { env } from "./env";
import { withRateLimitRetry } from "./rate-limit-retry";

const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation })
  : null;

export interface KeyframeCandidate {
  imageBytes: string;
  mimeType: string;
  // From generateCleanImage — a candidate that failed the text/mark check is only picked if every
  // candidate failed it.
  clean: boolean;
}

// Auto-pick for storyboards: 5-8 shots is too many keyframes to hand-pick one by one, so a vision
// judge chooses the candidate that best fits the shot, matches the previous shot, and looks most
// like a real, crafted ad frame. The user can still override any pick afterward.
export async function pickBestKeyframe(
  candidates: KeyframeCandidate[],
  shotDescription: string,
  lookSheet: string | null,
  previousFrame?: { imageBytes: string; mimeType: string },
  // Approved character-sheet references: the authority on each person's face and wardrobe.
  cast: { image: { imageBytes: string; mimeType: string }; name: string }[] = [],
): Promise<number> {
  const eligible = candidates.map((c, i) => ({ c, i })).filter(({ c }) => c.clean);
  const pool = eligible.length ? eligible : candidates.map((c, i) => ({ c, i }));
  if (pool.length === 1 || !genAI) return pool[0].i;

  try {
    const parts: ({ inlineData: { data: string; mimeType: string } } | string)[] = [];
    cast.forEach((c) => {
      parts.push(`CAST REFERENCE (${c.name}):`);
      parts.push({ inlineData: { data: c.image.imageBytes, mimeType: c.image.mimeType } });
    });
    if (previousFrame) {
      parts.push("PREVIOUS SHOT (the chosen frame this one must cut from):");
      parts.push({ inlineData: { data: previousFrame.imageBytes, mimeType: previousFrame.mimeType } });
    }
    pool.forEach(({ c }, n) => {
      parts.push(`CANDIDATE ${n}:`);
      parts.push({ inlineData: { data: c.imageBytes, mimeType: c.mimeType } });
    });
    parts.push(`You are a film editor choosing the keyframe for one shot of an ad.
Shot brief: "${shotDescription}"
${lookSheet ? `Film look sheet (people, product, place, palette, light must match this): "${lookSheet}"` : ""}

Pick the candidate that best: (1) shows exactly what the shot brief describes; (2) ${cast.length ? "shows each person exactly as in their CAST REFERENCE — same face, hair, and the same clothing (garment type, sleeve length, color); a wardrobe mismatch with the cast is a serious flaw even if it matches the previous shot;" : ""} ${previousFrame ? `matches the previous shot — ${cast.length ? "" : "same people, "}product design, location, time of day, palette — so the cut feels seamless;` : "matches the look sheet;"} (3) looks like a real, beautifully crafted ad frame — natural anatomy and faces, believable materials and light, no AI artifacts (warped hands, melted details, plastic skin), no stray text or logos. Return the candidate number.`);

    const response = await withRateLimitRetry("keyframe-pick", () =>
      genAI.models.generateContent({
        model: env.copyModel,
        contents: parts,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: { best: { type: Type.INTEGER }, reason: { type: Type.STRING } },
            required: ["best"],
          },
        },
      }),
    );
    const parsed = JSON.parse(response.text ?? "{}") as { best?: number; reason?: string };
    if (typeof parsed.best === "number" && pool[parsed.best]) {
      console.log(`[keyframe-pick] picked candidate ${parsed.best}: ${parsed.reason ?? ""}`);
      return pool[parsed.best].i;
    }
  } catch (err) {
    console.warn("[keyframe-pick] judge failed, using first candidate:", err instanceof Error ? err.message : err);
  }
  return pool[0].i;
}
