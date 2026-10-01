// Shared by import-templates.ts and resync-templates.ts: reading and validating one ad-templates/
// folder, and resolving its aspect ratio. Kept in one place so the two scripts can't drift apart
// on what counts as a valid template folder or how its ratio is determined.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { isAspectRatio, nearestAspectRatio, type AspectRatio } from "../src/lib/aspect-ratio";
import type { TemplateType } from "../src/lib/templates";

export const IMAGE_FILES = ["template.png", "template.jpg", "template.jpeg", "template.webp"];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface TemplateMeta {
  name: string;
  description?: string;
  type?: TemplateType;
  // Escape hatch for a template whose intended ratio isn't what its current thumbnail pixels say
  // (rare). Normally omitted — the ratio comes from the image itself, not a hand-set default.
  aspectRatio?: AspectRatio;
}

export interface CheckedFolder {
  meta: TemplateMeta;
  prompt: string;
  image: string;
}

export function checkTemplateFolder(root: string, folder: string): CheckedFolder | string {
  const dir = join(root, folder);
  const image = IMAGE_FILES.map((f) => join(dir, f)).find(existsSync);
  if (!image) return `needs one of ${IMAGE_FILES.join(", ")}`;
  if (statSync(image).size > MAX_IMAGE_BYTES) return "template image is over 8 MB";
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
  if (meta.aspectRatio !== undefined && !isAspectRatio(meta.aspectRatio)) return 'meta.json "aspectRatio" must be one of 1:1, 3:4, 4:3, 9:16, 16:9';
  const prompt = readFileSync(join(dir, "prompt.txt"), "utf8").trim();
  if (prompt.length < 400) return "prompt.txt is too short to be a template (write the full design direction)";
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
