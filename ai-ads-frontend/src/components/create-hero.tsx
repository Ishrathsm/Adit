"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowRight, Clapperboard } from "lucide-react";
import { clsx } from "clsx";
import { BorderBeam } from "@/components/ui/border-beam";
import { savePrefillForProject } from "@/lib/draft-prompt";
import { createProject, type Account, type ProjectType } from "@/lib/api";

// Logged-in counterpart to the marketing landing page's FunctionalHero — same
// input/chips/beam pattern, but submitting creates the project immediately instead of
// stashing a draft and redirecting to sign-up.
const PLACEHOLDER_PROMPTS = [
  "Launch promo for our new sneaker drop",
  "30% off summer collection, upbeat tone",
  "Product teaser for weekend flash sale",
  "Cozy autumn launch for our candle line",
];

const CHIPS: { id: ProjectType; label: string }[] = [
  { id: "poster", label: "Poster" },
  { id: "video", label: "Video" },
];

const ROTATE_MS = 4000;

export function CreateHero({ account, productId }: { account: Account | null; productId?: string | null }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const beamTheme = mounted && resolvedTheme === "light" ? "light" : "dark";

  const [prompt, setPrompt] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("poster");
  const [storyboard, setStoryboard] = useState(false);
  const [focused, setFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focused || prompt) return;
    const t = setInterval(() => setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_PROMPTS.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [focused, prompt]);

  async function handleSubmit() {
    if (!prompt.trim() || creating) return;
    if (account?.account_type === "organisation" && !productId) {
      router.push("/onboarding/organisation");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const name = projectType === "video" ? "Untitled Video Ad" : "Untitled Poster Ad";
      const { project } = await createProject(name, projectType, productId ?? undefined);
      savePrefillForProject(project.id, prompt.trim());
      router.push(
        projectType === "video" && storyboard ? `/projects/${project.id}/storyboard` : `/projects/${project.id}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <BorderBeam size="md" colorVariant="colorful" theme={beamTheme} active borderRadius={28}>
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
            disabled={creating}
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
                  disabled={creating}
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
                  disabled={creating}
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
              disabled={!prompt.trim() || creating}
              className="shiny-button inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-medium text-button-fg transition-transform duration-150 hover:scale-[1.05] active:scale-95 disabled:pointer-events-none disabled:opacity-40 disabled:hover:scale-100"
            >
              {creating ? "Creating…" : "Create"}
              {!creating && <ArrowRight size={14} />}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </BorderBeam>
    </div>
  );
}
