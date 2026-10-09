"use client";

import { useState, type CSSProperties, type SyntheticEvent } from "react";
import { thumbSrc, videoThumbSrc } from "@/lib/utils";

// A card-sized picture of a stored poster or video: the small WebP preview when there is one,
// otherwise the full file (a muted video frame for videos). Opening the item still shows the full
// file — this only keeps grids from downloading every full-size original.
export function MediaThumb({
  src,
  type = "image",
  alt,
  className,
  style,
  onLoad,
}: {
  src: string;
  type?: "image" | "video";
  alt: string;
  className?: string;
  style?: CSSProperties;
  onLoad?: (e: SyntheticEvent<HTMLImageElement>) => void;
}) {
  const thumb = thumbSrc(src);
  // Remembers which src failed, so a new src gets a fresh try at its thumb.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (thumb && failedSrc !== src) {
    // eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated thumbnail
    return <img src={thumb} alt={alt} className={className} style={style} loading="lazy" onLoad={onLoad} onError={() => setFailedSrc(src)} />;
  }
  if (type === "video") {
    return <video src={videoThumbSrc(src)} className={className} style={style} muted playsInline preload="metadata" />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated image
  return <img src={src} alt={alt} className={className} style={style} loading="lazy" onLoad={onLoad} />;
}
