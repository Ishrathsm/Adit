import { LOOK_DIRECTION, LOOKS, type Look, TONE_DIRECTION, TONES, type Tone } from "./creative-brief";

// The user's brief for a poster: the copy is structured (each part gets its own place and style in
// the layout, instead of one tagline split heuristically), and tone/look/guidance steer the image
// the same way the video brief steers a film.

// "logo": the client's logo for this poster — placed on the finished image, never drawn by the model.
export type PosterAssetKind = "character" | "product" | "location" | "logo";

export interface PosterAsset {
  kind: PosterAssetKind;
  name: string;
  description: string | null;
  imageUrl: string;
}

export interface PosterBrief {
  headline: string | null;
  subline: string | null;
  // Short deal text shown as an accent badge, e.g. "30% OFF".
  offer: string | null;
  // Call to action shown as a pill button, e.g. "Enrol now".
  cta: string | null;
  contactLine: string | null;
  // Short feature bullets for a features poster, e.g. "Test Prep: SAT, ACT and AP". "Label: detail"
  // renders the label in bold.
  features: string[];
  tone: Tone;
  look: Look;
  audience: string | null;
  mustShow: string | null;
  avoid: string | null;
  assets: PosterAsset[];
}

const LIMITS = { headline: 60, subline: 120, offer: 24, cta: 28, contactLine: 120, feature: 70, guidance: 300 };
const MAX_FEATURES = 4; // more than ~4 bullets stops reading as a poster
const MAX_ASSETS = 3; // beyond ~3 subjects the image model starts blending them
const ASSET_KINDS: PosterAssetKind[] = ["character", "product", "location", "logo"];

function text(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`${field} must be at most ${max} characters`);
  return trimmed || null;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T, field: string): T {
  if (value === undefined || value === null || value === "") return fallback;
  if (!allowed.includes(value as T)) throw new Error(`${field} must be one of ${allowed.join(", ")}`);
  return value as T;
}

// Validates a request body's poster brief; throws with a user-facing message.
export function parsePosterBrief(raw: unknown): PosterBrief {
  const b = (raw ?? {}) as Record<string, unknown>;
  const rawAssets = b.assets ?? [];
  if (!Array.isArray(rawAssets)) throw new Error("assets must be a list");
  if (rawAssets.length > MAX_ASSETS) throw new Error(`at most ${MAX_ASSETS} reference assets per poster`);
  const assets = rawAssets.map((a, i) => {
    const asset = (a ?? {}) as Record<string, unknown>;
    const name = text(asset.name, `assets[${i}].name`, 60);
    if (!name) throw new Error(`assets[${i}].name is required`);
    if (typeof asset.imageUrl !== "string" || !asset.imageUrl.startsWith("http")) throw new Error(`assets[${i}].imageUrl must be an uploaded image URL`);
    return {
      kind: pick(asset.kind, ASSET_KINDS, "product", `assets[${i}].kind`),
      name,
      description: text(asset.description, `assets[${i}].description`, LIMITS.guidance),
      imageUrl: asset.imageUrl,
    };
  });

  const rawFeatures = b.features ?? [];
  if (!Array.isArray(rawFeatures)) throw new Error("features must be a list");
  const features = rawFeatures
    .map((f, i) => text(f, `features[${i}]`, LIMITS.feature))
    .filter((f): f is string => Boolean(f));
  if (features.length > MAX_FEATURES) throw new Error(`at most ${MAX_FEATURES} features per poster`);

  return {
    headline: text(b.headline, "headline", LIMITS.headline),
    subline: text(b.subline, "subline", LIMITS.subline),
    offer: text(b.offer, "offer", LIMITS.offer),
    cta: text(b.cta, "cta", LIMITS.cta),
    contactLine: text(b.contactLine, "contactLine", LIMITS.contactLine),
    features,
    tone: pick(b.tone, TONES, "premium", "tone"),
    look: pick(b.look, LOOKS, "photoreal", "look"),
    audience: text(b.audience, "audience", LIMITS.guidance),
    mustShow: text(b.mustShow, "mustShow", LIMITS.guidance),
    avoid: text(b.avoid, "avoid", LIMITS.guidance),
    assets,
  };
}

// Direction block for the poster image prompt — tone, look, and the user's guidance.
export function posterDirection(brief: PosterBrief): string {
  return [
    TONE_DIRECTION[brief.tone],
    LOOK_DIRECTION[brief.look],
    brief.audience && `Audience: ${brief.audience} — the people, setting, and mood should feel true to them.`,
    brief.mustShow && `MUST SHOW in the image: ${brief.mustShow}`,
    brief.avoid && `MUST AVOID anywhere in the frame: ${brief.avoid}`,
  ]
    .filter(Boolean)
    .join("\n");
}
