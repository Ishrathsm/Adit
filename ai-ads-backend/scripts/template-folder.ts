// Shared by import-templates.ts and resync-templates.ts: reading and validating one ad-templates/
// folder, and resolving its aspect ratio. Kept in one place so the two scripts can't drift apart
// on what counts as a valid template folder or how its ratio is determined.
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { isAspectRatio, nearestAspectRatio, type AspectRatio } from "../src/lib/aspect-ratio";
import { AD_LENGTHS, LOOKS, SHOT_SECONDS, TONES } from "../src/lib/creative-brief";
import { ffmpeg } from "../src/lib/ffmpeg-bin";
import { uploadThumb, uploadVideo, videoThumb } from "../src/lib/storage";
import type { TemplateType, VideoRecipe } from "../src/lib/templates";

export const IMAGE_FILES = ["template.png", "template.jpg", "template.jpeg", "template.webp"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Video templates: the sample film, shown in the preview (keep it small: 720p, ~5 MB).
export const VIDEO_FILE = "preview.mp4";
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

export interface TemplateMeta {
  name: string;
  description?: string;
  type?: TemplateType;
  // Escape hatch for a template whose intended ratio isn't what its current thumbnail pixels say
  // (rare). Normally omitted — the ratio comes from the image itself, not a hand-set default.
  aspectRatio?: AspectRatio;
  // Video templates only: the recipe minus what the importer makes (hoverUrl), plus the moments
  // of the sample used for the card still (posterAt) and the hover loop (hoverAt), in seconds.
  recipe?: Omit<VideoRecipe, "hoverUrl">;
  posterAt?: number;
  hoverAt?: number;
}

export interface CheckedFolder {
  meta: TemplateMeta;
  prompt: string;
  // The template image (posters) or the sample film (videos).
  image: string;
}

export function checkTemplateFolder(root: string, folder: string): CheckedFolder | string {
  const dir = join(root, folder);
  if (!existsSync(join(dir, "prompt.txt"))) return "needs prompt.txt";
  if (!existsSync(join(dir, "meta.json"))) return "needs meta.json";
  let meta: TemplateMeta;
  try {
    meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
  } catch {
    return "meta.json is not valid JSON";
  }
  if (!meta.name?.trim()) return 'meta.json needs a "name"';
  if (meta.type && meta.type !== "poster" && meta.type !== "video") return 'meta.json "type" must be "poster" or "video"';
  if (meta.aspectRatio !== undefined && !isAspectRatio(meta.aspectRatio)) return 'meta.json "aspectRatio" must be one of 1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9, 21:9';
  const prompt = readFileSync(join(dir, "prompt.txt"), "utf8").trim();
  if (prompt.length < 400) return "prompt.txt is too short to be a template (write the full design direction)";

  if (meta.type === "video") {
    const video = join(dir, VIDEO_FILE);
    if (!existsSync(video)) return `needs ${VIDEO_FILE}`;
    if (statSync(video).size > MAX_VIDEO_BYTES) return `${VIDEO_FILE} is over 15 MB`;
    if (meta.aspectRatio !== "16:9" && meta.aspectRatio !== "9:16") return 'video templates need "aspectRatio": "16:9" or "9:16"';
    const recipeError = checkRecipe(meta.recipe);
    if (recipeError) return `meta.json "recipe": ${recipeError}`;
    return { meta, prompt, image: video };
  }

  const image = IMAGE_FILES.map((f) => join(dir, f)).find(existsSync);
  if (!image) return `needs one of ${IMAGE_FILES.join(", ")}`;
  if (statSync(image).size > MAX_IMAGE_BYTES) return "template image is over 8 MB";
  if (!/\[[^\]]+\]/.test(prompt)) return "prompt.txt has no [Placeholders] — hard-coded copy can't be remixed";
  return { meta, prompt, image };
}

// The template's own ratio: an explicit meta.json override if given, otherwise derived from the
// image's actual pixel dimensions — never a single default applied to every template.
export async function resolveAspectRatio(meta: TemplateMeta, imagePath: string): Promise<AspectRatio> {
  if (meta.aspectRatio) return meta.aspectRatio;
  const { width, height } = await sharp(imagePath).metadata();
  if (!width || !height) throw new Error(`could not read image dimensions for ${imagePath}`);
  return nearestAspectRatio(width, height);
}

function checkRecipe(recipe: TemplateMeta["recipe"]): string | null {
  if (!recipe) return "missing";
  if (!TONES.includes(recipe.tone)) return `tone must be one of ${TONES.join(", ")}`;
  if (!LOOKS.includes(recipe.look)) return `look must be one of ${LOOKS.join(", ")}`;
  if (!Array.isArray(recipe.plans) || !recipe.plans.length) return "plans must list at least one length";
  for (const plan of recipe.plans) {
    if (!AD_LENGTHS.includes(plan.length)) return `plan length must be one of ${AD_LENGTHS.join(", ")}`;
    if (!SHOT_SECONDS.includes(plan.shotSeconds)) return `shotSeconds must be one of ${SHOT_SECONDS.join(", ")}`;
    if (!Number.isInteger(plan.shotCount) || plan.shotCount < 2 || plan.shotCount * plan.shotSeconds > 32) return "each plan needs 2+ shots and at most 32s of footage";
  }
  if (typeof recipe.voiceover !== "boolean") return "voiceover must be true or false";
  if (!Array.isArray(recipe.provide)) return "provide must be a list of strings";
  return null;
}

// Uploads a video template's sample film (card still at posterAt) and a small silent hover loop
// cut from it, and returns the thumbnail URL and the full recipe.
export async function uploadVideoTemplate(folder: string, meta: TemplateMeta, videoPath: string): Promise<{ thumbnailUrl: string; recipe: VideoRecipe }> {
  const video = readFileSync(videoPath);
  const path = `templates/${folder}`;
  const thumbnailUrl = await uploadVideo(path, video, "video/mp4");
  if (meta.posterAt !== undefined) await uploadThumb(`${path}.mp4`, () => videoThumb(video, meta.posterAt));

  const dir = await mkdtemp(join(tmpdir(), "hover-"));
  try {
    const hover = join(dir, "hover.mp4");
    await ffmpeg(["-y", "-ss", String(meta.hoverAt ?? 2), "-i", videoPath, "-t", "5", "-an", "-vf", "scale=-2:360", "-c:v", "libx264", "-crf", "30", "-preset", "slow", "-movflags", "+faststart", hover]);
    const hoverUrl = await uploadVideo(`${path}-hover`, await readFile(hover), "video/mp4");
    return { thumbnailUrl, recipe: { ...meta.recipe!, hoverUrl } };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
