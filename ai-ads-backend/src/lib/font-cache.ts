import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// The poster overlay can only use fonts it has a file for — the host only has a generic sans
// installed, so a brand font like "Montserrat" silently rendered as the fallback. Most brand
// fonts entered at onboarding are Google Fonts, so fetch the .ttf on first use and cache it.
const CACHE_DIR = join(tmpdir(), "adit-fonts");

// Resolved per family for the process lifetime, including misses (null) so a font that isn't on
// Google Fonts doesn't cost a network round-trip on every poster.
const resolved = new Map<string, Promise<string | null>>();

// Google's css2 endpoint answers a plain (non-browser) client with truetype URLs.
async function fetchTtfUrl(family: string, weight?: number): Promise<string | null> {
  const spec = weight ? `${family}:wght@${weight}` : family;
  const res = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec)}`);
  if (!res.ok) return null;
  const match = (await res.text()).match(/src:\s*url\(([^)]+\.ttf)\)/);
  return match ? match[1] : null;
}

async function download(family: string, weight: number): Promise<string | null> {
  const path = join(CACHE_DIR, `${family.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${weight}.ttf`);
  if (existsSync(path)) return path;

  // Families without the requested weight 400 on that request — step toward 700, then take
  // whatever the family's default is.
  const fallbacks = [weight, ...(weight > 700 ? [700] : []), undefined];
  let url: string | null = null;
  for (const w of fallbacks) {
    url = await fetchTtfUrl(family, w);
    if (url) break;
  }
  if (!url) return null;

  const res = await fetch(url);
  if (!res.ok) return null;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

export function resolveFontFile(family: string, weight = 700): Promise<string | null> {
  const key = `${family.trim()}:${weight}`;
  let entry = resolved.get(key);
  if (!entry) {
    entry = download(family.trim(), weight).catch((err) => {
      console.warn(`[font-cache] could not load "${key}":`, err instanceof Error ? err.message : err);
      return null;
    });
    resolved.set(key, entry);
  }
  return entry;
}
