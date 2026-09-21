"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowRight, Clapperboard } from "lucide-react";
import { clsx } from "clsx";
import { BorderBeam } from "@/components/ui/border-beam";
import { saveDraftPrompt, type DraftProjectType } from "@/lib/draft-prompt";

// The hero's signature flourish — always on, not gated to a single moment. Earlier
// rounds kept BorderBeam deliberately rare/restrained; this is a direct founder call
// to make it more present, so it now frames the input continuously.
const BEAM = { size: "md", colorVariant: "colorful" } as const;

const PLACEHOLDER_PROMPTS = [
  "Launch promo for our new sneaker drop",
  "30% off summer collection, upbeat tone",
  "Product teaser for weekend flash sale",
  "Cozy autumn launch for our candle line",
];

// Poster and Video are the two real output formats. Storyboard isn't a third format —
// it's a way of building a video (shot by shot, picking a take per shot), so it only
// shows up as a sub-toggle once Video is selected, matching how /projects actually
// treats it ("Text → Video" vs "Text → Storyboard → Video" within a video project).
const CHIPS: { id: DraftProjectType; label: string }[] = [
  { id: "poster", label: "Poster" },
  { id: "video", label: "Video" },
];

const ROTATE_MS = 4000;

export function FunctionalHero() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const beamTheme = mounted && resolvedTheme === "light" ? "light" : "dark";

  const [prompt, setPrompt] = useState("");
  const [projectType, setProjectType] = useState<DraftProjectType>("poster");
  const [storyboard, setStoryboard] = useState(false);
  const [focused, setFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focused || prompt) return;
    const t = setInterval(() => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_PROMPTS.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [focused, prompt]);

  function handleSubmit() {
    if (!prompt.trim() || confirming) return;
    setConfirming(true);
    saveDraftPrompt({ prompt: prompt.trim(), projectType, storyboard: projectType === "video" && storyboard });
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
    window.setTimeout(() => router.push("/login?mode=sign-up&draft=1"), delay);
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <BorderBeam size={BEAM.size} colorVariant={BEAM.colorVariant} theme={beamTheme} active borderRadius={28}>
        <div className="rgb-border flex flex-col gap-4 p-5 sm:p-6">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={confirming}
            placeholder={PLACEHOLDER_PROMPTS[placeholderIndex]}
            rows={3}
            className="resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted disabled:opacity-60"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  disabled={confirming}
                  onClick={() => setProjectType(chip.id)}
                  className={clsx(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:scale-[1.05] active:scale-95 disabled:opacity-50 disabled:hover:scale-100",
                    projectType === chip.id
                      ? "border-transparent bg-button-bg text-button-fg"
                      : "border-border-strong text-foreground hover:bg-white/5",
                  )}
                >
                  {chip.label}
                </button>
              ))}
              {projectType === "video" && (
                <button
                  type="button"
                  disabled={confirming}
                  onClick={() => setStoryboard((s) => !s)}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:scale-[1.05] active:scale-95 disabled:opacity-50 disabled:hover:scale-100",
                    storyboard
                      ? "border-transparent bg-button-bg text-button-fg"
                      : "border-border-strong text-foreground hover:bg-white/5",
                  )}
                >
                  <Clapperboard size={12} />
                  Shot by shot
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!prompt.trim() || confirming}
              className="shiny-button inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-medium text-button-fg transition-transform duration-150 hover:scale-[1.05] active:scale-95 disabled:pointer-events-none disabled:opacity-40 disabled:hover:scale-100"
            >
              {confirming ? "Continuing…" : "Get started"}
              {!confirming && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </BorderBeam>
    </div>
  );
}
