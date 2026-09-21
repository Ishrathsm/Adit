"use client";

import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { fadeUpTransition, fadeUpVariants, fadeUpViewport } from "@/lib/motion-variants";

// The same two real, already-generated assets reused as previews elsewhere in the app
// (project detail page, storyboard page) — genuine Adit output, not stock or mockups.
// Deliberately no fixed aspect-ratio class on the media itself: each card is a fixed
// height with the media's own intrinsic aspect ratio driving its width (h-full +
// w-auto), so a landscape 16:9 video and a portrait 9:16 one both render correctly
// side by side without stretching or letterboxing.
const SAMPLES = [
  {
    label: "Poster",
    type: "image" as const,
    src: "https://cbjnnyfevxwktfmxdtqi.supabase.co/storage/v1/object/public/generated-media/9863e624-107d-4d32-80a7-4d748e7bed47.png",
  },
  {
    label: "Video",
    type: "video" as const,
    src: "https://cbjnnyfevxwktfmxdtqi.supabase.co/storage/v1/object/public/generated-media/8aa5874d-e00c-4336-8050-b1189f79522e.mp4",
  },
];

function AutoplayVideo({ src, className }: { src: string; className: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduceMotion) return;
    // React doesn't reliably set the `muted` IDL property from JSX (only the
    // attribute in some paths), and browsers require the real property to be
    // true before allowing autoplay — set it imperatively before calling play().
    el.muted = true;
    el.play().catch(() => {
      /* autoplay blocked by the browser — video just stays paused on frame 1 */
    });
  }, [reduceMotion]);

  return <video ref={videoRef} src={src} muted loop playsInline className={className} />;
}

export function OutputSamples() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={fadeUpViewport}
      variants={fadeUpVariants}
      transition={fadeUpTransition}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2 text-center">
        <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">Real output</p>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Made with Adit, not mockups.</h2>
      </div>
      <div className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 sm:justify-center">
        {SAMPLES.map((sample) => (
          <div
            key={sample.label}
            className={clsx(
              "rgb-border shrink-0 snap-center overflow-hidden p-2 shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-transform duration-200 hover:-translate-y-1",
              // On mobile the video card fills the full carousel width (one full-bleed
              // swipe at a time) instead of the fixed-height/auto-width sizing used on
              // larger screens where there's room to show a peek of the next card.
              sample.type === "video" && "w-full sm:w-auto",
            )}
          >
            {sample.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote, real generated sample
              <img
                src={sample.src}
                alt="Sample poster ad generated with Adit"
                className="h-72 w-auto rounded-2xl sm:h-80"
              />
            ) : (
              <AutoplayVideo src={sample.src} className="h-auto w-full rounded-2xl sm:h-80 sm:w-auto" />
            )}
            <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted">{sample.label}</p>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
