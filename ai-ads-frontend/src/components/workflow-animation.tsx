"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Sparkles, Wand2, MousePointerClick, BadgeCheck } from "lucide-react";
import { fadeUpVariants, fadeUpViewport } from "@/lib/motion-variants";

const STEPS = ["Format", "Prompt", "Refine", "Generate", "Pick", "Deliver"] as const;
const STEP_MS = 2600;

function PromptFrame() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-2">
      <p className="text-xs text-muted">You typed</p>
      <p className="text-sm leading-relaxed">
        Launch promo for our new sneaker drop
        <span className="animate-pulse text-muted">|</span>
      </p>
    </div>
  );
}

function RefineFrame() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Sparkles size={12} /> Expanding into a creative brief…
      </p>
      <div className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-background p-3">
        <div className="h-1.5 w-full rounded-full bg-border-subtle" />
        <div className="h-1.5 w-4/5 rounded-full bg-border-subtle" />
        <div className="h-1.5 w-3/5 rounded-full bg-border-subtle" />
      </div>
    </div>
  );
}

function FormatFrame() {
  // Poster and Video are the two real formats — storyboard isn't a third one, it's
  // how a video gets built (shown later, in the Generate/Pick frames), so it doesn't
  // get its own pill here.
  const options = ["Poster", "Video"];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="text-xs text-muted">Pick a format</p>
      <div className="flex gap-2">
        {options.map((f) => (
          <span
            key={f}
            className={
              f === "Video"
                ? "rounded-full bg-button-bg px-3 py-1.5 text-xs font-medium text-button-fg"
                : "rounded-full border border-border-strong px-3 py-1.5 text-xs text-foreground"
            }
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

function GenerateFrame() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Wand2 size={12} /> Generating takes…
      </p>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 w-11 animate-pulse rounded-lg bg-border-subtle" />
        ))}
      </div>
    </div>
  );
}

function PickFrame() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <MousePointerClick size={12} /> Pick your take
      </p>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={
              i === 1
                ? "relative h-14 w-11 rounded-lg border-2 border-foreground bg-border-subtle"
                : "h-14 w-11 rounded-lg bg-border-subtle opacity-40"
            }
          >
            {i === 1 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                <BadgeCheck size={10} strokeWidth={3} />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DeliverFrame() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <div className="flex h-16 w-14 items-center justify-center rounded-xl border border-border-strong bg-background">
        <BadgeCheck size={20} />
      </div>
      <p className="text-xs font-medium">On-brand, ready to ship</p>
    </div>
  );
}

const FRAMES = [FormatFrame, PromptFrame, RefineFrame, GenerateFrame, PickFrame, DeliverFrame];

export function WorkflowAnimation() {
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { amount: 0.6 });

  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isInView || reduceMotion) return;
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(t);
  }, [isInView, reduceMotion]);

  const Frame = FRAMES[step];

  return (
    <motion.section
      ref={containerRef}
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={fadeUpViewport}
      variants={fadeUpVariants}
      className="flex flex-col gap-8"
    >
      <p className="text-center text-xs font-medium tracking-[0.2em] text-muted uppercase">How it works</p>

      <div className="mx-auto w-full max-w-sm sm:max-w-md">
        <div className="rgb-border relative aspect-[4/3] w-full overflow-hidden p-6 sm:aspect-[16/10]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="flex h-full flex-col"
            >
              <Frame />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-5 flex items-center justify-between text-[10px] font-medium text-muted">
          {STEPS.map((s, i) => (
            <span key={s} className={i === step ? "text-foreground" : undefined}>
              {s}
            </span>
          ))}
        </div>
        <div className="relative mt-2 flex items-center justify-between">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-subtle" />
          <motion.div
            className="rgb-flow absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 origin-left rounded-full"
            animate={{ scaleX: step / (STEPS.length - 1) }}
            transition={{ duration: 0.4 }}
          />
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={
                i <= step
                  ? "relative z-10 h-1.5 w-1.5 rounded-full bg-foreground"
                  : "relative z-10 h-1.5 w-1.5 rounded-full bg-border-strong"
              }
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
