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

// Length target: Google's own Veo 3.1 / Nano Banana example prompts run ~300-500 characters
// EACH — but those are single-shot examples. Veo 3.1 specifically parses prompts via "atomic
// scene processing" with front-loaded token weighting (it's built to work well with segmented
// scenes, unlike older models that hallucinate a whole clip from one paragraph), so a real ad
// clip needs several such scenes, not one. Their combined length is what should land here —
// not one giant paragraph, and not a single 300-char blob either.
const MIN_CHARS = 1800;
const MAX_CHARS = 2000;
// Matches MIN_CHARS deliberately — a shorter result used to be accepted as a fallback, but
// "at least 1800 characters" is a hard requirement, not a nice-to-have.
const RETRY_MIN_CHARS = MIN_CHARS;

// LTX's guide puts it at "one main action per 2-3 seconds of video" — each entry in the JSON
// `scenes` array below is one such beat, sized like Google's own single-shot examples
// (~300-400 characters of actual scene description), not a half-second timestamp grid.
function sceneCount(durationSeconds: number): number {
  return Math.max(1, Math.round(durationSeconds / 2.5));
}

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
- The frame must be completely free of written language and brand marks — the brand's logo and tagline are composited on afterward. Image/video models paint whatever names and words they are given, and a bare "no text" instruction reliably fails, so achieve this through what you write, not by forbidding things:
  - NEVER write the brand or product name anywhere in your output. Refer to the product only by its physical form ("a running sneaker", "a glass perfume bottle", "a school campus"), never "a <Brand> sneaker".
  - Describe the product as an original, unbranded design with plain, unmarked surfaces (e.g. "seamless single-color knit upper with smooth, unmarked side panels"), so it cannot default to a famous real product's look — no swooshes, stripes, monograms, or signature silhouettes of real brands.
  - Never mention signage, posters, banners, billboards, labels, screens, packaging copy, jerseys with numbers, or typography of any kind. If the concept says "sale", "announcement", "poster", or "campaign", express that purely as visual energy and composition — those words must not appear in your output.
  - Do not list the things to avoid (the words "text", "logo", "lettering" in your output make the model more likely to draw them); describe clean surfaces and backgrounds positively instead.`;

  // Posters get a real logo + tagline composited on afterward (see poster-overlay.ts) at fixed,
  // known zones — telling the model exactly where those land (not just "leave some space
  // somewhere") is the difference between a composition that actually works once the overlay
  // is added and one that gets a logo/tagline slapped over its most important detail.
  const imageAddendum = `
- Reserve two exact zones as calm, uncluttered negative space — nothing important (faces, product details, focal point) may fall inside them: a strip across the FULL WIDTH of the BOTTOM 12% of the frame (a solid-color tagline bar gets composited there, full-bleed), and within that same bottom strip, the BOTTOM-LEFT corner in particular must also stay clear a little higher up — the logo is composited there too, roughly 8% of the frame's height, anchored to the bottom-left with a small margin.`;

  const videoAddendum =
    "\n- Avoid AI-video tells too: rubbery or inconsistent physics, morphing geometry between frames, drifting continuity errors, aimless camera motion. Every camera move should be a deliberate choice building toward one clear payoff moment.";

  return `\n\n${common}${medium === "image" ? imageAddendum : videoAddendum}`;
}

// "subject" = ground on a real photo (own product, or a prior generation for continuity) —
// keep it literally recognizable. "style" = match mood/color/lighting/style, but the subject
// and scene should be an original creation, not a reproduction of the reference image.
export type ReferenceImageRole = "subject" | "style";

function referenceInstructionBlock(referenceImageRole?: ReferenceImageRole): string {
  if (referenceImageRole === "subject") {
    return `\n\nA reference image is attached. Every scene must keep the exact same subject/product appearance, materials, colors, and overall visual style as that reference — only the pose, action, framing, and setting should change to match this brief. (The product's own genuine markings in that reference may stay; the plain-unmarked-surfaces rule above applies to everything else in the frame.)`;
  }
  if (referenceImageRole === "style") {
    return `\n\nA style reference image is attached. Match that reference's mood, color palette, lighting character, and overall visual style — but the subject and scene must be an original creation for this brief, not a literal reproduction of whatever is depicted in the reference.`;
  }
  return "";
}

