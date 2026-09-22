"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { fadeUpTransition, fadeUpVariants, fadeUpViewport } from "@/lib/motion-variants";

// Genuine Adit output, not stock or mockups. The newer pair (generated 2026-09-22) is
// hosted as static files under public/samples rather than linked to the generation bucket
// — the marketing site shouldn't depend on test-data storage that could get cleaned up
// independently of the site itself. The original pair stays linked to the bucket as-is.
// Deliberately no fixed aspect-ratio class on the media itself: each card has a fixed
// height with the media's own intrinsic aspect ratio driving its width, so landscape and
// portrait media both render correctly in the same row without stretching or letterboxing.
const SAMPLES = [
  {
    id: "poster-1",
    label: "Poster",
    type: "image" as const,
    src: "https://cbjnnyfevxwktfmxdtqi.supabase.co/storage/v1/object/public/generated-media/9863e624-107d-4d32-80a7-4d748e7bed47.png",
  },
  {
    id: "video-1",
    label: "Video",
    type: "video" as const,
    src: "https://cbjnnyfevxwktfmxdtqi.supabase.co/storage/v1/object/public/generated-media/8aa5874d-e00c-4336-8050-b1189f79522e.mp4",
  },
  {
    id: "poster-2",
    label: "Poster",
    type: "image" as const,
    src: "/samples/poster.png",
  },
  {
    id: "video-2",
    label: "Video",
    type: "video" as const,
    src: "/samples/video.mp4",
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

function SampleCard({ sample }: { sample: (typeof SAMPLES)[number] }) {
  return (
    <div className="rgb-border relative shrink-0 overflow-hidden p-2 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      {sample.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote, real generated sample
        <img
          src={sample.src}
          alt="Sample poster ad generated with Adit"
          className="h-72 w-auto rounded-2xl sm:h-80"
        />
      ) : (
        <AutoplayVideo src={sample.src} className="h-72 w-auto rounded-2xl sm:h-80" />
      )}
      {/* Label overlaid on the media itself (not a separate row below) so both
          card types are purely media and line up cleanly regardless of aspect ratio. */}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-end rounded-b-2xl bg-gradient-to-t from-black/70 to-transparent px-2 pt-8 pb-2">
        <p className="text-xs font-medium text-white">{sample.label}</p>
      </div>
    </div>
  );
}

export function OutputSamples() {
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);

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
      {/* True marquee: the track renders SAMPLES twice back to back and animates exactly
          -50%, so the seam between the two copies is invisible and it loops forever. The
          outer wrapper's mask-image fades the left/right edges to transparent instead of
          hard-clipping a card mid-frame. items-center so a landscape video card hugs its
          own height and sits vertically centered against the taller portrait poster card
          beside it, instead of being stretched to match it. */}
      <div className="marquee-fade overflow-hidden">
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
          className={clsx("marquee-track flex w-max items-center gap-4 py-2", paused && "marquee-paused")}
        >
          {[...SAMPLES, ...SAMPLES].map((sample, i) => (
            <SampleCard key={`${sample.id}-${i}`} sample={sample} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
