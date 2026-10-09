"use client";

import { DictationButton } from "@/components/ui/dictation-button";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowRight, Clapperboard, ImageIcon, LayoutTemplate, Play, Video, X } from "lucide-react";
import { clsx } from "clsx";
import { BorderBeam } from "@/components/ui/border-beam";
import { MediaThumb } from "@/components/ui/media-thumb";
import { savePrefillForProject } from "@/lib/draft-prompt";
import { createProject, type Account, type ProjectType, type Template } from "@/lib/api";

// A video template picked in the gallery, waiting in the prompt bar for the user's own idea.
export interface AttachedTemplate {
  template: Template;
  // The length picked in the preview (15/30 for studio films, the shot length for trendy ones).
  length: number;
}

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

export function CreateHero({
  account,
  productId,
  attached = null,
  onDetach,
}: {
  account: Account | null;
  productId?: string | null;
  attached?: AttachedTemplate | null;
  onDetach?: () => void;
}) {
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
  const dockInputRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Once the big prompt box scrolls out of view (e.g. while browsing templates), the same prompt
  // docks as a floating bar at the bottom of the screen, so creating is always one step away.
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) =>
      setDocked(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Picking a template puts the cursor straight into whichever prompt box is on screen.
  useEffect(() => {
    if (!attached) return;
    (docked ? dockInputRef.current : textareaRef.current)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a template is picked
  }, [attached]);

  const effectiveType: ProjectType = attached ? attached.template.type : projectType;

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
      if (attached) {
        const { template, length } = attached;
        const { project } = await createProject(template.name, template.type, productId ?? undefined);
        savePrefillForProject(project.id, prompt.trim());
        router.push(
          template.type === "video"
            ? `/projects/${project.id}/storyboard?template=${template.id}&length=${length}`
            : `/projects/${project.id}?template=${template.id}`,
        );
        return;
      }
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

  const templateChip = attached && (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-transparent bg-button-bg py-1 pr-1 pl-3 text-xs font-medium text-button-fg">
      <Play size={11} className="shrink-0 fill-current" />
      <span className="truncate">
        {attached.template.name} · {attached.length}s
      </span>
      <button
        type="button"
        onClick={onDetach}
        disabled={creating}
        aria-label="Remove template"
        className="rounded-full p-0.5 hover:bg-black/10"
      >
        <X size={12} />
      </button>
    </span>
  );
  const placeholder = attached
    ? "Describe your ad: your product and what it's for"
    : PLACEHOLDER_PROMPTS[placeholderIndex];
  const createButton = (
    <button
      type="button"
      onClick={handleSubmit}
      disabled={!prompt.trim() || creating}
      className="shiny-button inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-medium text-button-fg transition-transform duration-150 hover:scale-[1.05] active:scale-95 disabled:pointer-events-none disabled:opacity-40 disabled:hover:scale-100"
    >
      {creating ? "Creating…" : "Create"}
      {!creating && <ArrowRight size={14} />}
    </button>
  );
  const onEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-xl">
      <BorderBeam size="md" colorVariant="colorful" theme={beamTheme} active borderRadius={28}>
        <div className="rgb-border flex flex-col gap-4 p-5 sm:p-6">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onEnter}
            disabled={creating}
            placeholder={placeholder}
            rows={3}
            className="resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted disabled:opacity-60"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap gap-2">
              {templateChip}
              {!attached &&
                CHIPS.map((chip) => (
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
              {!attached && projectType === "video" && (
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

            <div className="flex items-center gap-2">
              <DictationButton value={prompt} onChange={setPrompt} disabled={creating} />
              {createButton}
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </BorderBeam>

      {docked &&
        mounted &&
        createPortal(
          // Floating composer, after DaVinci's: a pill row of modes above a frosted panel with a
          // template tile on the left and the prompt, settings and Create on the right. Spans the
          // content area to the right of the sidebar (w-16 / sm:w-56), centred in it.
          <div className="pointer-events-none fixed right-0 bottom-4 left-16 z-40 flex justify-center px-4 sm:left-56">
            <div className="flex w-full max-w-3xl flex-col items-start gap-2">
              <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border-subtle bg-surface/80 p-1 shadow-lg shadow-black/30 backdrop-blur-2xl">
                {CHIPS.map((chip) => {
                  const Icon = chip.id === "video" ? Video : ImageIcon;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      disabled={creating || Boolean(attached)}
                      onClick={() => setProjectType(chip.id)}
                      aria-pressed={effectiveType === chip.id}
                      className={clsx(
                        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors disabled:cursor-default",
                        effectiveType === chip.id ? "bg-button-bg text-button-fg" : "text-muted hover:text-foreground",
                      )}
                    >
                      <Icon size={14} />
                      {chip.label}
                    </button>
                  );
                })}
                {!attached && projectType === "video" && (
                  <>
                    <span className="mx-1 h-4 w-px bg-border-strong" aria-hidden />
                    <button
                      type="button"
                      disabled={creating}
                      onClick={() => setStoryboard((on) => !on)}
                      aria-pressed={storyboard}
                      className={clsx(
                        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                        storyboard ? "bg-foreground/10 text-foreground" : "text-muted hover:text-foreground",
                      )}
                    >
                      <Clapperboard size={14} /> Shot by shot
                    </button>
                  </>
                )}
              </div>

              <div className="pointer-events-auto flex w-full gap-3 rounded-3xl border border-border-subtle bg-surface/80 p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
                <button
                  type="button"
                  onClick={() =>
                    attached
                      ? onDetach?.()
                      : document.getElementById("templates")?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  disabled={creating}
                  title={attached ? "Remove template" : "Pick a template"}
                  className="group relative hidden w-28 shrink-0 flex-col justify-between overflow-hidden rounded-2xl bg-foreground/5 p-3 text-left text-xs text-muted transition-colors hover:bg-foreground/10 hover:text-foreground sm:flex"
                >
                  {attached?.template.thumbnail_url ? (
                    <>
                      <MediaThumb
                        src={attached.template.thumbnail_url}
                        type={attached.template.type === "video" ? "video" : "image"}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-60 transition-opacity group-hover:opacity-40"
                      />
                      <X size={14} className="relative self-end text-white" />
                      <span className="relative line-clamp-2 font-medium text-white">{attached.template.name}</span>
                    </>
                  ) : (
                    <>
                      <LayoutTemplate size={16} />
                      <span>Template</span>
                    </>
                  )}
                </button>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <textarea
                    ref={dockInputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={onEnter}
                    disabled={creating}
                    placeholder={placeholder}
                    rows={2}
                    className="min-w-0 flex-1 resize-none bg-transparent px-1 pt-1 text-sm outline-none placeholder:text-muted disabled:opacity-60"
                  />
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex h-8 min-w-0 items-center gap-1.5 truncate rounded-full border border-border-subtle bg-foreground/5 px-3 text-xs text-foreground">
                      {effectiveType === "video" ? <Video size={13} /> : <ImageIcon size={13} />}
                      {effectiveType === "video" ? "Video" : "Poster"}
                      {attached?.template.type === "video" &&
                        ` · ${attached.length}s · ${attached.template.aspect_ratio}`}
                      {!attached && projectType === "video" && (storyboard ? " · Shot by shot" : " · Quick")}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <DictationButton value={prompt} onChange={setPrompt} disabled={creating} />
                      {createButton}
                    </div>
                  </div>
                  {error && <p className="px-1 text-xs text-red-400">{error}</p>}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