// Brand rules get their own hard-constraint framing, separate from the softer facts
// (colors/font/tagline) — "weave in naturally" language let the model quietly drop them
// when they competed with the quality-bar instructions instead of treating them as binding.
function brandContextBlock(brand?: BrandContext): string {
  if (!brand) return "";

  const rulesLine = brand.brandRules
    ? `\n\nMANDATORY BRAND RULES — non-negotiable creative constraints, not suggestions. Every scene (subject, setting, palette, tone, mood, composition) MUST comply with these, even where they conflict with your own creative instincts or the guidance above:\n"${brand.brandRules}"`
    : "";

  // Name and tagline are context only — any name that reaches the image model gets painted onto
  // the product. The font is left out entirely: it's only used by the overlay, and a typography
  // cue in a text-free image just invites lettering.
  const facts = [
    brand.productName && `Brand name (context only — NEVER write this name in your output): ${brand.productName}`,
    brand.tagline && `Brand tagline (context for tone only — NEVER quote it in your output): ${brand.tagline}`,
    brand.primaryColor && `Primary brand color: ${brand.primaryColor}`,
    brand.secondaryColor && `Secondary brand color: ${brand.secondaryColor}`,
  ].filter(Boolean);
  const factsBlock = facts.length
    ? `\n\nBrand facts to reflect in the scene (weave in naturally — do not just list them):\n${facts.join("\n")}`
    : "";

  return `${rulesLine}${factsBlock}`;
}

const JSON_OUTPUT_RULE =
  'Output ONLY valid JSON matching the schema below — no markdown code fences, no commentary, no text before or after the JSON object. Every string value should read like Google\'s own example prompts (concrete, specific, cinematic phrasing), not a keyword list.';

// Models routinely ignore "no markdown fences" instructions and wrap JSON in ```json ... ```
// anyway — strip defensively rather than relying on the instruction alone.
function stripCodeFence(text: string): string {
  const fenced = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return (fenced ? fenced[1] : text).trim();
}

