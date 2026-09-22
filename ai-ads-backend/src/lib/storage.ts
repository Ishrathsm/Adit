import { supabase } from "./supabase";

const MEDIA_BUCKET = "generated-media";
const BRAND_ASSETS_BUCKET = "brand-assets";

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
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadPoster(jobId: string, imageBuffer: Buffer): Promise<string> {
  const path = `${jobId}.png`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, imageBuffer, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
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
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
