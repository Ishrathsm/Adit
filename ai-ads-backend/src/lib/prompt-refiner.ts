import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.googleCloudLocation })
  : null;

export interface BrandContext {
  productName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  font?: string | null;
  tagline?: string | null;
  brandRules?: string | null;
}

// Target length is driven by observation: single-line prompts sent straight to Veo/Gemini
// image-gen produce generic, low-detail output. A ~5000 char prompt covering composition,
// lighting, camera, motion timing etc. is what actually moves quality — this is not a
// cosmetic knob, it's the difference between usable and unusable output.
const MIN_CHARS = 5000;
const RETRY_MIN_CHARS = 3000;

function templateBlock(styleTemplate?: string): string {
  if (!styleTemplate) return "";
  return `\n\nYou MUST use the following curated visual template as the foundational style, composition, lighting, and mood — treat it as fixed creative direction, and adapt only the specific subject/product/text details from the user's concept to fit within it (do not invent a different style):\n"""\n${styleTemplate}\n"""`;
}

// Shared creative bar spliced into every meta-prompt. The checklist-style prompts below (camera,
// lighting, color, etc.) were producing competent-but-generic "AI stock photo" output — this pushes
// for an actual scroll-stopping ad hero shot instead, and explicitly bans the model's own tells.
function qualityBarBlock(medium: "image" | "video"): string {
  const common = `This is not a moodboard sketch or a generic AI render — it is the actual hero frame${
    medium === "video" ? "s of a real ad film" : " of a real ad"
  } that has to sit next to Nike, Apple, Liquid Death, and Dove in someone's feed and still win the scroll. Judge every choice against that bar, not against "a nice AI-generated picture."

Non-negotiables:
- One unmistakable focal idea — cut anything from the brief that doesn't earn its place rather than cramming everything in at once.
- Avoid every default AI-generation tell: waxy/plastic skin, warped hands or limbs, mismatched or dead-eyed gazes, generic gradient-mesh backdrops, dead-center symmetric "product on a table" staging, stock-photo smiling, flat beauty-lighting with no shadow character.
- Earn a genuine hook: an unexpected angle, a surprising juxtaposition, exaggerated scale, motion frozen mid-action, a bold crop, a visual pun — something a real art director would greenlight because it's interesting, not merely competent.
- Push materials and light to be specific and tactile (name the exact material and exactly how light catches it) instead of leaning on vague quality adjectives like "high quality" or "stunning."
- Do not render any text, letters, numbers, or logos into the frame — the brand's logo and tagline are composited on afterward, so leave deliberate, uncluttered negative space for them as part of the composition, not an afterthought.`;

  const videoAddendum =
    "\n- Avoid AI-video tells too: rubbery or inconsistent physics, morphing geometry between frames, drifting continuity errors, aimless camera motion. Every camera move should be a deliberate choice building toward one clear payoff moment.";

  return `\n\n${common}${medium === "video" ? videoAddendum : ""}`;
}

// "subject" = ground on a real photo (own product, or a prior generation for continuity) —
// keep it literally recognizable. "style" = match mood/color/lighting/style, but the subject
// and scene should be an original creation, not a reproduction of the reference image.
export type ReferenceImageRole = "subject" | "style";

function referenceInstructionBlock(referenceImageRole?: ReferenceImageRole): string {
  if (referenceImageRole === "subject") {
    return `\n\nA reference image is attached. The final prompt must direct the model to keep the exact same subject/product appearance, materials, colors, and overall visual style as that reference — only the pose, action, framing, and setting should change to match this brief.`;
  }
  if (referenceImageRole === "style") {
    return `\n\nA style reference image is attached. The final prompt must direct the model to match that reference's mood, color palette, lighting character, and overall visual style — but the subject and scene must be an original creation for this brief, not a literal reproduction of whatever is depicted in the reference.`;
  }
  return "";
}

function brandContextBlock(brand?: BrandContext): string {
  if (!brand) return "";
  const lines = [
    brand.productName && `Product/brand name: ${brand.productName}`,
    brand.tagline && `Tagline to feature: ${brand.tagline}`,
    brand.primaryColor && `Primary brand color: ${brand.primaryColor}`,
    brand.secondaryColor && `Secondary brand color: ${brand.secondaryColor}`,
    brand.font && `Brand font style cue: ${brand.font}`,
    brand.brandRules && `Brand rules to respect: ${brand.brandRules}`,
  ].filter(Boolean);
  return lines.length ? `\n\nBrand context to weave in naturally (do not just list these — integrate them into the scene):\n${lines.join("\n")}` : "";
}

