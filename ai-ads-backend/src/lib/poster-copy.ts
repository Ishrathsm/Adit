import { GoogleGenAI, Type } from "@google/genai";
import { env } from "./env";

const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation })
  : null;

// A poster reads as designed when copy has hierarchy — a short dominant headline (usually the
// offer or hook), a quieter supporting line, sometimes a tiny kicker above. Users give one flat
// tagline, so split it into those roles. The words must stay the user's own: this only
// arranges copy, it never writes any.
export interface PosterCopy {
  kicker: string | null;
  headline: string;
  subline: string | null;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}%$€£₹]+/gu, " ").trim().replace(/\s+/g, " ");

// The parts read in order must be exactly the tagline's words in their original order — rejects
// any rewording, invented copy, or words moved between roles (which silently changes meaning).
function preservesTagline(tagline: string, parts: string[]): boolean {
  return normalize(parts.join(" ")) === normalize(tagline);
}

// No-model fallback: short taglines are all headline; longer ones break near the first third.
function heuristicSplit(tagline: string): PosterCopy {
  const words = tagline.split(/\s+/);
  if (words.length <= 4) return { kicker: null, headline: tagline, subline: null };
  const cut = Math.max(2, Math.min(4, Math.round(words.length / 3)));
  return { kicker: null, headline: words.slice(0, cut).join(" "), subline: words.slice(cut).join(" ") };
}

export async function splitPosterCopy(tagline: string): Promise<PosterCopy> {
  if (!genAI) return heuristicSplit(tagline);

  try {
    const response = await genAI.models.generateContent({
      model: env.copyModel,
      contents: `You are an advertising art director laying out copy on a poster. Split this tagline into typographic roles, using ONLY its own words in their original order, keeping their original capitalization (you may drop punctuation at the split points; never add, rephrase, reorder, or translate words):
- headline: the 1-4 word hook that should dominate — the offer (e.g. "30% off") if there is one, otherwise the punchiest phrase
- subline: the remaining supporting words, or null
- kicker: a 1-2 word label that naturally leads the tagline (e.g. "New", "Introducing"), or null — only if the tagline actually starts with one

Tagline: "${tagline}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            kicker: { type: Type.STRING, nullable: true },
            headline: { type: Type.STRING },
            subline: { type: Type.STRING, nullable: true },
          },
          required: ["headline"],
        },
      },
    });
    const parsed = JSON.parse(response.text ?? "{}") as Partial<PosterCopy>;
    const copy: PosterCopy = {
      kicker: parsed.kicker?.trim() || null,
      headline: parsed.headline?.trim() ?? "",
      subline: parsed.subline?.trim() || null,
    };
    const parts = [copy.kicker, copy.headline, copy.subline].filter((p): p is string => Boolean(p));
    if (copy.headline && preservesTagline(tagline, parts)) return copy;
    console.warn("[poster-copy] split changed the tagline's words, using heuristic:", JSON.stringify(copy));
  } catch (err) {
    console.warn("[poster-copy] split failed, using heuristic:", err instanceof Error ? err.message : err);
  }
  return heuristicSplit(tagline);
}