async function refine(metaPrompt: string): Promise<string> {
  if (!genAI) {
    throw new Error("Prompt refinement is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  }

  const MAX_ATTEMPTS = 3;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const prompt = attempt === 0
      ? metaPrompt
      : `${metaPrompt}\n\nIMPORTANT: your previous attempt was too short. The combined JSON must be at least ${MIN_CHARS} characters of dense, concrete visual detail across its fields — do not summarize or stop early.`;

    const response = await genAI.models.generateContent({
      model: env.textModel,
      contents: prompt,
    });

    const text = response.text ? stripCodeFence(response.text) : undefined;
    if (text && text.length >= RETRY_MIN_CHARS) return text;
    if (text && attempt === MAX_ATTEMPTS - 1) return text; // final attempt still short — use what we have
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
  const brandBlock = brandContextBlock(brand);
  const metaPrompt = `You are an award-winning associate creative director and prompt engineer, briefing a state-of-the-art AI image generation model (Google's Gemini native image generation) on the hero shot for a real ad campaign. A user gave a short, vague one-line ad concept.${referenceInstructionBlock(referenceImageRole)}
${qualityBarBlock("image")}
${brandBlock}

Expand the concept into a JSON object with this exact schema. The character counts in parentheses are per-field targets — hit them, and the total will land in the required ${MIN_CHARS}-${MAX_CHARS} character range; count as you write and trim before responding, this is a hard ceiling, not a suggestion:
{
  "subject": "the exact subject — appearance, materials, textures, pose, product details as an original design with plain unmarked surfaces, and what it's doing (~470 chars)",
  "composition_camera": "angle, lens choice, depth of field, framing (~280 chars)",
  "lighting_atmosphere": "direction, quality, color temperature, mood (~280 chars)",
  "background_environment": "setting, set dressing, props — every surface plain and unmarked (~330 chars)",
  "style_medium": "photography/render style, color grading, film stock or quality descriptors (~280 chars)",
  "aspect_ratio": "${aspectRatio}"${brandBlock ? ',\n  "brand_rules": "restated mandatory brand rules, verbatim or near-verbatim (~150 chars)"' : ""}
}
${templateBlock(styleTemplate)}

${JSON_OUTPUT_RULE}${brandBlock ? " Before you finish, double-check every field against the mandatory brand rules above." : ""}

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
  // A reference image switches Veo into image-to-video mode — every scene should describe
  // motion/animation from that starting frame rather than composing a new scene from scratch.
  const referenceInstruction = referenceImageRole
    ? `\n\nA reference image is attached as the starting frame — Veo will animate motion from it rather than generate a scene from scratch. ${
        referenceImageRole === "subject"
          ? "Keep the exact same subject/product appearance, materials, colors, and setting as that reference in every scene; describe only how it moves and how the camera moves around it."
          : "Match that reference's mood, color palette, lighting character, and overall visual style as the clip's starting point, while the subject and scene remain an original creation for this brief."
      }`
    : "";
  const brandBlock = brandContextBlock(brand);
  const scenes = sceneCount(durationSeconds);
  const metaPrompt = `You are an award-winning ad film director and prompt engineer, briefing Google's Veo video generation model on a real ad campaign's hero clip. A user gave a short, vague one-line ad concept. Veo 3.1 processes prompts as segmented scenes rather than one hallucinated paragraph, so structure this as ${scenes} distinct scene${scenes > 1 ? "s" : ""} — roughly one main action per 2-3 seconds of the ${durationSeconds}-second clip, each scene sized like a real single-shot prompt (concrete, specific, ~300-400 characters), not a half-second timestamp grid.${referenceInstruction}
${qualityBarBlock("video")}
${brandBlock}

Expand the concept into a JSON object with this exact schema. The character counts in parentheses are per-field targets — hit them, and the total will land in the required ${MIN_CHARS}-${MAX_CHARS} character range; count as you write and trim before responding, this is a hard ceiling, not a suggestion (it applies to the WHOLE JSON string, all ${scenes} scenes combined, not per scene on top of that):
{
  "style_ambiance": "overall visual style, color grading, mood across the whole clip (~150 chars)",
  "lighting": "lighting setup and how it evolves across the clip (~150 chars)",
  "camera_lens": "lens/depth-of-field character used throughout (~130 chars)",
  "environment": "the setting/background shared across scenes (~150 chars)",
  "scenes": [
    { "beat": "1 of ${scenes}", "camera": "camera movement for this beat", "action": "what the subject does, in this beat", "framing": "shot framing/composition for this beat" }
    // exactly ${scenes} objects in this array, in order, each one's camera+action+framing fields combined totaling ~${Math.round(950 / scenes)} chars; the last one must land on a clear payoff moment on the product
  ],
  "aspect_ratio": "${aspectRatio}",
  "negative_prompt": "a short comma-separated list of what to avoid, from the non-negotiables above (~120 chars)"${brandBlock ? ',\n  "brand_rules": "restated mandatory brand rules, verbatim or near-verbatim (~150 chars)"' : ""}
}
${templateBlock(styleTemplate)}

${JSON_OUTPUT_RULE}${brandBlock ? " Before you finish, double-check every scene against the mandatory brand rules above." : ""}

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
${qualityBarBlock("image")}
${brandContextBlock(brand)}

Expand this shot's brief into a JSON object with this exact schema. The character counts in parentheses are per-field targets — hit them, and the total will land in the required ${MIN_CHARS}-${MAX_CHARS} character range; count as you write and trim before responding, this is a hard ceiling, not a suggestion:
{
  "subject": "the exact subject — appearance, materials, textures, pose, product details as an original design with plain unmarked surfaces (~470 chars)",
  "composition_camera": "angle, lens choice, depth of field, framing (~280 chars)",
  "lighting_atmosphere": "direction, quality, color temperature (~280 chars)",
  "background_environment": "setting, set dressing, props — every surface plain and unmarked (~330 chars)",
  "style_medium": "photography style, color grading, film stock or quality descriptors — keep this visually consistent with a shot ${shotIndex + 1}-of-${shotCount} position in the same ad, same product, same color story, same setting family unless the concept calls for a scene change (~280 chars)",
  "aspect_ratio": "${aspectRatio}"
}

${JSON_OUTPUT_RULE}`;

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
  const scenes = sceneCount(durationSeconds);
  const metaPrompt = `You are an award-winning ad film director and prompt engineer, briefing Google's Veo video generation model in image-to-video mode: a starting frame image is provided separately, and Veo will animate motion from it.

This is shot ${shotIndex + 1} of ${shotCount} in a storyboard for a real ad campaign, concept: "${storyboardConcept}". This specific shot's brief is: "${shotDescription}". Structure this as ${scenes} distinct scene${scenes > 1 ? "s" : ""} — roughly one main action per 2-3 seconds of the ${durationSeconds}-second clip, each scene sized like a real single-shot prompt (concrete, specific, ~300-400 characters), not a half-second timestamp grid.
${qualityBarBlock("video")}
${brandContextBlock(brand)}

Expand this into a JSON object with this exact schema. The character counts in parentheses are per-field targets — hit them, and the total will land in the required ${MIN_CHARS}-${MAX_CHARS} character range; count as you write and trim before responding, this is a hard ceiling, not a suggestion (it applies to the WHOLE JSON string, all ${scenes} scenes combined, not per scene on top of that):
{
  "style_ambiance": "overall visual style, lighting evolution, depth of field, mood — how this shot's energy should flow given it is shot ${shotIndex + 1} of ${shotCount} (e.g. an opening shot should establish, a middle shot should build, a closing shot should resolve and land on the product) (~300 chars)",
  "scenes": [
    { "beat": "1 of ${scenes}", "camera": "camera movement for this beat", "action": "how the subject/scene animates and evolves from the starting frame, in this beat", "framing": "framing changes for this beat" }
    // exactly ${scenes} objects in this array, in order, each one's camera+action+framing fields combined totaling ~${Math.round(1300 / scenes)} chars
  ],
  "aspect_ratio": "${aspectRatio}",
  "negative_prompt": "a short comma-separated list of what to avoid, from the non-negotiables above (~120 chars)"
}

${JSON_OUTPUT_RULE}`;

  return refine(metaPrompt);
}
