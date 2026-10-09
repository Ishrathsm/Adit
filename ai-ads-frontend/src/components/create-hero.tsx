"use client";

import { DictationButton } from "@/components/ui/dictation-button";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  ImageIcon,
  ImagePlus,
  LayoutTemplate,
  MapPin,
  Package,
  Sparkles,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { MediaThumb } from "@/components/ui/media-thumb";
import { type ComposerHandoff, saveHandoffForProject, savePrefillForProject } from "@/lib/draft-prompt";
import {
  ASPECT_RATIOS,
  createProject,
  STORYBOARD_ASPECT_RATIOS,
  VIDEO_RESOLUTIONS,
  type Account,
  type AspectRatio,
  type ProjectType,
  type StoryboardAspectRatio,
  type Template,
  type VideoResolution,
} from "@/lib/api";

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

// Video length in the composer: one quick shot of 4/6/8s, or a shot-by-shot ad.
type VideoLength = "4" | "6" | "8" | "ad";
const VIDEO_LENGTHS: { value: VideoLength; label: string }[] = [
  { value: "4", label: "4s" },
  { value: "6", label: "6s" },
  { value: "8", label: "8s" },
  { value: "ad", label: "Shot by shot" },
];

type ReferenceKind = "product" | "character" | "location";
const REFERENCE_KINDS: { kind: ReferenceKind; label: string; icon: typeof Package }[] = [
  { kind: "product", label: "Product photo", icon: Package },
  { kind: "character", label: "Person", icon: UserRound },
  { kind: "location", label: "Place", icon: MapPin },
];
const MAX_REFERENCES = 3;

