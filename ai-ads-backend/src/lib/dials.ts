// The creative dials (knowledge/dials.md) in code: each ad's context sets a 0–4 value per dial
// from its genre default and the goal, tier, position and audience modifiers, so the strategist
// and creative director start from the evidence rather than re-deriving it, and the hard limits
// (humour only when asked, camera never past 3, never a named rival) can't be argued away.

export const CATEGORIES = ["automotive", "food-beverage", "tech-electronics", "beauty", "apps-services-education"] as const;
export const BEAUTY_SUBS = ["grooming", "sportswear", "self-esteem", "luxury"] as const;
export const POSITIONS = ["famous", "challenger", "new"] as const;
export const TIERS = ["value", "mid", "premium", "luxury"] as const;
export const AUDIENCES = ["youth", "young-adults", "family", "professionals", "mature"] as const;
export const GOALS = ["launch", "feature", "brand", "offer"] as const;

export type Category = (typeof CATEGORIES)[number];
export type BeautySub = (typeof BEAUTY_SUBS)[number];
export type Position = (typeof POSITIONS)[number];
export type Tier = (typeof TIERS)[number];
export type Audience = (typeof AUDIENCES)[number];
export type Goal = (typeof GOALS)[number];

export interface AdContext {
  category: Category;
  beautySub: BeautySub | null;
  position: Position;
  tier: Tier;
  audience: Audience;
  goal: Goal;
}

export interface DialFlags {
  // Only when the user explicitly asked for humour (user rule: it's make-or-break).
  humourRequested: boolean;
  voiceover: boolean;
  endCardVoice: boolean;
  veoAudio: boolean;
  // A real offer (price, sale, deadline) named in the brief — the only licence for "limited".
  realOffer: boolean;
}

export const DIAL_IDS = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"] as const;
export type DialId = (typeof DIAL_IDS)[number];

interface DialDef {
  name: string;
  scale: string[];
  limit: string;
  // The most the creative director may set it to (the hard limit), given the context.
  max: (ctx: AdContext, flags: DialFlags) => number;
}

