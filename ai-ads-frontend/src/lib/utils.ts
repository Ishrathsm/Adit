import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// clsx joins conditional classes; twMerge resolves Tailwind conflicts so a later class wins
// (e.g. a component's default `text-lg` overridden by a caller's `text-9xl`) — the standard
// shadcn `cn`, which components copied from shadcn rely on.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Thumbnail source for a finished video: every stitched ad fades in from black, so the frame a
// muted <video preload="metadata"> shows by default was black and the card looked empty. A media
// fragment makes the browser show a frame from just after the fade instead.
export function videoThumbSrc(url: string, seconds = 1.5): string {
  return url.includes("#") ? url : `${url}#t=${seconds}`;
}

// Small WebP preview the backend saves next to each generated poster or video in storage
// (<name>.thumb.webp, see ai-ads-backend/src/lib/storage.ts). Null for anything else, e.g. brand
// logos or sample files. Files from before thumbs existed may have none, so show it through
// MediaThumb, which falls back to the full file.
export function thumbSrc(url: string): string | null {
  const m = url.match(/^(.*\/storage\/v1\/object\/public\/generated-media\/.+)\.(png|mp4)(\?[^#]*)?(#.*)?$/);
  return m ? `${m[1]}.thumb.webp${m[3] ?? ""}` : null;
}
