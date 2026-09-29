import { GoogleGenAI, Type } from "@google/genai";
import { env } from "./env";
import { withRateLimitRetry } from "./rate-limit-retry";
import { checkForUnwantedMarks } from "./image-check";
import { sampleFrames } from "./video-stitch";

const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation })
  : null;

// One thing wrong with a take, plus how to steer the next take away from it: `avoid` is a few
// words for Veo's negative prompt, `direction` a positive instruction for the prompt itself (it
// never names the problem, which would prime it).
export interface ClipProblem {
  issue: string;
  avoid: string;
  direction: string;
}

// A clean keyframe isn't enough: Veo can paint marks in while animating (seen in testing — a logo
// appeared on a runner's leggings that wasn't in the starting frame). Checks a few frames across
// the clip with the same vision check used for images.
export async function findMarksInVideo(clip: Buffer, allowedFrom: { imageBytes: string; mimeType: string }[] = []): Promise<ClipProblem[]> {
  const frames = await sampleFrames(clip);
  const results = await Promise.all(frames.map((frame) => checkForUnwantedMarks(frame.toString("base64"), "image/png", allowedFrom)));
  return results.flatMap((r) =>
    r.findings.map((issue) => ({
      issue,
      avoid: "text, letters, writing, logos, brand marks",
      direction: "Every surface, page, and garment stays plain and unmarked, exactly as in the starting frame.",
    })),
  );
}

// Roughly one frame per second across the clip, so a problem that comes and goes is still seen.
const EFFECT_FRAMES = [0.02, 0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86, 0.97];

// Veo also adds unmotivated effects and performance drift mid-shot. Seen in testing: a puff of
// smoke under a corridor ceiling, a spot appearing on a cheek, a prop swapped for another, a
// screen-lit face breaking into sparkles, lens-flare ghosts from a backlight, handwriting
// appearing in a notebook, and actors pulling strong frowns. Compares later frames against the
// opening frame and reports anything that appears from nowhere, deforms, or is over-played.
export async function findSuddenEffects(clip: Buffer): Promise<ClipProblem[]> {
  if (!genAI) return [];
  try {
    const frames = await sampleFrames(clip, EFFECT_FRAMES);
    const parts: ({ inlineData: { data: string; mimeType: string } } | string)[] = [];
    frames.forEach((frame, i) => {
      parts.push(i === 0 ? "FRAME 0 (opening frame):" : `FRAME ${i}:`);
      parts.push({ inlineData: { data: frame.toString("base64"), mimeType: "image/png" } });
    });
    parts.push(`These frames are in order from one short live-action ad shot. Compared with FRAME 0, list every visual problem that appears or changes without a real-world cause:
- smoke, fog, haze, mist, steam, dust clouds, or floating particles appearing
- sudden flashes, glows, light leaks, lens flares, or ghost reflections
- objects or people appearing, vanishing, melting, morphing, duplicating, or being swapped for a different object; warped faces, hands, or limbs
- skin changing: new spots, marks, blemishes, speckles, or glittery sparkle on faces or hands; skin turning waxy or plastic
- writing, scribbles, or marks appearing on paper, notebooks, boards, or screens
- exaggerated or theatrical acting: deep frowns, grimaces, wide-eyed shock, or big mouth movements that a restrained, natural ad performance would not have
- a mouth moving as if speaking or mouthing words (the shot is silent, so any talking is wrong)
- any object that is not visible in FRAME 0 and slides, pops, or grows into view without being carried in — check the edges of the frame and under hands closely
Normal motion does not count: people moving, camera moves and the parallax, shadows, and reveals they cause, focus changes, natural light already present in FRAME 0, a mild natural change of expression, small or distant hands that simply look soft. Report only what is clearly visible and would bother a viewer watching at normal speed; return an empty list if the shot is clean.
For each problem give:
- issue: what appears and where, and in which frames
- avoid: 2-6 words naming the problem, for a video model's negative prompt (e.g. "smoke, haze" or "frowning, furrowed brow"). Name the glitch, never an object that belongs in the scene: for a prop popping in, write "objects appearing mid-shot", not the prop's name
- direction: one short positive instruction for the next take that prevents it without naming it (e.g. "The air stays perfectly clear." or "Her face stays relaxed and neutral, with only slight natural movement." or "Everything on the desk stays exactly as in the first frame; nothing new enters.")`);

    const response = await withRateLimitRetry("video-check", () =>
      genAI.models.generateContent({
        model: env.videoCheckModel,
        contents: parts,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              problems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    issue: { type: Type.STRING },
                    avoid: { type: Type.STRING },
                    direction: { type: Type.STRING },
                  },
                  required: ["issue", "avoid", "direction"],
                },
              },
            },
            required: ["problems"],
          },
        },
      }),
    );
    const parsed = JSON.parse(response.text ?? "{}") as { problems?: ClipProblem[] };
    return Array.isArray(parsed.problems) ? parsed.problems.filter((p) => p?.issue) : [];
  } catch (err) {
    // A checker outage shouldn't fail an otherwise-finished shot.
    console.warn("[video-check] effects check failed, accepting clip unchecked:", err instanceof Error ? err.message : err);
    return [];
  }
}
