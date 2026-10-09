import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { ffmpeg } from "./ffmpeg-bin";
import { supabase } from "./supabase";

export const MEDIA_BUCKET = "generated-media";
const BRAND_ASSETS_BUCKET = "brand-assets";

// Every upload lands at a URL that never changes content (a ?v= stamp or a timestamped path), so
// browsers and the storage CDN may keep it for a year. The default (1 hour) re-downloaded every
// poster and video on each visit, and that cached egress is what the free plan caps.
const CACHE_FOREVER = "31536000";

// Cards and the template gallery show a small WebP saved next to each poster or video
// (<name>.thumb.webp); the full file is only fetched when someone opens it. The frontend derives
// the thumb URL from the full one (thumbSrc in lib/utils.ts).
// Fits inside 960px so a wide billboard tile still looks sharp on a high-density screen.
const THUMB_MAX = 960;

export function thumbPathFor(path: string): string {
  return path.replace(/\.[^./]+$/, ".thumb.webp");
}

export function posterThumb(image: Buffer): Promise<Buffer> {
  return sharp(image).resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
}

// A frame from just after the opening fade (every stitched ad fades in from black); clips
// shorter than that fall back to their first frame.
export async function videoThumb(video: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "thumb-"));
  try {
    const input = join(dir, "in.mp4");
    const frame = join(dir, "frame.png");
    await writeFile(input, video);
    for (const at of ["1.5", "0"]) {
      await ffmpeg(["-y", "-ss", at, "-i", input, "-frames:v", "1", frame]).catch(() => undefined);
      const png = await readFile(frame).catch(() => null);
      if (png) return posterThumb(png);
    }
    throw new Error("no frame could be read from the video");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// A missing thumb only costs bandwidth (the frontend falls back to the full file), so a failure
// here never fails the upload itself.
export async function uploadThumb(path: string, make: () => Promise<Buffer>): Promise<void> {
  try {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(thumbPathFor(path), await make(), {
      contentType: "image/webp",
      cacheControl: CACHE_FOREVER,
      upsert: true,
    });
    if (error) throw error;
  } catch (err) {
    console.warn(`thumbnail for ${path} failed:`, err instanceof Error ? err.message : err);
  }
}

async function ensureBucket(name: string): Promise<void> {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  if (!buckets?.some((bucket) => bucket.name === name)) {
    const { error: createError } = await supabase.storage.createBucket(name, { public: true });
    if (createError) throw createError;
  }
}

export function ensureMediaBucket(): Promise<void> {
  return ensureBucket(MEDIA_BUCKET);
}

export function ensureBrandAssetsBucket(): Promise<void> {
  return ensureBucket(BRAND_ASSETS_BUCKET);
}

export async function uploadVideo(jobId: string, videoBuffer: Buffer, mimeType: string): Promise<string> {
  const path = `${jobId}.mp4`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, videoBuffer, {
    contentType: mimeType,
    cacheControl: CACHE_FOREVER,
    upsert: true,
  });
  if (error) throw error;
  await uploadThumb(path, () => videoThumb(videoBuffer));

  return versioned(supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl);
}

// Re-renders overwrite the same path (upsert), and the storage CDN kept serving the old file at the
// plain URL — a re-rendered shot went into the stitched film as its previous take. A version
// stamp makes every upload a new URL.
const versioned = (url: string) => `${url}?v=${Date.now()}`;

export async function uploadPoster(jobId: string, imageBuffer: Buffer): Promise<string> {
  const path = `${jobId}.png`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, imageBuffer, {
    contentType: "image/png",
    cacheControl: CACHE_FOREVER,
    upsert: true,
  });
  if (error) throw error;
  await uploadThumb(path, () => posterThumb(imageBuffer));

  return versioned(supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl);
}

export async function uploadLogo(
  productId: string,
  fileBuffer: Buffer,
  mimeType: string,
  extension: string,
): Promise<string> {
  const path = `${productId}/logo-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(BRAND_ASSETS_BUCKET).upload(path, fileBuffer, {
    contentType: mimeType,
    cacheControl: CACHE_FOREVER,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BRAND_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Uploaded before a storyboard exists (at creation time), so this is scoped by user id, not
// storyboard id.
export async function uploadReferenceImage(
  userId: string,
  fileBuffer: Buffer,
  mimeType: string,
  extension: string,
): Promise<string> {
  const path = `references/${userId}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, fileBuffer, {
    contentType: mimeType,
    cacheControl: CACHE_FOREVER,
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