export const DIAL_DEFS: Record<DialId, DialDef> = {
  D1: {
    name: "Humour",
    scale: ["none", "a light smile, wit in a line", "a warm comic situation", "a committed joke that carries the ad", "surreal or absurd"],
    limit: "Off unless the user asked for it. When on, the joke must deliver the proposition; never a hesitant half-joke.",
    max: (ctx, f) => (f.humourRequested ? humourCeiling(ctx) : 0),
  },
  D2: {
    name: "Emotion vs reason",
    scale: ["pure function: specs, demonstration", "mostly function, with a human benefit", "a functional message inside an appealing story", "mostly feeling, one tangible reason underneath", "pure feeling: identity, memory, transformation"],
    limit: "At 4 the film still attaches one feeling the viewer can name; at 0 a human benefit is still stated.",
    max: () => 4,
  },
  D3: {
    name: "Brand reveal",
    scale: ["brand from the first second and throughout (badge in shots, watermark)", "brand or product within the first 5s and at the end", "brand within 5s, product throughout", "brand mostly held for the end, product visible early", "held to the end as a reveal"],
    limit: "A new brand never holds its name back; a reveal (3–4) needs a famous brand building feeling.",
    max: (ctx) => (ctx.position === "new" ? 1 : ctx.position === "famous" && ctx.goal === "brand" ? 4 : 3),
  },
  D4: {
    name: "Voice-over density",
    scale: ["no voice", "end-card line only (brand + tagline)", "sparse, about 1 word/s", "conversational, about 2.3 words/s", "brisk, 3+ words/s"],
    limit: "Only what the user opted in to. Supers match the VO word for word. Never time-stretch a read.",
    max: (ctx, f) => (!f.voiceover ? (f.endCardVoice ? 1 : 0) : ctx.tier === "luxury" ? 1 : 4),
  },
  D5: {
    name: "On-screen copy",
    scale: ["none until the end card", "one super for the key claim", "a line every other shot", "copy on most shots (offer, features)", "—"],
    limit: "At most 4 lines, typeset in the edit, never generated.",
    max: (ctx) => (ctx.tier === "luxury" ? 0 : 3),
  },
  D6: {
    name: "Cut pace",
    scale: ["contemplative, shots 3s+", "calm, about 2.5s median", "balanced, about 1.5–2s median", "quick, about 1–1.5s median", "rapid, under 1s"],
    limit: "One unfolding scene, never a montage; setups under about 3s except the hero; vary the cut lengths.",
    max: () => 3,
  },
  D7: {
    name: "Camera energy",
    scale: ["locked off, motion in the light only", "a slow push or slide that stops", "coupled tracking at the subject's exact speed", "vehicle-mounted coupling, fast background", "handheld, drone, free orbit"],
    limit: "Never past 3 (level-4 moves fail on Veo). Static and detail shots are the backbone.",
    max: () => 3,
  },
  D8: {
    name: "Grade",
    scale: ["muted and filmic (brightness ~79/255, saturation ~6)", "restrained, controlled contrast", "natural", "saturated but true", "bright, high-key, saturated"],
    limit: "One grade, time of day and light direction for the whole film; neutral colour, no orange-teal push.",
    max: () => 4,
  },
  D9: {
    name: "Music energy (open → peak)",
    scale: ["none or an ambient bed", "calm and warm", "a steady pulse", "driving", "peak, anthemic"],
    limit: "Built in the edit from separate pieces; ends uplifting; never draws attention to itself; ducks under the voice but stays audible.",
    max: () => 4,
  },
  D10: {
    name: "Sound design",
    scale: ["music only", "a few cues (a click, a pour)", "a layered scene sound throughout", "sound leads, music is a bed", "—"],
    limit: "At most about two whooshes per 30s. Engines only from Veo's own audio.",
    max: (_ctx, f) => (f.veoAudio ? 3 : 1),
  },
  D11: {
    name: "Specificity of claim",
    scale: ["attitude or identity only", "a benefit felt, not stated", "one benefit in human terms", "a concrete benefit viewers can repeat", "a hard fact, number or spec"],
    limit: "Never a claim or number the brief doesn't support.",
    max: () => 4,
  },
  D12: {
    name: "Combativeness",
    scale: ["no rival in view", "an old way or a problem as the enemy", "an implied rival", "a named comparison", "—"],
    limit: "Never a named or depicted real competitor.",
    max: (ctx) => (ctx.position === "new" || ctx.tier === "premium" || ctx.tier === "luxury" ? 1 : 2),
  },
  D13: {
    name: "Urgency",
    scale: ["none, the name is the CTA", "a specific invitation (\"Book a test ride\")", "an offer with a deadline (\"limited\")", "hard sell", "—"],
    limit: "One specific CTA, heard and seen; never \"limited\" or a price the brief doesn't contain.",
    max: (_ctx, f) => (f.realOffer ? 2 : 1),
  },
};

export interface DialSetting {
  value: number;
  // D9 only: where the music opens (value is the peak).
  open?: number;
  reasons: string[];
}

export type Dials = Record<DialId, DialSetting>;

function humourCeiling(ctx: AdContext): number {
  if (ctx.category === "beauty") return ctx.beautySub === "grooming" ? 4 : 0;
  return { automotive: 1, "food-beverage": 3, "tech-electronics": 1, "apps-services-education": 2 }[ctx.category];
}

const clamp = (v: number, lo = 0, hi = 4) => Math.max(lo, Math.min(hi, v));

