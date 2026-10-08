import { GoogleGenAI } from "@google/genai";
import { type AdContext } from "./dials";
import { env } from "./env";
import { type BrandContext } from "./prompt-refiner";
import { withRateLimitRetry } from "./rate-limit-retry";

// The ad direction team's researcher, ahead of the strategist: studies how the category's top
// brands advertise (structure, how they explain features, how they show the problem, copy,
// clichés) with live Google Search, so the strategy starts from real competitor work rather than
// only our general knowledge base. Added after the Aurelle shampoo film came out "too simple"
// until a manual round of competitor research rebuilt it.

const genAI = env.googleCloudProjectId ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation }) : null;

export interface CategoryResearch {
  notes: string;
  sources: { title: string; url: string }[];
}

export async function researchCategory(concept: string, ctx: AdContext, brand?: BrandContext): Promise<CategoryResearch | null> {
  if (!genAI) return null;
  const prompt = `You are the researcher on an ad agency's team. Before the strategist writes anything, study how the top brands in this ad's category advertise, using Google Search. Prefer specific, verifiable details (a named ad, its claim, its structure) over generalities, and say plainly where evidence is thin.

The ad: "${concept}"
${brand?.productName ? `Brand: ${brand.productName} (ours; never copy a rival's name, claim wording or trade dress)\n` : ""}Context: ${ctx.category}${ctx.beautySub ? ` (${ctx.beautySub})` : ""}, ${ctx.position} brand, ${ctx.tier} tier, audience ${ctx.audience}, goal ${ctx.goal}.

Study 5–8 real ads or campaigns from the category leaders (global and Indian where relevant). If the ad is UGC or creator-style (a person talking to a phone camera), study UGC and creator ads in this category instead of TV spots: the hook in the first 2 seconds, how the creator speaks, the cut rhythm, how the product is shown in hand, and what makes them feel genuine rather than staged. Write about 700 words of plain text in these sections:
1. STRUCTURE: the common beat structure of a 30s ad in this category, with typical timings.
2. HOW FEATURES ARE EXPLAINED: the devices brands use (demonstrations, named technologies, ingredient or spec shots, proof, comparisons), each with a brand example.
3. PURPOSE: how they show the problem the product solves, and the emotional payoff.
4. COPY: typical supers, claims, taglines and CTAs; flag any claim that needs substantiation (numbers, clinical or "best" claims) — we must never invent them.
5. CLICHÉS vs WHITE SPACE: what everyone does, and what a brand like ours could own instead.
6. NAME CLASHES: any rival product, technology or ingredient name close to ours.
Mark each point VERIFIED (you read it on a page) or INFERRED (a category pattern). No preamble.`;
  try {
    const response = await withRateLimitRetry("research", () =>
      genAI.models.generateContent({ model: env.textModel, contents: prompt, config: { tools: [{ googleSearch: {} }] } }),
    );
    const notes = response.text?.trim();
    if (!notes) return null;
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks.flatMap((c) => (c.web?.uri ? [{ title: c.web.title ?? c.web.uri, url: c.web.uri }] : []));
    return { notes, sources };
  } catch (err) {
    // Research sharpens the strategy but never blocks it.
    console.warn("[research] skipped:", err instanceof Error ? err.message : err);
    return null;
  }
}
