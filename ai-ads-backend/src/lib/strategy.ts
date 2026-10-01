import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenAI, Type } from "@google/genai";
import { type CreativeBrief } from "./creative-brief";
import {
  type AdContext,
  adjustDial,
  AUDIENCES,
  BEAUTY_SUBS,
  CATEGORIES,
  computeDials,
  DEVICES,
  DIAL_IDS,
  type DialFlags,
  type DialId,
  type Dials,
  dialsText,
  GOALS,
  POSITIONS,
  RAILS,
  TIERS,
} from "./dials";
import { env } from "./env";
import { type BrandContext } from "./prompt-refiner";
import { withRateLimitRetry } from "./rate-limit-retry";

// The ad direction team's first two roles, ahead of the director: a strategist who reads the
// brand's context, sets the dials (knowledge/dials.md) and writes the proposition, and a creative
// director who checks it against the rails and signs it off. The director then writes to it.

const genAI = env.googleCloudProjectId
  ? new GoogleGenAI({ vertexai: true, project: env.googleCloudProjectId, location: env.textLocation })
  : null;

export interface AdStrategy {
  context: AdContext;
  contextReasons: Record<string, string>;
  assumptions: string[];
  flags: DialFlags;
  dials: Dials;
  buyerTruth: string;
  // The viewer's own words: "I should buy X because…".
  proposition: string;
  device: { type: string; howShown: string };
  enemy: string | null;
  fluentDevice: string;
  taglineOptions: string[];
  tagline: string;
  cta: string;
  // Parts of the client concept that break a rail or a dial, and how the film resolves each.
  conceptConflicts: { conflict: string; fix: string }[];
  shotPrinciples: string[];
  // The features the film demonstrates, each with its callout super.
  features: { feature: string; callout: string; what_it_does: string; how_shown: string }[];
  brandPresence: string;
  review: { approved: boolean; notes: string[] };
}

// The knowledge base lives at the repo root, next to the backend; absent in a deploy that ships
// only the backend, in which case the dials and rails (in code) still apply.
function knowledgeFor(ctx: AdContext): string {
  const root = [join(__dirname, "../../../knowledge"), join(__dirname, "../../knowledge")].find(existsSync);
  if (!root) return "";
  const read = (p: string) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "");
  const genre = { automotive: "automotive", "food-beverage": "food-beverage", "tech-electronics": "tech-electronics", beauty: "beauty-fashion-luxury", "apps-services-education": "apps-services-education" }[ctx.category];
  // From the production playbook: what makes an AI ad look real, and our own failures.
  const playbook = read("ai-ad-production-playbook.md");
  const section = (n: number) => playbook.match(new RegExp(`## ${n}\\. [\\s\\S]*?(?=\\n## |$)`))?.[0] ?? "";
  return [read("copywriting-principles.md"), read(`genres/${genre}.md`), section(1), section(11)].filter(Boolean).join("\n\n---\n\n");
}

async function json<T>(label: string, contents: string, schema: object): Promise<T> {
  const response = await withRateLimitRetry(label, () =>
    genAI!.models.generateContent({ model: env.textModel, contents, config: { responseMimeType: "application/json", responseSchema: schema } }),
  );
  if (!response.text) throw new Error(`${label} returned no text`);
  return JSON.parse(response.text) as T;
}

const STRING = { type: Type.STRING };
const NULLABLE_STRING = { type: Type.STRING, nullable: true };
const STRINGS = { type: Type.ARRAY, items: STRING };
const enumOf = (values: readonly string[], nullable = false) => ({ type: Type.STRING, enum: [...values], nullable });