// Genre default, then goal → tier → position → audience, then the hard limit.
export function computeDials(ctx: AdContext, flags: DialFlags): Dials {
  const { category: cat, beautySub: sub, tier, position: pos, audience: aud, goal } = ctx;
  const luxuryLike = tier === "luxury" || (cat === "beauty" && sub === "luxury");
  const premiumUp = tier === "premium" || tier === "luxury";
  const dials = {} as Dials;
  const start = (id: DialId, value: number, why: string, open?: number) => (dials[id] = { value, open, reasons: [`genre default ${open !== undefined ? `${open} → ${value}` : value}: ${why}`] });
  const move = (id: DialId, by: number, why: string) => {
    dials[id].value = clamp(dials[id].value + by);
    dials[id].reasons.push(`${by > 0 ? "+" : ""}${by} ${why}`);
  };
  const set = (id: DialId, to: number, why: string) => {
    dials[id].value = to;
    dials[id].reasons.push(`→ ${to} ${why}`);
  };

  // D1 Humour
  if (!flags.humourRequested) start("D1", 0, "humour is off unless the user asks for it");
  else {
    start("D1", humourCeiling(ctx), "the user asked for humour; the genre ceiling");
    if (tier === "luxury") set("D1", 0, "luxury");
    else if (tier === "premium") move("D1", -1, "premium");
    if (aud === "mature") move("D1", -1, "mature audience");
    if (dials.D1.value === 1) set("D1", 2, "commit or don't: a hesitant half-joke is worse than none");
  }

  // D2 Emotion vs reason
  const d2 = cat === "beauty" ? { grooming: 2, sportswear: 3, "self-esteem": 4, luxury: 4 }[sub ?? "luxury"] : { automotive: 2, "food-beverage": 3, "tech-electronics": 1, "apps-services-education": 2 }[cat];
  start("D2", d2, cat);
  if (goal === "brand") move("D2", 1, "goal brand (emotion wins long-term for known brands)");
  if (goal === "feature" || goal === "offer") move("D2", -1, `goal ${goal} (a tangible functional message)`);
  if (tier === "luxury") move("D2", 1, "luxury sells feeling");
  if (pos === "new") move("D2", -1, "a new brand must first say what it is");
  if (pos === "famous") move("D2", 1, "a famous brand can sell identity");

  // D3 Brand reveal
  start("D3", 1, "brand in the first 5s (ABCD), watermark in the reference ads");
  if (goal === "offer") set("D3", 0, "goal offer");
  if (luxuryLike) move("D3", 1, "luxury holds the name back, product on screen");
  if (pos === "famous" && goal === "brand") dials.D3.reasons.push("a reveal up to 4 is allowed (famous brand, brand goal)");

  // D4 Voice-over density
  start("D4", cat === "apps-services-education" ? 3 : cat === "food-beverage" ? 2 : 1, cat);
  if (goal === "offer") move("D4", 1, "goal offer: the CTA heard and seen");
  if (goal === "brand") move("D4", -1, "goal brand");

  // D5 On-screen copy
  start("D5", cat === "apps-services-education" ? 2 : 1, cat);
  if (goal === "offer") move("D5", 1, "goal offer: price, CTA");
  if (goal === "feature" && cat === "tech-electronics") move("D5", 1, "the one spec viewers should repeat");

  // D6 Cut pace
  const d6 = cat === "beauty" ? { grooming: 2, sportswear: 3, "self-esteem": 2, luxury: 0 }[sub ?? "luxury"] : { automotive: 3, "food-beverage": 2, "tech-electronics": 2, "apps-services-education": 1 }[cat];
  start("D6", d6, cat);
  if (cat === "automotive" && premiumUp) move("D6", -1, "premium automotive cuts slower (Triumph vs Pulsar)");
  if (cat === "automotive" && tier === "value") set("D6", 1, "commuter-value reference (Freedom 125) at about 2.5s");
  if (aud === "youth") move("D6", 1, "youth audience");
  if (aud === "mature") move("D6", -1, "mature audience");

  // D7 Camera energy
  const d7 = cat === "beauty" ? { grooming: 1, sportswear: 2, "self-esteem": 1, luxury: 0 }[sub ?? "luxury"] : { automotive: 2, "food-beverage": 1, "tech-electronics": 1, "apps-services-education": 1 }[cat];
  start("D7", d7, cat);
  if (tier === "luxury") move("D7", -1, "luxury grammar: slow, deliberate");
  if (aud === "youth" && (cat === "automotive" || sub === "sportswear")) move("D7", 1, "youth audience");

  // D8 Grade
  const d8 = cat === "beauty" ? (sub === "luxury" ? 0 : 2) : { automotive: 0, "food-beverage": 3, "tech-electronics": 1, "apps-services-education": 2 }[cat];
  start("D8", d8, cat);
  if (premiumUp) move("D8", -1, tier);
  if ((aud === "youth" || aud === "family") && (cat === "food-beverage" || cat === "apps-services-education")) move("D8", 1, `${aud} audience`);

  // D9 Music (value = peak)
  const [o, p] = cat === "beauty" ? { grooming: [2, 3], sportswear: [3, 4], "self-esteem": [1, 3], luxury: [1, 2] }[sub ?? "luxury"] : { automotive: [2, 4], "food-beverage": [2, 3], "tech-electronics": [1, 3], "apps-services-education": [1, 2] }[cat];
  start("D9", p, cat, o);
  if (goal === "brand") move("D9", 1, "a magic moment at the logo");
  if (premiumUp) {
    dials.D9.open = clamp(o - 1);
    dials.D9.reasons.push(`open −1 ${tier}: would the brand, as a person, be that exuberant?`);
  }

  // D10 Sound design
  start("D10", cat === "automotive" ? 3 : cat === "food-beverage" ? 2 : 1, cat);

  // D11 Specificity of claim
  const d11 = cat === "beauty" ? (sub === "luxury" ? 0 : 2) : { automotive: 2, "food-beverage": 2, "tech-electronics": 3, "apps-services-education": 3 }[cat];
  start("D11", d11, cat);
  if (tier === "value" || goal === "offer") move("D11", 1, tier === "value" ? "value tier: features for the price" : "goal offer");
  if (tier === "luxury" || goal === "brand") move("D11", -1, tier === "luxury" ? "luxury" : "goal brand");
  if (pos === "challenger") move("D11", 1, "challenger: prove superiority");

  // D12 Combativeness
  start("D12", 0, "no rival by default");
  if (pos === "challenger") set("D12", 2, "challenger: an enemy or a truth");

  // D13 Urgency
  start("D13", 1, "a specific, single CTA");
  if (goal === "offer" && flags.realOffer) set("D13", 2, "a real offer in the brief");
  if (luxuryLike) set("D13", 0, "luxury: the name is the CTA");

  // Music ducks under a busy voice; then every dial to its hard limit.
  if (dials.D4.value >= 3) move("D9", -1, "busy VO: the peak drops under the voice");
  for (const id of DIAL_IDS) {
    const max = DIAL_DEFS[id].max(ctx, flags);
    if (dials[id].value > max) set(id, max, `limit: ${DIAL_DEFS[id].limit}`);
  }
  if (dials.D9.open !== undefined) dials.D9.open = Math.min(dials.D9.open, dials.D9.value);
  return dials;
}