async function refine(metaPrompt: string): Promise<string> {
  if (!genAI) {
    throw new Error("Prompt refinement is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0
      ? metaPrompt
      : `${metaPrompt}\n\nIMPORTANT: your previous attempt was too short. You must write at least ${MIN_CHARS} characters of dense, concrete visual detail — do not summarize or stop early.`;

    const response = await genAI.models.generateContent({
      model: env.textModel,
      contents: prompt,
    });

    const text = response.text?.trim();
    if (text && text.length >= RETRY_MIN_CHARS) return text;
    if (text && attempt === 1) return text; // second attempt still short — use what we have
  }

  throw new Error("Prompt refinement returned no usable text");
}

export async function refineImagePrompt(
  rawPrompt: string,
  aspectRatio: string,
  brand?: BrandContext,
  styleTemplate?: string,
  referenceImageRole?: ReferenceImageRole,
): Promise<string> {
  const metaPrompt = `You are an award-winning associate creative director and prompt engineer, briefing a state-of-the-art AI image generation model (Google's Gemini native image generation) on the hero shot for a real ad campaign. A user gave a short, vague one-line ad concept. Expand it into an extremely detailed, production-ready image generation prompt of at least ${MIN_CHARS} characters (aim for ${MIN_CHARS}-6000 characters) written as flowing descriptive prose — NOT bullet points, NOT JSON, NOT numbered lists.${referenceInstructionBlock(referenceImageRole)}
${qualityBarBlock("image")}

Cover in detail:
- The exact subject: appearance, materials, textures, pose, expression, product details
- Composition & framing: camera angle, lens choice (e.g. 85mm f/1.4), depth of field, rule-of-thirds placement, foreground/midground/background layering
- Lighting: direction, quality (soft/hard/rim/key/fill), color temperature, time of day, shadow behavior, highlights and reflections
- Color palette, grading, and overall mood/atmosphere
- Background and environment detail, set dressing, props
- Rendering/style cues: photography or illustration style, film stock or render engine quality descriptors (e.g. "shot on Phase One, ultra-realistic, 8k, sharp focus")
- Target aspect ratio: ${aspectRatio}
${templateBlock(styleTemplate)}
${brandContextBlock(brand)}

Output ONLY the refined prompt text itself. No labels, no headers like "Prompt:", no explanation, no quotation marks around it.

User's one-line concept: "${rawPrompt}"`;

  return refine(metaPrompt);
}

export async function refineVideoPrompt(
  rawPrompt: string,
  durationSeconds: number,
  aspectRatio: string,
  brand?: BrandContext,
  styleTemplate?: string,
  referenceImageRole?: ReferenceImageRole,
): Promise<string> {
  // A reference image switches Veo into image-to-video mode — the prompt should describe
  // motion/animation from that starting frame rather than composing a new scene from scratch.
  const referenceInstruction = referenceImageRole
    ? `\n\nA reference image is attached as the starting frame — Veo will animate motion from it rather than generate a scene from scratch. ${
        referenceImageRole === "subject"
          ? "Keep the exact same subject/product appearance, materials, colors, and setting as that reference; describe only how it moves and how the camera moves around it."
          : "Match that reference's mood, color palette, lighting character, and overall visual style as the clip's starting point, while the subject and scene remain an original creation for this brief."
      }`
    : "";
  const metaPrompt = `You are an award-winning ad film director and prompt engineer, briefing Google's Veo video generation model on a real ad campaign's hero clip. A user gave a short, vague one-line ad concept. Expand it into an extremely detailed, production-ready video generation prompt of at least ${MIN_CHARS} characters (aim for ${MIN_CHARS}-6000 characters), written as flowing cinematic prose.${referenceInstruction}
${qualityBarBlock("video")}

The finished clip is exactly ${durationSeconds} seconds long. You MUST break the action into a precise second-by-second (or half-second, where useful) timeline covering the full ${durationSeconds}s so the model knows exactly what happens and when — format each beat like "0.0s-1.5s: ..." continuing in order until ${durationSeconds}s is reached. For every beat, describe: camera movement (static/pan/tilt/dolly-in/dolly-out/handheld/orbit), subject action and motion, framing changes, and pacing/rhythm.

Also weave in, before or around the timeline:
- Overall visual style and color grading
- Lighting setup and how it evolves across the clip
- Camera lens/depth-of-field characteristics
- Environment/background detail
- Mood, atmosphere, and emotional arc across the ${durationSeconds} seconds
- Target aspect ratio: ${aspectRatio}
${templateBlock(styleTemplate)}
${brandContextBlock(brand)}

Output ONLY the refined prompt text itself, including the embedded timeline. No labels, no headers, no explanation, no quotation marks around it.

User's one-line concept: "${rawPrompt}"`;

  return refine(metaPrompt);
}

// Storyboard flow: each candidate image for a shot should stay visually coherent with the
// overall concept and with the shot's position in the sequence, not just its own one-liner.
export async function refineShotImagePrompt(
  shotDescription: string,
  storyboardConcept: string,
  shotIndex: number,
  shotCount: number,
  aspectRatio: string,
  brand?: BrandContext,
  referenceImageRole?: ReferenceImageRole,
): Promise<string> {
  const metaPrompt = `You are an award-winning associate creative director and prompt engineer, briefing a state-of-the-art AI image generation model (Google's Gemini native image generation) on shot ${shotIndex + 1} of ${shotCount} in a storyboard for a real ad campaign, concept: "${storyboardConcept}". This specific shot's brief is: "${shotDescription}".${referenceInstructionBlock(referenceImageRole)}

Expand this into an extremely detailed, production-ready image generation prompt of at least ${MIN_CHARS} characters (aim for ${MIN_CHARS}-6000 characters), written as flowing descriptive prose — NOT bullet points, NOT JSON, NOT numbered lists.
${qualityBarBlock("image")}

Cover in detail:
- The exact subject: appearance, materials, textures, pose, expression, product details
- Composition & framing: camera angle, lens choice, depth of field, rule-of-thirds placement, foreground/midground/background layering
- Lighting: direction, quality, color temperature, time of day, shadow behavior, highlights and reflections
- Color palette, grading, and overall mood/atmosphere — keep this visually consistent with a shot ${shotIndex + 1}-of-${shotCount} position in the same ad (e.g. same product, same color story, same setting family unless the concept calls for a scene change)
- Background and environment detail, set dressing, props
- Rendering/style cues: photography style, film stock or render engine quality descriptors (e.g. "ultra-realistic, 8k, sharp focus")
- Target aspect ratio: ${aspectRatio}
${brandContextBlock(brand)}

Output ONLY the refined prompt text itself. No labels, no headers, no explanation, no quotation marks around it.`;

  return refine(metaPrompt);
}

// Image-to-video mode: a starting frame is supplied separately, so the prompt should describe
// motion/animation from that frame rather than composing a new scene from scratch.
export async function refineShotVideoPrompt(
  shotDescription: string,
  storyboardConcept: string,
  shotIndex: number,
  shotCount: number,
  durationSeconds: number,
  aspectRatio: string,
  brand?: BrandContext,
): Promise<string> {
  const metaPrompt = `You are an award-winning ad film director and prompt engineer, briefing Google's Veo video generation model in image-to-video mode: a starting frame image is provided separately, and Veo will animate motion from it.

This is shot ${shotIndex + 1} of ${shotCount} in a storyboard for a real ad campaign, concept: "${storyboardConcept}". This specific shot's brief is: "${shotDescription}".

Expand this into an extremely detailed, production-ready image-to-video motion prompt of at least ${MIN_CHARS} characters (aim for ${MIN_CHARS}-6000 characters), written as flowing cinematic prose.
${qualityBarBlock("video")}

The clip is exactly ${durationSeconds} seconds long — break the motion into a precise second-by-second (or half-second) timeline from 0.0s to ${durationSeconds}s, e.g. "0.0s-1.0s: ...". For every beat describe camera movement, how the subject/scene animates and evolves from the starting frame, framing changes, and pacing.

Also describe overall visual style, lighting evolution, depth of field, mood, and how this shot's energy should flow given it is shot ${shotIndex + 1} of ${shotCount} (e.g. an opening shot should establish, a middle shot should build, a closing shot should resolve and land on the product).
Target aspect ratio: ${aspectRatio}
${brandContextBlock(brand)}

Output ONLY the refined prompt text itself, including the embedded timeline. No labels, no headers, no explanation, no quotation marks around it.`;

  return refine(metaPrompt);
}
