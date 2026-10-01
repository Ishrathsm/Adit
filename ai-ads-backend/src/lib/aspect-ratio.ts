// The image model's full supported set for still images. Veo (video) only accepts the "9:16" /
// "16:9" subset of this list — see VIDEO_ASPECT_RATIOS in routes/jobs.ts.
export const VALID_ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;
export type AspectRatio = (typeof VALID_ASPECT_RATIOS)[number];

export function isAspectRatio(value: unknown): value is AspectRatio {
  return typeof value === "string" && (VALID_ASPECT_RATIOS as readonly string[]).includes(value);
}

const RATIO_VALUE: Record<AspectRatio, number> = {
  "1:1": 1,
  "3:4": 3 / 4,
  "4:3": 4 / 3,
  "9:16": 9 / 16,
  "16:9": 16 / 9,
};

// Maps a template image's real pixel dimensions onto the nearest ratio the image model actually
// supports — the model takes one of VALID_ASPECT_RATIOS, not an arbitrary width/height, so a
// template's "exact ratio" means the closest one of these, not its raw pixel ratio.
export function nearestAspectRatio(width: number, height: number): AspectRatio {
  const actual = width / height;
  let best: AspectRatio = "1:1";
  let bestDiff = Infinity;
  for (const ratio of VALID_ASPECT_RATIOS) {
    const diff = Math.abs(RATIO_VALUE[ratio] - actual);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ratio;
    }
  }
  return best;
}