// A creative director's change: one step from the computed value at most, never past the limit,
// and humour never switched on without the user asking.
export function adjustDial(dials: Dials, id: DialId, to: number, why: string, ctx: AdContext, flags: DialFlags): boolean {
  const d = dials[id];
  const max = DIAL_DEFS[id].max(ctx, flags);
  const target = clamp(Math.round(to), Math.max(0, d.value - 1), Math.min(max, d.value + 1));
  if (target === d.value) return false;
  d.value = target;
  d.reasons.push(`→ ${target} creative director: ${why}`);
  if (id === "D9" && d.open !== undefined) d.open = Math.min(d.open, target);
  return true;
}

export function dialLine(id: DialId, d: DialSetting): string {
  const def = DIAL_DEFS[id];
  const label = id === "D9" && d.open !== undefined ? `${d.open} → ${d.value} (${def.scale[d.open]} → ${def.scale[d.value]})` : `${d.value} (${def.scale[d.value]})`;
  return `${id} ${def.name}: ${label}. Limit: ${def.limit}`;
}

export function dialsText(dials: Dials): string {
  return DIAL_IDS.map((id) => `- ${dialLine(id, dials[id])}`).join("\n");
}

export const RAILS = `RAILS (never broken, whatever the dials say):
1. One proposition: a stranger can finish "I should buy X because…" after one viewing.
2. Show it, don't say it: a demonstration, metaphor, story, humour (only when asked) or honesty.
3. Tone serves the proposition: excitement or emotion that doesn't land a reason is weak.
4. One scene unfolds, not a montage: pace can be quick, but in one place and story.
5. The real product, pack and UI are composited, never AI-drawn; text and logos go in the edit.
6. Realistic motion: the camera is coupled to the subject or locked; straight paths or one gentle arc; no location change inside a shot.
7. Brand-safe: no real maker's design cues, no imitation of a real brand's assets, no real competitor shown or named.`;

