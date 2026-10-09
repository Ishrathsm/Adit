"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Play, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaThumb } from "@/components/ui/media-thumb";
import { createProject, listTemplates, type Template, type TemplateType } from "@/lib/api";
import {
  CATEGORIES,
  FORMATS,
  ORIENTATIONS,
  filtersFromSearchParams,
  matchesFilters,
  searchParamsFromFilters,
  type TemplateFilters,
} from "@/lib/template-filters";

// Same chip styling as the aspect-ratio/Tone/Look pickers on the poster editor.
function chipClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs transition-colors ${
    active ? "border-transparent bg-button-bg text-button-fg" : "border-border-strong text-foreground hover:bg-white/5"
  }`;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Orientation/Format/Category chips above the gallery. Filters live in the URL query, merged onto
// whatever else is there (e.g. ?product=... for an organisation's brand), so they survive a reload.
function TemplateFilterBar({ filters, kind }: { filters: TemplateFilters; kind: TemplateType }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(next: TemplateFilters) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("orientation");
    params.delete("format");
    params.delete("category");
    searchParamsFromFilters(next).forEach((value, key) => params.set(key, value));
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }

  const active = filters.orientations.length > 0 || filters.formats.length > 0 || filters.category !== null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {ORIENTATIONS.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() =>
            apply({
              ...filters,
              orientations: toggle(filters.orientations, value),
            })
          }
          className={chipClass(filters.orientations.includes(value))}
        >
          {value}
        </button>
      ))}
      {/* Poster/Billboard/Social is read from an image's ratio; it means nothing for a video. */}
      {kind === "poster" && (
        <>
          <span className="mx-1 h-5 w-px bg-border-subtle" aria-hidden />
          {FORMATS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => apply({ ...filters, formats: toggle(filters.formats, value) })}
              className={chipClass(filters.formats.includes(value))}
            >
              {value}
            </button>
          ))}
        </>
      )}
      <span className="mx-1 h-5 w-px bg-border-subtle" aria-hidden />
      <select
        aria-label="Category"
        value={filters.category ?? ""}
        onChange={(e) => apply({ ...filters, category: e.target.value || null })}
        className="rounded-full border border-border-strong bg-background px-3 py-1.5 text-xs outline-none focus:border-foreground"
      >
        <option value="">All categories</option>
        {CATEGORIES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      {active && (
        <button
          type="button"
          onClick={() => apply({ orientations: [], formats: [], category: null })}
          className="px-2 text-xs text-muted hover:text-foreground"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

// Posters | Videos switch, kept in the URL (?kind=video) like the filters.
function KindTabs({ kind }: { kind: TemplateType }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pick(next: TemplateType) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "video") params.set("kind", "video");
    else params.delete("kind");
    // Format filters only exist for posters.
    if (next === "video") params.delete("format");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }

  return (
    <div
      className="mb-3 inline-flex rounded-full border border-border-strong p-0.5"
      role="tablist"
      aria-label="Template type"
    >
      {(["poster", "video"] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={kind === value}
          onClick={() => pick(value)}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            kind === value ? "bg-button-bg text-button-fg" : "text-muted hover:text-foreground"
          }`}
        >
          {value === "poster" ? "Posters" : "Videos"}
        </button>
      ))}
    </div>
  );
}

// "8s" for a one-shot template, "15s · 30s" for a studio one.
function lengthsLabel(t: Template): string {
  if (t.recipe?.singleSeconds) return `${t.recipe.singleSeconds}s`;
  return (t.recipe?.plans ?? []).map((p) => `${p.length}s`).join(" · ");
}

const isStudio = (t: Template) => t.recipe?.shelf === "studio";

// A video template's card picture: its still, and its small silent loop while hovered. The loop
// is only mounted on hover, so the grid never downloads a clip nobody looks at.
function VideoCardMedia({
  template,
  onLoad,
}: {
  template: Template;
  onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <MediaThumb
        src={template.thumbnail_url!}
        type="video"
        alt={template.name}
        className="h-full w-full object-cover"
        style={{ borderRadius: "var(--radius-card)" }}
        onLoad={onLoad}
      />
      {hovered && template.recipe?.hoverUrl && (
        <video
          src={template.recipe.hoverUrl}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          style={{ borderRadius: "var(--radius-card)" }}
        />
      )}
      <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
        <Play size={10} className="fill-current" /> {lengthsLabel(template)}
        {isStudio(template) && " · Studio"}
      </span>
    </div>
  );
}

