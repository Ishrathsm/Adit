import type { AccountRow, Plan } from "./accounts";

// Feature switches for access control. Code asks "does this user have feature X?", never "is this
// user Pro?": a plan is only a preset of defaults, and an admin can override any single feature
// for any user — so tiers can be added or repriced later without code changes.
export const FEATURES = {
  poster: { label: "Posters", description: "Create poster ads" },
  video_quick: { label: "Quick video", description: "Single-shot videos (4–8s)" },
  video_ad: { label: "Full video ads", description: "Multi-shot storyboard ads" },
  long_ads: { label: "30-second ads", description: "The 30s ad length" },
  voiceover: { label: "Voiceover", description: "Narration over video ads" },
  reference_assets: { label: "Reference assets", description: "Upload product / person / location photos" },
  character_sheet: { label: "Character sheet", description: "Generated, approvable cast for video ads" },
} as const;

export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

const ALL_ON = Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])) as Record<FeatureKey, boolean>;

// Plan presets. Tiers and pricing aren't decided yet, so every plan currently includes everything
// (nobody loses access); per-user overrides are the real control until then.
export const PLAN_DEFAULTS: Record<Plan, Record<FeatureKey, boolean>> = {
  free: { ...ALL_ON },
  pro: { ...ALL_ON },
};

// A user with no account row yet (mid-onboarding) gets the free defaults.
export function effectiveFeatures(account: Pick<AccountRow, "plan" | "feature_overrides"> | null): Record<FeatureKey, boolean> {
  const defaults = PLAN_DEFAULTS[account?.plan ?? "free"];
  const overrides = account?.feature_overrides ?? {};
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, typeof overrides[key] === "boolean" ? overrides[key] : defaults[key]]),
  ) as Record<FeatureKey, boolean>;
}
