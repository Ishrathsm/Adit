"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { clsx } from "clsx";

interface Way {
  title: string;
  instruction: string;
  image: string;
  note?: string;
}

// Bumped every time these screenshots are recaptured, so browsers that cached the old bytes at
// the same filename are forced to fetch the new ones instead of silently showing stale images.
const IMAGE_VERSION = "13";

// Way 1 (through Projects), broken into its sub-actions: write the brief, hit Create, fill in the
// fields and Generate, then the finished poster with Download/Share. Every image here is a real
// screenshot captured from the running app, not a mockup or a reused reference — references only
// informed what to capture.
const WAY_1_STEPS: Way[] = [
  {
    title: "Write your poster's brief",
    instruction: 'On the Projects page, type what your poster is for into the "What will you create today?" box.',
    image: "/tutorials/create-first-poster/way1-step1-write-name.png",
  },
  {
    title: "Click Create",
    instruction: "Keep Poster selected and hit Create. Fill in the required fields and click Generate.",
    image: "/tutorials/create-first-poster/way1-editor-result.png",
  },
  {
    title: "Download or share it",
    instruction: "Once it's Done, the generated poster shows up on the right. Click Download to save it, or Share to WhatsApp to send it straight from there. You can also find it later in Notifications.",
    image: "/tutorials/create-first-poster/way1-step3-result.png",
  },
];

// Way 2: the sidebar's quick-create path, as an alternative to typing into the Projects hero box.
const WAY_2: Way = {
  title: "From the sidebar — Poster → New poster",
  instruction: "Click Poster in the sidebar, then New poster. This opens a blank editor where you type your brief and pick your options before hitting Generate.",
  image: "/tutorials/create-first-poster/way2-sidebar-poster.png",
};

export default function CreateFirstPosterTutorialPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 sm:px-10">
      <Link href="/tutorials" className="flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
        <ArrowLeft size={14} /> Tutorials
      </Link>

      <div className="mt-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create your first poster</h1>
        <p className="text-sm text-muted">Three quick steps, using the actual Adit screens.</p>
      </div>

      <VerticalStepper
        className="mt-8"
        steps={[
          {
            badge: "1",
            content: (
              <div className="relative rounded-2xl border border-border-strong bg-surface p-5">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <WayContent title={WAY_1_STEPS[0].title} instruction={WAY_1_STEPS[0].instruction} note={WAY_1_STEPS[0].note} image={WAY_1_STEPS[0].image} />

                  {/* Mobile only: the two flows stack, so "Or" sits between them as an ordinary divider. */}
                  <div className="flex items-center gap-3 sm:hidden">
                    <div aria-hidden="true" className="h-px flex-1 bg-border-subtle" />
                    <span className="text-xs font-medium text-muted uppercase">Or</span>
                    <div aria-hidden="true" className="h-px flex-1 bg-border-subtle" />
                  </div>

                  <WayContent title={WAY_2.title} instruction={WAY_2.instruction} image={WAY_2.image} />
                </div>

                {/* Desktop only: the two flows sit side by side, so "Or" floats centered in the gap
                    between them instead. */}
                <div className="pointer-events-none absolute inset-0 hidden items-center justify-center sm:flex">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-surface text-xs font-semibold text-muted shadow-lg">
                    Or
                  </span>
                </div>
              </div>
            ),
          },
          {
            badge: "2",
            content: <WayContentCard title={WAY_1_STEPS[1].title} instruction={WAY_1_STEPS[1].instruction} image={WAY_1_STEPS[1].image} />,
          },
          {
            badge: "3",
            content: <WayContentCard title={WAY_1_STEPS[2].title} instruction={WAY_1_STEPS[2].instruction} image={WAY_1_STEPS[2].image} />,
          },
        ]}
      />
    </main>
  );
}

interface Step {
  badge: string;
  content: React.ReactNode;
}

// A single line measured from the center of the first badge to the center of the last, instead
// of stitching together one flex-grown segment per row. Per-row segments only lined up because
// their colors matched where they touched — any mismatch between a badge's position and its
// row's actual height (e.g. an image loading in and changing a card's height, or a breakpoint
// change) broke the illusion. Measuring real DOM positions is robust to both.
function VerticalStepper({ steps, className }: { steps: Step[]; className?: string }) {
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

    // Catches height changes from responsive reflow, text wrapping, and the step screenshots
    // (real <img>s) loading in after the initial measurement — any of which would otherwise
    // leave the line pointing at stale badge positions.
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

function WayContent({ title, instruction, note, image }: { title: string; instruction: string; note?: string; image: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold tracking-tight">{title}</h4>
      <p className="text-xs text-muted">
        {instruction}
        {note && ` ${note}`}
      </p>
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element -- a real screenshot of the app, not a remote/dynamic image */}
        <img src={`${image}?v=${IMAGE_VERSION}`} alt={title} className="h-auto w-full" />
      </div>
    </div>
  );
}

function WayContentCard({ title, instruction, image }: { title: string; instruction: string; image: string }) {
  return (
    <div className="rounded-2xl border border-border-strong bg-surface p-5">
      <WayContent title={title} instruction={instruction} image={image} />
    </div>
  );
}