function VideoTemplatePreview({
  template,
  onUse,
  onClose,
}: {
  template: Template;
  onUse: (seconds: number) => void;
  onClose: () => void;
}) {
  const recipe = template.recipe;
  const plans = recipe?.plans ?? [];
  const [length, setLength] = useState<number>(recipe?.singleSeconds ?? plans[plans.length - 1]?.length ?? 30);
  const plan = plans.find((p) => p.length === length);
  const samples = [template.thumbnail_url!, ...(recipe?.samples ?? [])];
  const [sample, setSample] = useState(0);
  const portrait = template.aspect_ratio === "9:16";

  return (
    <div
      className="rgb-border flex max-h-full w-full max-w-5xl flex-col gap-5 overflow-auto bg-background p-5 lg:flex-row"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`flex flex-col gap-2 ${portrait ? "items-center" : "lg:w-[60%]"}`}>
        <video
          key={samples[sample]}
          src={samples[sample]}
          controls
          autoPlay
          playsInline
          className={portrait ? "max-h-[70vh] w-auto bg-black" : "w-full bg-black"}
          style={{
            borderRadius: "var(--radius-card)",
            aspectRatio: template.aspect_ratio.replace(":", " / "),
          }}
        />
        {samples.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2">
            {samples.map((url, i) => (
              <button key={url} type="button" onClick={() => setSample(i)} className={chipClass(sample === i)}>
                Sample {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{template.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-full p-1 text-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        {template.description && <p className="text-sm text-muted">{template.description}</p>}

        {plans.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">Length</span>
            <div className="flex flex-wrap gap-2">
              {plans.map((p) => (
                <button
                  key={p.length}
                  type="button"
                  onClick={() => setLength(p.length)}
                  className={chipClass(length === p.length)}
                >
                  {p.length}s
                </button>
              ))}
            </div>
            {plan && (
              <p className="text-xs text-muted">
                {plan.shotCount} shots · {template.aspect_ratio} · music
                {recipe?.voiceover ? " + voice-over" : ""} · ends on your logo
              </p>
            )}
          </div>
        )}

        {recipe?.singleSeconds && (
          <p className="text-xs text-muted">
            One {recipe.singleSeconds}s shot · {template.aspect_ratio} · music · ends on your logo
          </p>
        )}

        {recipe && recipe.provide.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">What you&apos;ll provide</span>
            <ul className="flex flex-col gap-1 text-sm">
              {recipe.provide.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-muted">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-muted">
          {samples.length > 1 ? "The samples are" : "The sample is a"} {recipe?.sampleSeconds ?? 30}s{" "}
          {samples.length > 1 ? "ads" : "ad"} made with this template for made-up or other brands. Yours follows the
          same story, camera and pace with your own product, brand and words.
        </p>
        {isStudio(template) ? (
          <Button disabled className="mt-auto w-full justify-center">
            Studio flow – coming soon
          </Button>
        ) : (
          <Button onClick={() => onUse(length)} className="mt-auto w-full justify-center">
            <Wand2 size={16} /> Use this template
          </Button>
        )}
      </div>
    </div>
  );
}

// Target row height before a row is stretched to exactly fill the container's width (the same
// "justified gallery" layout Google Photos/Flickr use). Every picture keeps its own true shape;
// what changes per row is how tall that row ends up, so there's never empty space on the right.
const TARGET_ROW_HEIGHT = 208;
const GAP = 16;

interface LaidOutCard {
  template: Template;
  width: number;
  height: number;
}

// ratio is each picture's own true width/height (read via onLoad below) — never a rounded label
// — so the box this computes always matches the real image exactly: no crop, no stretch.
function layoutJustifiedRows(items: { template: Template; ratio: number }[], containerWidth: number): LaidOutCard[][] {
  if (containerWidth <= 0) return [];
  const rows: LaidOutCard[][] = [];
  let row: { template: Template; ratio: number }[] = [];
  let ratioSum = 0;

  const flushRow = (height: number) => {
    rows.push(
      row.map(({ template, ratio }) => ({
        template,
        height,
        width: height * ratio,
      })),
    );
    row = [];
    ratioSum = 0;
  };

  for (const item of items) {
    row.push(item);
    ratioSum += item.ratio;
    const widthAtTarget = ratioSum * TARGET_ROW_HEIGHT + GAP * (row.length - 1);
    if (widthAtTarget >= containerWidth) {
      flushRow((containerWidth - GAP * (row.length - 1)) / ratioSum);
    }
  }
  // A leftover, not-yet-full row keeps the target height instead of stretching huge to fill the
  // last line — the standard choice every justified-gallery implementation makes.
  if (row.length) flushRow(TARGET_ROW_HEIGHT);

  return rows;
}

// Falls back to a square guess if aspect_ratio is missing (an older template row from before
// that column existed) — the real onLoad-measured ratio replaces this the moment the image loads.
function ratioFromLabel(aspectRatio: Template["aspect_ratio"] | undefined): number {
  if (!aspectRatio) return 1;
  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return 1;
  return w / h;
}

// Curated poster templates: click one to preview it large, then Remix to start a poster in that
// template's style — the template is preselected, the prompt is left empty for the user's own ad,
// and their logo or product photos go in as reference images.
export function TemplateGallery({
  productId,
  needsProduct,
  onUseVideoTemplate,
}: {
  productId: string | null;
  needsProduct: boolean;
  // A picked video template goes to the prompt bar, where the user describes their own ad.
  onUseVideoTemplate: (template: Template, seconds: number) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kind: TemplateType = searchParams.get("kind") === "video" ? "video" : "poster";
  const [templatesByKind, setTemplatesByKind] = useState<Partial<Record<TemplateType, Template[]>>>({});
  const templates = templatesByKind[kind] ?? null;
  const [preview, setPreview] = useState<Template | null>(null);
  const [remixing, setRemixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each picture's true ratio, read once it loads — until then the rounded aspect_ratio label is
  // used as a placeholder so the layout isn't empty while images are still loading in.
  const [naturalRatios, setNaturalRatios] = useState<Record<string, number>>({});
  // A callback ref, not useRef: the container <div> doesn't exist yet on the first render or two
  // (templates === null returns early, before that div is ever mounted), so a plain useRef(null)
  // effect with an empty dependency array would run once while the ref is still null and never
  // re-fire once the div actually appears — leaving containerWidth stuck at 0 forever. A callback
  // ref fires again the moment the real node shows up, so this can't go stale.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (templatesByKind[kind]) return;
    listTemplates(kind)
      .then(({ templates }) =>
        setTemplatesByKind((prev) => ({
          ...prev,
          [kind]: templates.filter((t) => t.thumbnail_url),
        })),
      )
      .catch(() => setTemplatesByKind((prev) => ({ ...prev, [kind]: [] })));
  }, [kind, templatesByKind]);

  useEffect(() => {
    if (!containerEl) return;
    // ResizeObserver delivers one entry immediately on observe() even if nothing has resized yet,
    // so this alone also covers the initial width — no separate synchronous read needed.
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(containerEl);
    return () => observer.disconnect();
  }, [containerEl]);

  // Orientation/Format/Category come from the filter bar as URL query params.
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const filteredTemplates = useMemo(
    () => (templates ?? []).filter((t) => matchesFilters(t, filters)),
    [templates, filters],
  );

  // Video templates sit on two shelves: quick trendy shots, then studio films.
  const groups = useMemo(() => {
    const shelves =
      kind === "video"
        ? [
            {
              title: "Trendy",
              note: "One quick shot, made straight from your prompt.",
              items: filteredTemplates.filter((t) => !isStudio(t)),
            },
            {
              title: "Studio ads",
              note: "Longer films with a step-by-step studio flow, coming soon.",
              items: filteredTemplates.filter(isStudio),
            },
          ]
        : [{ title: null, note: null, items: filteredTemplates }];
    return shelves
      .filter((shelf) => shelf.items.length)
      .map((shelf) => ({
        ...shelf,
        rows: layoutJustifiedRows(
          shelf.items.map((template) => ({
            template,
            ratio: naturalRatios[template.id] ?? ratioFromLabel(template.aspect_ratio),
          })),
          containerWidth,
        ),
      }));
  }, [kind, filteredTemplates, naturalRatios, containerWidth]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !remixing && setPreview(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, remixing]);

  async function remix(template: Template) {
    if (needsProduct && !productId) {
      setError("Open one of your brands first, then remix a template for it.");
      return;
    }
    setRemixing(true);
    setError(null);
    try {
      const { project } = await createProject(`${template.name} remix`, "poster", productId ?? undefined);
      router.push(`/projects/${project.id}?template=${template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRemixing(false);
    }
  }

  if (templates === null) return <KindTabs kind={kind} />;
  if (!templates.length) {
    return (
      <>
        <KindTabs kind={kind} />
        <p className="rgb-border p-8 text-center text-sm text-muted">No {kind} templates yet.</p>
      </>
    );
  }
  if (!filteredTemplates.length) {
    return (
      <>
        <KindTabs kind={kind} />
        <TemplateFilterBar filters={filters} kind={kind} />
        <p className="rgb-border p-8 text-center text-sm text-muted">No templates match these filters.</p>
      </>
    );
  }

  const measure = (id: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    const ratio = img.naturalWidth / img.naturalHeight;
    setNaturalRatios((prev) => (prev[id] === ratio ? prev : { ...prev, [id]: ratio }));
  };

  return (
    <>
      <KindTabs kind={kind} />
      <TemplateFilterBar filters={filters} kind={kind} />
      {/* A justified photo-wall: each row stretches to exactly fill the container's width, with
          every picture kept at its own true shape — rows end up slightly different heights so
          there's never empty space on the right, and nothing is cropped or stretched. */}
      <div ref={setContainerEl} className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.title ?? "all"} className="flex flex-col gap-4">
            {group.title && (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold">{group.title}</h3>
                <p className="text-xs text-muted">{group.note}</p>
              </div>
            )}
            {group.rows.map((row, i) => (
              <div key={i} className="flex gap-4">
                {row.map(({ template: t, width, height }) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setError(null);
                      setPreview(t);
                    }}
                    className="group shrink-0 text-left focus-visible:outline-none"
                    style={{ width }}
                  >
                    {/* The image's own corners are rounded to match --radius-card (the same token
                    .rgb-border uses) so the picture's edge and its card chrome read as one
                    consistent shape, instead of two different roundings stacked on top of each
                    other. */}
                    <div className="rgb-border" style={{ width, height }}>
                      {t.type === "video" ? (
                        <VideoCardMedia template={t} onLoad={measure(t.id)} />
                      ) : (
                        <MediaThumb
                          src={t.thumbnail_url!}
                          alt={t.name}
                          className="h-full w-full"
                          style={{ borderRadius: "var(--radius-card)" }}
                          onLoad={measure(t.id)}
                        />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {preview &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => !remixing && setPreview(null)}
            role="dialog"
            aria-modal="true"
            aria-label={preview.name}
          >
            {preview.type === "video" ? (
              <VideoTemplatePreview
                template={preview}
                onClose={() => setPreview(null)}
                onUse={(length) => {
                  setPreview(null);
                  onUseVideoTemplate(preview, length);
                }}
              />
            ) : (
              <div
                className="rgb-border flex max-h-full w-full max-w-4xl flex-col gap-5 overflow-auto bg-background p-5 sm:flex-row"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- remote curated template image */}
                <img
                  src={preview.thumbnail_url!}
                  alt={preview.name}
                  className="max-h-[75vh] w-full object-contain sm:w-auto sm:max-w-[55%]"
                  style={{ borderRadius: "var(--radius-card)" }}
                />
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-semibold tracking-tight">{preview.name}</h2>
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      disabled={remixing}
                      aria-label="Close preview"
                      className="rounded-full p-1 text-muted hover:text-foreground disabled:opacity-50"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {preview.description && <p className="text-sm text-muted">{preview.description}</p>}
                  <p className="text-sm text-muted">
                    Remix it for your own ad: describe what it&apos;s for, and add your logo or product photos as
                    reference images. Anything you don&apos;t give us — prices, dates, contact details — stays off the
                    poster.
                  </p>
                  <Button onClick={() => remix(preview)} disabled={remixing} className="w-full justify-center">
                    <Wand2 size={16} /> {remixing ? "Opening…" : "Remix with this template"}
                  </Button>
                  {error && <p className="text-sm text-red-400">{error}</p>}
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
