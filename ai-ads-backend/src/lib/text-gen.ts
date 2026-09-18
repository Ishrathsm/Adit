import { GoogleGenAI, Type } from "@google/genai";
import { env } from "./env";

const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({
      vertexai: true,
      project: env.googleCloudProjectId,
      location: env.googleCloudLocation,
    })
  : null;

// Splits a single ad concept into N shot descriptions for the Text -> Storyboard -> Video flow.
export async function generateShotDescriptions(concept: string, shotCount: number): Promise<string[]> {
  if (!genAI) {
    throw new Error("Text generation is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  }

  const response = await genAI.models.generateContent({
    model: env.textModel,
    contents: `Break this ad concept into exactly ${shotCount} sequential shots for a short video ad. ` +
      `Each shot description should be a single vivid visual sentence, filmable as a standalone image, ` +
      `and the shots together should tell a coherent mini-story for the concept.\n\nConcept: ${concept}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          shots: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["shots"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Shot breakdown returned no text");

  const parsed = JSON.parse(text) as { shots: string[] };
  if (!Array.isArray(parsed.shots) || parsed.shots.length !== shotCount) {
    throw new Error(`Expected ${shotCount} shots, got ${parsed.shots?.length ?? 0}`);
  }
  return parsed.shots;
}