interface PickedImage {
  file: File;
  previewUrl: string;
}

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
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const [prompt, setPrompt] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("poster");
  // Composer settings, handed to the project page that opens (see ComposerHandoff).
  const [posterRatio, setPosterRatio] = useState<AspectRatio>("1:1");
  const [videoRatio, setVideoRatio] = useState<StoryboardAspectRatio>("9:16");
  const [videoLength, setVideoLength] = useState<VideoLength>("8");
  const [resolution, setResolution] = useState<VideoResolution>("720p");
  const [enhance, setEnhance] = useState(true);
  const [startImage, setStartImage] = useState<PickedImage | null>(null);
  const [references, setReferences] = useState<(PickedImage & { kind: ReferenceKind })[]>([]);
  const startInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<ReferenceKind>("product");
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
      const type = attached ? attached.template.type : projectType;
      const handoff: ComposerHandoff = {
        enhance,
        references: references.map(({ file, kind }) => ({ file, kind })),
        ...(type === "video"
          ? {
              resolution,
              startImage: startImage?.file ?? null,
              ...(attached
                ? {}
                : {
                    aspectRatio: videoRatio,
                    format: videoLength === "ad" ? ("ad" as const) : ("single" as const),
                    ...(videoLength !== "ad" ? { singleSeconds: Number(videoLength) as 4 | 6 | 8 } : {}),
                  }),
            }
          : { ...(attached ? {} : { aspectRatio: posterRatio }) }),
      };
      const name = attached ? attached.template.name : type === "video" ? "Untitled Video Ad" : "Untitled Poster Ad";
      const { project } = await createProject(name, type, productId ?? undefined);
      savePrefillForProject(project.id, prompt.trim());
      saveHandoffForProject(project.id, handoff);
      const templateQuery = attached
        ? `?template=${attached.template.id}${type === "video" ? `&length=${attached.length}` : ""}`
        : "";
      router.push(
        type === "video"
          ? `/projects/${project.id}/storyboard${templateQuery}`
          : `/projects/${project.id}${templateQuery}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  }

  function pickStart(file: File | undefined) {
    if (!file) return;
    if (startImage) URL.revokeObjectURL(startImage.previewUrl);
    setStartImage({ file, previewUrl: URL.createObjectURL(file) });
  }

  function addReference(file: File | undefined) {
    if (!file || references.length >= MAX_REFERENCES) return;
    setReferences((list) => [...list, { file, previewUrl: URL.createObjectURL(file), kind: pendingKind.current }]);
  }

  function removeReference(index: number) {
    setReferences((list) => {
      URL.revokeObjectURL(list[index].previewUrl);
      return list.filter((_, i) => i !== index);
    });
  }

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

  // A setting pill: a native select styled like DaVinci's "Auto · 4 Sec · 480p" pills.
  const pillSelect = <T extends string>(
    label: string,
    value: T,
    options: readonly { value: T; label: string }[],
    onChange: (value: T) => void,
  ) => (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        value={value}
        disabled={creating}
        onChange={(e) => onChange(e.target.value as T)}
        className="field-sizing-content h-8 cursor-pointer appearance-none rounded-full border border-border-subtle bg-foreground/5 pr-7 pl-3 text-xs text-foreground outline-none hover:bg-foreground/10 focus:border-border-strong disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
    </span>
  );

  const tileClass =
    "group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-foreground/5 p-3 text-left text-xs text-muted transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50";

  // The prompt composer, after DaVinci's: a pill row of modes above a frosted panel with picture
  // tiles (template, start image, references) on the left and the prompt, setting pills and
  // Create on the right. Rendered at the top of the page and, once that scrolls away, again as a
  // floating bar at the bottom — both bound to the same state.
  const composer = (inputRef: React.RefObject<HTMLTextAreaElement | null>, rows: number) => (
    <div className="flex w-full flex-col items-start gap-2 text-left">
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
      </div>

      <div className="pointer-events-auto flex w-full gap-3 rounded-3xl border border-border-subtle bg-surface/80 p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className="hidden w-60 shrink-0 flex-col gap-2 sm:flex">
          <div className="grid h-24 grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                attached
                  ? onDetach?.()
                  : document.getElementById("templates")?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              disabled={creating}
              title={attached ? "Remove template" : "Pick a template"}
              className={clsx(tileClass, effectiveType !== "video" && "col-span-2")}
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
            {effectiveType === "video" ? (
              <button
                type="button"
                onClick={() => (startImage ? setStartImage(null) : startInputRef.current?.click())}
                disabled={creating}
                title={startImage ? "Remove start image" : "The first shot starts from this picture"}
                className={tileClass}
              >
                {startImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file */}
                    <img
                      src={startImage.previewUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-40"
                    />
                    <X size={14} className="relative self-end text-white" />
                    <span className="relative font-medium text-white">Start image</span>
                  </>
                ) : (
                  <>
                    <ImagePlus size={16} />
                    <span>Start image</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
          <div className="flex h-10 items-center gap-1.5 rounded-2xl bg-foreground/5 px-3 text-xs text-muted">
            {references.length ? (
              <div className="flex flex-1 gap-1.5">
                {references.map((ref, i) => (
                  <button
                    key={ref.previewUrl}
                    type="button"
                    onClick={() => removeReference(i)}
                    title={`Remove ${ref.kind === "character" ? "person" : ref.kind === "location" ? "place" : "product"} photo`}
                    className="group relative h-7 w-7 overflow-hidden rounded-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file */}
                    <img src={ref.previewUrl} alt="" className="h-full w-full object-cover" />
                    <X size={12} className="absolute inset-0 m-auto hidden text-white group-hover:block" />
                  </button>
                ))}
              </div>
            ) : (
              <span className="flex-1">References</span>
            )}
            {references.length < MAX_REFERENCES &&
              REFERENCE_KINDS.map(({ kind, label, icon: Icon }) => (
                <button
                  key={kind}
                  type="button"
                  title={`Add a ${label.toLowerCase()}`}
                  aria-label={`Add a ${label.toLowerCase()}`}
                  disabled={creating}
                  onClick={() => {
                    pendingKind.current = kind;
                    referenceInputRef.current?.click();
                  }}
                  className="rounded-full p-1.5 hover:bg-foreground/10 hover:text-foreground"
                >
                  <Icon size={14} />
                </button>
              ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:border-l sm:border-border-subtle sm:pl-3">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onEnter}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={creating}
            placeholder={placeholder}
            rows={rows}
            className="min-w-0 flex-1 resize-none bg-transparent px-1 pt-1 text-sm outline-none placeholder:text-muted disabled:opacity-60"
          />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {effectiveType === "poster" &&
              !attached &&
              pillSelect(
                "Poster shape",
                posterRatio,
                ASPECT_RATIOS.map((r) => ({ value: r, label: r })),
                setPosterRatio,
              )}
            {effectiveType === "video" &&
              !attached &&
              pillSelect(
                "Video shape",
                videoRatio,
                STORYBOARD_ASPECT_RATIOS.map((r) => ({ value: r.value, label: r.value })),
                setVideoRatio,
              )}
            {effectiveType === "video" &&
              !attached &&
              pillSelect("Video length", videoLength, VIDEO_LENGTHS, setVideoLength)}
            {attached?.template.type === "video" && (
              <span className="inline-flex h-8 items-center rounded-full border border-border-subtle bg-foreground/5 px-3 text-xs text-foreground">
                {attached.length}s · {attached.template.aspect_ratio}
              </span>
            )}
            {effectiveType === "video" &&
              pillSelect(
                "Video quality",
                resolution,
                VIDEO_RESOLUTIONS.map((r) => ({ value: r, label: r })),
                setResolution,
              )}
            <button
              type="button"
              disabled={creating}
              onClick={() => setEnhance((on) => !on)}
              aria-pressed={enhance}
              title={
                enhance
                  ? "Your prompt is expanded into a detailed brief for best results"
                  : "Your prompt is used exactly as written"
              }
              className={clsx(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
                enhance
                  ? "border-border-subtle bg-foreground/5 text-foreground hover:bg-foreground/10"
                  : "border-border-subtle text-muted hover:text-foreground",
              )}
            >
              <Sparkles size={13} /> {enhance ? "Enhance on" : "Enhance off"}
            </button>
            <div className="ml-auto flex items-center gap-2">
              <DictationButton value={prompt} onChange={setPrompt} disabled={creating} />
              {createButton}
            </div>
          </div>
          {error && <p className="px-1 text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-3xl">
      {composer(textareaRef, 3)}
      <input
        ref={startInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pickStart(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={referenceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          addReference(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {docked &&
        mounted &&
        createPortal(
          // Spans the content area to the right of the sidebar (w-16 / sm:w-56), centred in it.
          <div className="pointer-events-none fixed right-0 bottom-4 left-16 z-40 flex justify-center px-4 sm:left-56">
            <div className="w-full max-w-3xl">{composer(dockInputRef, 2)}</div>
          </div>,
          document.body,
        )}
    </div>
  );
}
