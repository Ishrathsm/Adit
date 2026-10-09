"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { clsx } from "clsx";

interface Step {
  title: string;
  instruction: string;
  image: string;
}

// Bumped every time these screenshots are recaptured, so browsers that cached the old bytes at
// the same filename are forced to fetch the new ones instead of silently showing stale images.
const IMAGE_VERSION = "1";

// Real screenshots of the actual app, captured by walking through the flow — not mockups, and
// not copies of any reference image. Only shown to organisation accounts, which have a brand
// kit card at the top of Projects.
const STEPS: Step[] = [
  {
    title: "Open your brand kit",
    instruction:
      'On the Projects page, click the brand card at the top (it shows "Finish your brand kit" until it\'s complete). This expands it in place into the full form.',
    image: "/tutorials/add-your-brand-kit/step1-collapsed.png",
  },
  {
    title: "Fill in the details and save",
    instruction:
      "Add your logo, pick your primary and secondary colors, and set your font and tagline. Use Brand rules to describe your tone of voice and any dos and don'ts, then click Save brand kit.",
    image: "/tutorials/add-your-brand-kit/step2-fill-form.png",
  },
];

export default function AddYourBrandKitTutorialPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 sm:px-10">
      <Link href="/tutorials" className="flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
        <ArrowLeft size={14} /> Tutorials
      </Link>

      <div className="mt-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Add your brand kit</h1>
        <p className="text-sm text-muted">Two quick steps, using the actual Adit screens.</p>
      </div>

      <VerticalStepper
        className="mt-8"
        steps={STEPS.map((step, i) => ({
          badge: String(i + 1),
          content: (
            <div className="rounded-2xl border border-border-strong bg-surface p-5">
              <div className="flex flex-col gap-3">
                <h4 className="text-sm font-semibold tracking-tight">{step.title}</h4>
                <p className="text-xs text-muted">{step.instruction}</p>
                <div className="overflow-hidden rounded-xl border border-border-subtle bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a real screenshot of the app, not a remote/dynamic image */}
                  <img src={`${step.image}?v=${IMAGE_VERSION}`} alt={step.title} className="h-auto w-full" />
                </div>
              </div>
            </div>
          ),
        }))}
      />
    </main>
  );
}

// A single line measured from the center of the first badge to the center of the last, instead
// of stitching together one flex-grown segment per row — measuring real DOM positions is robust
// to content height changes (responsive reflow, images loading in) that would otherwise misalign
// a per-row-segment line.
function VerticalStepper({ steps, className }: { steps: { badge: string; content: React.ReactNode }[]; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [line, setLine] = useState<{ top: number; height: number; left: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function measure() {
      const containerEl = containerRef.current;
      const first = badgeRefs.current[0];
      const last = badgeRefs.current[badgeRefs.current.length - 1];
      if (!containerEl || !first || !last) return;

      const containerRect = containerEl.getBoundingClientRect();
      const firstRect = first.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      const firstCenter = firstRect.top + firstRect.height / 2 - containerRect.top;
      const lastCenter = lastRect.top + lastRect.height / 2 - containerRect.top;
      const left = firstRect.left + firstRect.width / 2 - containerRect.left;

      setLine({ top: firstCenter, height: lastCenter - firstCenter, left });
    }

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [steps.length]);

  return (
    <div ref={containerRef} className={clsx("relative flex flex-col", className)}>
      {line && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute w-px bg-border-strong"
          style={{ top: line.top, height: line.height, left: line.left }}
        />
      )}
      {steps.map((step, i) => (
        <div key={i} className={clsx("flex gap-4", i !== steps.length - 1 && "pb-6")}>
          <div className="flex w-7 shrink-0 items-center justify-center">
            <span
              ref={(el) => {
                badgeRefs.current[i] = el;
              }}
              className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-button-bg text-xs font-semibold text-button-fg"
            >
              {step.badge}
            </span>
          </div>
          <div className="min-w-0 flex-1">{step.content}</div>
        </div>
      ))}
    </div>
  );
}