export const DEVICES = `DEVICE (pick ONE to show the proposition), by genre — first choice / also strong / rarely right:
- automotive: demonstration (Volvo "Epic Split") / metaphor (BMW "Bullet"), character (Kia hamsters) / a celebrity without meaning
- food-beverage: a tiny story ("Mikey likes it") or humour if asked / demonstration in motion (Knorr), mascot / abstract mood
- tech-electronics: demonstration (GoPro, Samsung) / metaphor (Sony "Balls") / a joke that doesn't reveal the feature
- beauty: absurd humour (grooming, if asked) · performance (sportswear) · a researched truth (self-esteem) · sensory cinema (luxury) / — / the moving lookbook
- apps-services-education: dramatised benefit (Mastercard "Elephant") / the product is the story (Google "Parisian Love"), a real UI demo / stylish but vague (Squarespace)
A NEW brand prefers devices that explain the product (demonstration, real UI demo), because nobody knows it yet.
Propose one FLUENT DEVICE for the brand (a recurring character, sound, shot or line the next ad reuses).`;

// D6 as a median shot length (seconds) for the setups before the hero.
export const PACE_MEDIAN_SECONDS = [3.5, 2.5, 2.0, 1.4, 1.0] as const;
const HERO_SECONDS = 3.5;

// Shot count from the pace dial: the hero holds ~3.5s and the other setups share the rest at the
// dial's median. Real bike ads cut every ~1–2.5s, which 8 shots in 25s can't reach.
export function shotCountForPace(footageSeconds: number, pace: number): number {
  const median = PACE_MEDIAN_SECONDS[Math.max(0, Math.min(4, pace))];
  return Math.max(3, Math.min(12, 1 + Math.round((footageSeconds - HERO_SECONDS) / median)));
}

// Moves past each camera-energy level, as words a shot's movement field would use.
const CAMERA_WORDS: { level: number; words: RegExp }[] = [
  { level: 4, words: /\b(handheld|hand-held|drone|fpv|whip[- ]?pan|orbit(s|ing)?|crane|jib|360)\b/i },
  { level: 2, words: /\b(track(s|ing)?|follow(s|ing)?|chase|gimbal|vehicle[- ]mounted|camera car|pan(s|ning)? with)\b/i },
  { level: 1, words: /\b(push[- ]?in|pull[- ]?out|dolly|slider|slide|truck(s|ing)?|pedestal|arc(s|ing)?)\b/i },
];

// The checks code can make without judgement: the pace dial against the shot lengths, the camera
// cap against the moves. Returns the failures as instructions for the rewrite.
export function checkScriptAgainstDials(
  dials: Dials,
  shots: { seconds: number | null; movement: string }[],
): string[] {
  const failures: string[] = [];
  const pace = dials.D6.value;
  const target = PACE_MEDIAN_SECONDS[pace];
  const setups = shots.slice(0, -1).map((s) => s.seconds).filter((n): n is number => typeof n === "number");
  if (setups.length) {
    const sorted = [...setups].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median > target + 0.4) failures.push(`Pace (D6 ${pace}): the setups' median is ${median}s; it must be about ${target}s. Shorten the details and moves; only the last (hero) shot holds longer.`);
    const maxSetup = Math.max(3.2, target + 1);
    shots.slice(0, -1).forEach((s, i) => {
      if (typeof s.seconds === "number" && s.seconds > maxSetup) failures.push(`Shot ${i + 1} runs ${s.seconds}s; setups stay under ${maxSetup}s at this pace (split it or cut it shorter).`);
    });
  }
  const cap = dials.D7.value;
  shots.forEach((s, i) => {
    const over = CAMERA_WORDS.find((c) => c.level > cap && c.words.test(s.movement));
    if (over) failures.push(`Shot ${i + 1}'s movement ("${s.movement.slice(0, 80)}") goes past camera energy ${cap} (D7: ${DIAL_DEFS.D7.scale[cap]}). Use a move at level ${cap} or below.`);
  });
  return failures;
}
