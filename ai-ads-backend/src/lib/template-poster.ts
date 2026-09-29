import { GoogleGenAI, Type } from "@google/genai";
import { env } from "./env";
import { generateImage, type GeneratedImage, type ReferenceImage } from "./image-gen";
import type { BrandContext } from "./prompt-refiner";
import { withRateLimitRetry } from "./rate-limit-retry";

// Template remixes: a curated template is a finished, fully typeset poster (headline, offer badge,
// icon rows, CTA, footer) plus the prompt that made it, with [Placeholders] for the content. Unlike
// the regular poster path — which keeps all text out of the image and typesets it afterwards — the
// image model draws the whole layout here, text included, because the typography IS the template.
// The template image goes in as a style reference, the copy is written from the user's request,
// and every result is proofread against that copy before it is kept.

const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation })
  : null;

export interface FilledTemplate {
  // The template prompt with every placeholder replaced by real content (or removed).
  prompt: string;
  // Every piece of text that should be readable on the poster, exactly as it should be spelled.
  texts: string[];
}

// Fills the template's [Placeholders] from the user's request and brand kit. Facts the user didn't
// give (prices, discounts, dates, phone, website, address, awards) are never invented: their
// placeholders are dropped along with the element that would show them.
export async function fillTemplate(
  templatePrompt: string,
  request: string,
  brand: BrandContext | undefined,
  options: { productNames: string[] },
): Promise<FilledTemplate> {
  if (!genAI) throw new Error("Text generation is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  const brandLines = [
    brand?.productName && `Brand name: ${brand.productName}`,
    brand?.primaryColor && `Brand colors: ${[brand.primaryColor, brand.secondaryColor].filter(Boolean).join(", ")}`,
    brand?.tagline && `Brand tagline: ${brand.tagline}`,
    brand?.brandRules && `Brand rules: ${brand.brandRules}`,
    options.productNames.length && `Real product photos are attached for: ${options.productNames.join(", ")} — the poster shows these exact products.`,
  ].filter(Boolean);
  const response = await withRateLimitRetry("template-fill", () =>
    genAI.models.generateContent({
      model: env.textModel,
      contents: `You are a senior advertising copywriter and art director adapting a poster template for a client.

TEMPLATE PROMPT (it contains [Placeholders] in square brackets):
${templatePrompt}

CLIENT REQUEST (what this poster is for, in the client's words):
"${request}"
${brandLines.length ? `\n${brandLines.join("\n")}\n` : ""}
Rewrite the template prompt as the final image-generation prompt for this client's poster:
- Replace every [Placeholder] with concrete content for this client. The template's layout has text slots (headline, supporting message, feature/icon labels, badge text, call to action, taglines): write short, strong ad copy for EVERY slot, in the language of the request, so the image model never has to improvise words. Keep all of the template's text slots and graphic devices — feature or icon rows, badges, ribbons, taglines — because dropping them makes the poster look empty and unlike the template; only drop a slot that needs a fact the client didn't give.
- Never invent facts the client didn't give: prices, discounts, offers, dates, phone numbers, websites, emails, addresses, social handles, awards, certifications, statistics. Remove those placeholders — and the badge, line, or footer element that would show them — from the prompt, and say explicitly that the poster has no website, phone, address, or contact footer when none was given.
- [Brand Logo]: the real logo is placed on the finished poster afterwards. Replace it with an instruction to keep that spot as the poster's continuous background — no logo, brand mark, text, box, panel, frame, or placeholder shape there — and name where it is (e.g. "top-left corner").
- Keep all of the template's layout, style, typography, colour, lighting, and quality direction.
- Quote every visible text element exactly, and end the prompt with: "Use only these visible text elements, spelled exactly as written:" followed by the list.
Return JSON: "prompt" (the final prompt) and "texts" (every visible text element, exactly as it must appear).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { prompt: { type: Type.STRING }, texts: { type: Type.ARRAY, items: { type: Type.STRING } } },
          required: ["prompt", "texts"],
        },
      },
    }),
  );
  const parsed = JSON.parse(response.text ?? "{}") as Partial<FilledTemplate>;
  if (!parsed.prompt) throw new Error("Template fill returned no prompt");
  return { prompt: parsed.prompt, texts: (parsed.texts ?? []).map((t) => t.trim()).filter(Boolean) };
}

export interface ProofResult {
  ok: boolean;
  issues: string[];
}

// Reads the poster's text and checks it against the intended copy: every line present and spelled
// right, no garbled pseudo-lettering, nothing extra, no drawn logo in the space kept for the real one.
export async function proofreadPoster(image: GeneratedImage, texts: string[]): Promise<ProofResult> {
  if (!genAI) return { ok: true, issues: [] };
  try {
    const response = await withRateLimitRetry("template-proof", () =>
      genAI.models.generateContent({
        // Pro, not Flash: Flash missed most of the extra words (copied template slogans, an invented
        // phone number) in testing.
        model: env.textModel,
        contents: [
          { inlineData: { data: image.imageBytes, mimeType: image.mimeType } },
          `This advertising poster should contain exactly these text elements, spelled exactly as written:
${texts.map((t) => `- "${t}"`).join("\n")}
First read every piece of text on the poster, however small (badges, icon labels, footers). Then list every problem: an expected element that is missing or misspelled (quote what you see), garbled or random lettering, any word or line that is not in the list (quote it — including placeholder text in square brackets, slogans, websites, phone numbers, addresses), or a drawn logo or brand mark. Ignore capitalisation and line breaks. Return an empty list if it is correct.`,
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: { type: Type.OBJECT, properties: { issues: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["issues"] },
        },
      }),
    );
    const issues = (JSON.parse(response.text ?? "{}") as { issues?: string[] }).issues ?? [];
    return { ok: issues.length === 0, issues };
  } catch (err) {
    console.warn("[template-poster] proofread failed, accepting unchecked:", err instanceof Error ? err.message : err);
    return { ok: true, issues: [] };
  }
}

const MAX_ATTEMPTS = 3;

// One template poster: the template image as the style reference, the client's products as exact
// references, proofread and re-rolled (with the problems fed back) until the text is right; the
// attempt with the fewest problems is kept.
export async function generateTemplatePoster(
  filled: FilledTemplate,
  aspectRatio: string,
  templateImage: ReferenceImage,
  products: { image: ReferenceImage; name: string }[],
): Promise<GeneratedImage> {
  const guide = `The FIRST attached image is the design TEMPLATE: reproduce its layout system, typography style and hierarchy, colour treatment, graphic devices, composition, and finish — the same kind of ad — but with this poster's own content. Never copy the template's words, brand name, logo, people, or products: the template's text (its sample headlines and slogans, and anything in [square brackets]) must not appear anywhere. Every word on the poster must come from this list, spelled exactly: ${filled.texts.map((t) => `"${t}"`).join(", ")}. Add no other words — no website, phone number, address, social handle, or contact footer unless it is in that list.${
    products.length ? ` The other attached images are the client's real products (${products.map((p) => p.name).join(", ")}): show them exactly as they are, with their genuine packaging.` : ""
  }`;
  const refs = [templateImage, ...products.map((p) => p.image)];
  let best: { image: GeneratedImage; issues: string[] } | null = null;
  let feedback = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const image = await generateImage(`${guide}\n\n${filled.prompt}${feedback}`, aspectRatio, refs);
    const proof = await proofreadPoster(image, filled.texts);
    if (!best || proof.issues.length < best.issues.length) best = { image, issues: proof.issues };
    if (proof.ok) return image;
    console.warn(`[template-poster] attempt ${attempt} has text problems:`, proof.issues.join("; "));
    feedback = `\n\nThe previous attempt had these text problems — fix them: ${proof.issues.join("; ")}. Spell every word exactly as listed.`;
  }
  console.warn(`[template-poster] kept the attempt with ${best!.issues.length} text problem(s)`);
  return best!.image;
}