function briefFacts(concept: string, brief: CreativeBrief, brand?: BrandContext): string {
  return [
    `Client concept: "${concept}"`,
    brand?.productName && `Brand: ${brand.productName}`,
    brand?.tagline && `The client's own tagline (keep it unless the concept asks for a new one): "${brand.tagline}"`,
    brand?.brandRules && `Brand rules: ${brand.brandRules}`,
    brief.audience && `Audience: ${brief.audience}`,
    brief.keyMessage && `Key message: ${brief.keyMessage}`,
    brief.mustShow && `Must show: ${brief.mustShow}`,
    brief.avoid && `Must avoid: ${brief.avoid}`,
    `Tone chosen: ${brief.tone}; look: ${brief.look}; length: ${brief.lengthSeconds}s`,
    `Voice-over: ${brief.voiceover ? "yes" : brief.endCardVoice ? "only the brand name and tagline spoken over the end card" : "none (music only)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Step 1: the context the dials are set from. Humour counts as requested only with a quote that
// really is in the client's words.
async function readContext(facts: string, sourceText: string) {
  const raw = await json<{
    category: AdContext["category"];
    beauty_sub: AdContext["beautySub"];
    position: AdContext["position"];
    tier: AdContext["tier"];
    audience: AdContext["audience"];
    goal: AdContext["goal"];
    reasons: Record<string, string>;
    assumptions: string[];
    humour_quote: string | null;
    real_offer: string | null;
  }>(
    "strategy-context",
    `You are the account planner on an ad. Read the brief and classify the brand's context. Infer what isn't stated, and list each inference under assumptions.

${facts}

- category: the product's genre.
- beauty_sub: for beauty only (grooming, sportswear, self-esteem, luxury); otherwise null.
- position: famous (an incumbent whose assets people already know), challenger (known, but smaller than the leader), or new (an unknown brand, including any brand launching its first product).
- tier: value, mid, premium or luxury, from the price, the brand rules and how the brand describes itself.
- audience: the closest segment.
- goal: launch (introduce the brand or product), feature (sell one specific advantage), brand (build feeling for a known brand), offer (drive action now: a sale, price, sign-up).
- reasons: one short sentence per field (category, position, tier, audience, goal).
- humour_quote: ONLY if the client explicitly asks for humour, comedy, jokes or a funny ad, the exact words where they ask (copied verbatim); otherwise null. Do not infer it from the genre or the tone.
- real_offer: a real price, sale, discount or deadline stated in the brief, verbatim; otherwise null.`,
    {
      type: Type.OBJECT,
      properties: {
        category: enumOf(CATEGORIES),
        beauty_sub: enumOf(BEAUTY_SUBS, true),
        position: enumOf(POSITIONS),
        tier: enumOf(TIERS),
        audience: enumOf(AUDIENCES),
        goal: enumOf(GOALS),
        reasons: { type: Type.OBJECT, properties: { category: STRING, position: STRING, tier: STRING, audience: STRING, goal: STRING } },
        assumptions: STRINGS,
        humour_quote: NULLABLE_STRING,
        real_offer: NULLABLE_STRING,
      },
      required: ["category", "position", "tier", "audience", "goal", "reasons", "assumptions"],
    },
  );
  const inSource = (q: string | null) => Boolean(q && q.trim().length > 3 && sourceText.toLowerCase().includes(q.trim().toLowerCase()));
  return {
    context: { category: raw.category, beautySub: raw.category === "beauty" ? raw.beauty_sub ?? "luxury" : null, position: raw.position, tier: raw.tier, audience: raw.audience, goal: raw.goal } as AdContext,
    reasons: raw.reasons ?? {},
    assumptions: raw.assumptions ?? [],
    humourRequested: inSource(raw.humour_quote),
    realOffer: inSource(raw.real_offer),
  };
}

const STRATEGY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    buyer_truth: STRING,
    proposition: STRING,
    device: { type: Type.OBJECT, properties: { type: STRING, how_shown: STRING }, required: ["type", "how_shown"] },
    enemy: NULLABLE_STRING,
    fluent_device: STRING,
    tagline_options: STRINGS,
    tagline: STRING,
    cta: STRING,
    dial_adjustments: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { dial: enumOf(DIAL_IDS), to: { type: Type.INTEGER }, reason: STRING }, required: ["dial", "to", "reason"] } },
    concept_conflicts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { conflict: STRING, fix: STRING }, required: ["conflict", "fix"] } },
    features: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { feature: STRING, callout: STRING, what_it_does: STRING, how_shown: STRING }, required: ["feature", "callout", "what_it_does", "how_shown"] } },
    brand_presence: STRING,
    shot_principles: STRINGS,
  },
  required: ["features", "brand_presence", "buyer_truth", "proposition", "device", "fluent_device", "tagline_options", "tagline", "cta", "dial_adjustments", "concept_conflicts", "shot_principles"],
};

interface RawStrategy {
  buyer_truth: string;
  proposition: string;
  device: { type: string; how_shown: string };
  enemy?: string | null;
  fluent_device: string;
  tagline_options: string[];
  tagline: string;
  cta: string;
  dial_adjustments: { dial: DialId; to: number; reason: string }[];
  concept_conflicts: { conflict: string; fix: string }[];
  shot_principles: string[];
  features?: { feature: string; callout: string; what_it_does: string; how_shown: string }[];
  brand_presence?: string;
}

const STRATEGY_FIELDS = `Return JSON:
- buyer_truth: one sentence, a real truth about the buyer or the product the idea starts from (not a slogan).
- proposition: the one reason, in the viewer's own words: "I should buy <brand> because …" — tangible, repeatable after one viewing, at the specificity the D11 dial sets.
- device: type (demonstration, metaphor, story, character, honesty, or humour only if D1 > 0) and how_shown: in two sentences, what the viewer SEES that proves the proposition, within the dials (camera, pace) and the rails.
- enemy: the old way or the problem the film pushes against, at the D12 setting; null at D12 0.
- fluent_device: one recurring asset (a sound, a shot, a line or a character) this brand can reuse in every ad, and where it appears in this film.
- tagline_options: three taglines of at most 8 words, specific to this brand, that could become shared language; no generic lifestyle lines.
- tagline: the one for the end card. The client's own tagline wins if they have one.
- cta: the single, specific call to action at the D13 setting (heard and seen).
- dial_adjustments: only where this brief truly needs a dial one step away from its computed value, with the reason; usually empty. D1 humour can never go up unless the user asked for humour.
- concept_conflicts: every part of the client concept or must-show that breaks a rail or a dial (a move Veo can't render realistically, a montage of places, text in shot, a rival's design), each with the fix that keeps the client's intent.
- features: for a physical product, the 3–4 features that prove the proposition, each with: feature (the part), callout (the super naming it, at most 4 words, using only facts in the brief — never an invented number or spec), what_it_does (for the buyer), how_shown (a dedicated close-up whose action SHOWS it working, not a glint on a static part). An empty list only for products with nothing to demonstrate.
- brand_presence: exactly where the brand is seen — the badge or logo on the product (which shots), the corner watermark, the end card. The product's own badge appears early and in the hero shot.
- shot_principles: 3–6 short rules the director must follow for this film, derived from the dials (e.g. "every moving shot is coupled: the camera car at the bike's exact speed").`;

function toStrategy(raw: RawStrategy) {
  return {
    buyerTruth: raw.buyer_truth,
    proposition: raw.proposition,
    device: { type: raw.device?.type ?? "", howShown: raw.device?.how_shown ?? "" },
    enemy: raw.enemy?.trim() || null,
    fluentDevice: raw.fluent_device,
    taglineOptions: raw.tagline_options ?? [],
    tagline: raw.tagline,
    cta: raw.cta,
    conceptConflicts: raw.concept_conflicts ?? [],
    shotPrinciples: raw.shot_principles ?? [],
    features: raw.features ?? [],
    brandPresence: raw.brand_presence ?? "",
  };
}

export async function writeStrategy(concept: string, brief: CreativeBrief, brand?: BrandContext): Promise<AdStrategy> {
  if (!genAI) throw new Error("Text generation is not configured — missing GOOGLE_CLOUD_PROJECT_ID");
  const facts = briefFacts(concept, brief, brand);
  const read = await readContext(facts, [concept, brand?.brandRules ?? "", brief.keyMessage ?? "", brief.mustShow ?? ""].join("\n"));
  const flags: DialFlags = {
    humourRequested: read.humourRequested,
    voiceover: brief.voiceover,
    endCardVoice: Boolean(brief.endCardVoice),
    veoAudio: Boolean(brief.veoAudio),
    realOffer: read.realOffer,
  };
  const dials = computeDials(read.context, flags);
  const ctx = read.context;
  const ctxLine = `Context: ${ctx.category}${ctx.beautySub ? ` (${ctx.beautySub})` : ""} · ${ctx.position} brand · ${ctx.tier} tier · audience ${ctx.audience} · goal ${ctx.goal}`;
  const knowledge = knowledgeFor(ctx);
  const shared = `${facts}

${ctxLine}

DIALS (0–4, computed from the context by our evidence-based rules; the film is made at these settings):
${dialsText(dials)}

${RAILS}

${DEVICES}${knowledge ? `\n\nKNOWLEDGE BASE (our evidence from famous-brand ads; apply what fits this context):\n${knowledge}` : ""}`;

  const draft = await json<RawStrategy>(
    "strategy-write",
    `You are the strategist on a famous ad agency's team, writing the creative strategy for one ad before any script exists. Ground every choice in the dials and the knowledge base; don't invent rules.

${shared}

${STRATEGY_FIELDS}`,
    STRATEGY_SCHEMA,
  );

  // The creative director: the one decision-maker. Corrects the strategy in the same shape and
  // says whether it is approved as returned.
  const reviewed = await json<RawStrategy & { approved: boolean; review_notes: string[] }>(
    "strategy-review",
    `You are the creative director, the one decision-maker on the team. Review the strategist's work before the director writes a script. Fix every failure and return the corrected strategy in the same JSON shape, plus approved (true when it is ready for the director as returned) and review_notes (what you changed and why; empty if nothing).

Check:
1. Could a stranger repeat the proposition after one viewing? Is it ONE reason, specific to this brand and product (its design, its engineering, its price, its origin), not something every rival in the category could claim? Test it: swap in a competitor's name; if the sentence still works, it is too generic. Rewrite it.
2. Does the device SHOW the proposition, and can our AI pipeline render it realistically at these dials (rail 6)? Prefer the simpler shot that proves the same thing.
3. Does every choice match its dial (humour, emotion, pace, camera, grade, copy, VO, music, sound, claim, enemy, urgency)? A dial adjustment needs a real reason in this brief, and humour can never be raised unless the user asked.
4. Has every conflict in the client concept been caught, with a fix that keeps what the client wants? Walk the concept line by line: count its locations and its times of day (the D8 limit allows ONE time of day and one light direction; a sky that changes across the film is a conflict), list every camera or subject move (rail 6, the D7 cap), and compare it with "Our own lessons" in the knowledge base — a choice that failed before is a conflict now.
5. Is each tagline under 8 words, specific, ownable? Does the client's own tagline stay if they gave one?
6. Is the fluent device something the brand can really reuse?
7. For a new product: does the film DEMONSTRATE its features (each in its own close-up, shown working, with a callout), or is it just a journey with the product in it? A launch that is "just a ride" fails.
8. Is the brand on the product itself (its badge, early and in the hero) plus a corner watermark? A product description saying "no logos" means no other brand's logos, never no logo of our own.

${shared}

${STRATEGY_FIELDS}
- approved, review_notes.

Strategist's work:
${JSON.stringify(draft, null, 2)}`,
    {
      ...STRATEGY_SCHEMA,
      properties: { ...STRATEGY_SCHEMA.properties, approved: { type: Type.BOOLEAN }, review_notes: STRINGS },
      required: [...STRATEGY_SCHEMA.required, "approved", "review_notes"],
    },
  );
  const final = reviewed.proposition && reviewed.tagline ? reviewed : { ...draft, approved: false, review_notes: ["creative director review failed; strategist's draft kept"] };
  for (const a of final.dial_adjustments ?? []) {
    if (DIAL_IDS.includes(a.dial)) adjustDial(dials, a.dial, a.to, a.reason, ctx, flags);
  }
  // An enemy is a combativeness setting: naming one at D12 0 moves the dial (within its limit), or drops it.
  if (final.enemy?.trim() && dials.D12.value === 0 && !adjustDial(dials, "D12", 1, "the strategy names an enemy (the old way or a problem)", ctx, flags)) final.enemy = null;
  // The client's own tagline always wins.
  const tagline = brand?.tagline?.trim() || final.tagline;
  return {
    context: ctx,
    contextReasons: read.reasons,
    assumptions: read.assumptions,
    flags,
    dials,
    ...toStrategy(final),
    tagline,
    review: { approved: Boolean(final.approved), notes: final.review_notes ?? [] },
  };
}

// The signed-off strategy as a block in the director's brief, so the draft, the review and the
// judge all work to it.
export function strategyDirection(s: AdStrategy): string {
  return `CREATIVE STRATEGY (signed off by the creative director; the treatment must deliver it exactly):
- Proposition, in the viewer's words: ${s.proposition}
- Buyer truth: ${s.buyerTruth}
- Device (${s.device.type}): ${s.device.howShown}
${s.enemy ? `- Enemy: ${s.enemy}\n` : ""}${s.features?.length ? `- Features to demonstrate, each in its own close-up with its callout super (typeset in the edit, never in the footage):\n${s.features.map((f) => `  - ${f.feature} — callout "${f.callout}": ${f.what_it_does}. Shown: ${f.how_shown}`).join("\n")}\n` : ""}${s.brandPresence ? `- Brand presence: ${s.brandPresence}\n` : ""}- Fluent device: ${s.fluentDevice}
- Tagline (end_card_tagline is exactly this): "${s.tagline}"
- Call to action: ${s.cta}
- Dials (0–4) — every shot, line, cut and the music must sit at these settings:
${dialsText(s.dials).split("\n").map((l) => `  ${l}`).join("\n")}
- Shot principles:
${s.shotPrinciples.map((p) => `  - ${p}`).join("\n")}${s.conceptConflicts.length ? `\n- Concept conflicts, resolved as follows (the fix wins over the concept's wording):\n${s.conceptConflicts.map((c) => `  - ${c.conflict} → ${c.fix}`).join("\n")}` : ""}

${RAILS}`;
}

// The script supervisor: reads every shot of the director's treatment against the signed-off
// strategy and the realism rails, and returns each failure with its fix — the checks that need
// judgement (a sweeping bend, a silhouetted hero, a sky that changes), which code can't make.
export async function auditScript(s: AdStrategy, brief: CreativeBrief, treatment: unknown): Promise<string[]> {
  const raw = await json<{ failures: { shot: number; rule: string; problem: string; fix: string }[] }>(
    "script-audit",
    `You are the script supervisor on an AI-generated ad, the strictest reader on the team. Check every shot of the director's treatment against the creative strategy and the rails below, and list every failure. Pass only what will really render realistically and deliver the strategy; do not list matters of taste.

Check each shot for:
1. Rail 6 realism: the camera is locked, or coupled to the subject at its exact speed. The subject moves in one straight line or one gentle arc (a moderate lean, never "deep", "aggressive" or "sweeping"). No location change, and no speed change from rest to "hard acceleration" inside one shot.
2. The camera-energy dial (D7) and the pace dial (D6): a shot's action must fit its seconds (a locked pass-by is about 1s; a detail 1.5–2s).
3. One time of day, one light direction and one grade across ALL shots (the D8 limit): the sky, the sun's height and the colour temperature must not change from shot to shot.
4. Every concept-conflict fix in the strategy is applied as it says.
5. The last shot shows the product clearly and fully lit, filling much of the frame: never a silhouette, never a lens flare across it.
6. The proposition is visible: the shots show what the proposition says.
7. Every MUST SHOW item is present${brief.mustShow ? ` (${brief.mustShow})` : ""}, delivered within the rails.
8. Nothing readable except our own brand badge on the product, no other logos, no real maker's design cues.
9. Every feature in the strategy has its own close-up whose action shows it working, placed where its callout can sit on a calm area of the frame.
10. The product's own badge is seen within the first 5 seconds and in the hero shot.
11. The look sheet's grade matches the D8 dial (at 0–1: muted, low saturation, never "vivid" or "pop"), and the music prompt's beats name shots that exist as written (its peak lands on a real shot).

For each failure: shot (1-based; 0 for the film as a whole), rule (the number above), problem (one sentence), fix (a concrete rewrite of that shot's field). An empty list when everything passes.

The number of shots is fixed: never ask to add, delete or split a shot — rewrite the failing shot, or swap its job with another. Where the strategy's own wording breaks a rail (e.g. a feature "shown as the bike accelerates"), the rail wins: fix the shot to the nearest realistic version that still shows the feature.

${strategyDirection(s)}

Director's treatment:
${JSON.stringify(treatment, null, 2)}`,
    {
      type: Type.OBJECT,
      properties: {
        failures: {
          type: Type.ARRAY,
          items: { type: Type.OBJECT, properties: { shot: { type: Type.INTEGER }, rule: STRING, problem: STRING, fix: STRING }, required: ["shot", "rule", "problem", "fix"] },
        },
      },
      required: ["failures"],
    },
  );
  return (raw.failures ?? []).map((f) => `${f.shot ? `Shot ${f.shot}` : "Film"} (rule ${f.rule}): ${f.problem} Fix: ${f.fix}`);
}
