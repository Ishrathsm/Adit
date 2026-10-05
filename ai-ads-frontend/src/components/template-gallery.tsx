"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createProject, listTemplates, type Template } from "@/lib/api";
import { filtersFromSearchParams, matchesFilters } from "@/lib/template-filters";

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
    rows.push(row.map(({ template, ratio }) => ({ template, height, width: height * ratio })));
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
export function TemplateGallery({ productId, needsProduct }: { productId: string | null; needsProduct: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [templates, setTemplates] = useState<Template[] | null>(null);
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
    listTemplates("poster")
      .then(({ templates }) => setTemplates(templates.filter((t) => t.thumbnail_url)))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (!containerEl) return;
    // ResizeObserver delivers one entry immediately on observe() even if nothing has resized yet,
    // so this alone also covers the initial width — no separate synchronous read needed.
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(containerEl);
    return () => observer.disconnect();
  }, [containerEl]);

  // Orientation/Format/Category come from the sidebar's filter drawer as URL query params, so
  // applying a filter there doesn't need any direct connection to this component.
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const filteredTemplates = useMemo(
    () => (templates ?? []).filter((t) => matchesFilters(t, filters)),
    [templates, filters],
  );

  const rows = useMemo(() => {
    const items = filteredTemplates.map((template) => ({
      template,
      ratio: naturalRatios[template.id] ?? ratioFromLabel(template.aspect_ratio),
    }));
    return layoutJustifiedRows(items, containerWidth);
  }, [filteredTemplates, naturalRatios, containerWidth]);

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

  if (templates === null) return null;
  if (!templates.length) {
    return <p className="rgb-border p-8 text-center text-sm text-muted">No templates yet.</p>;
  }
  if (!filteredTemplates.length) {
    return <p className="rgb-border p-8 text-center text-sm text-muted">No templates match these filters.</p>;
  }

  return (
    <>
      {/* A justified photo-wall: each row stretches to exactly fill the container's width, with
          every picture kept at its own true shape — rows end up slightly different heights so
          there's never empty space on the right, and nothing is cropped or stretched. */}
      <div ref={setContainerEl} className="flex flex-col gap-4">
        {rows.map((row, i) => (
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
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote curated template image */}
                  <img
                    src={t.thumbnail_url!}
                    alt={t.name}
                    className="h-full w-full"
                    style={{ borderRadius: "var(--radius-card)" }}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (!img.naturalWidth || !img.naturalHeight) return;
                      const ratio = img.naturalWidth / img.naturalHeight;
                      setNaturalRatios((prev) => (prev[t.id] === ratio ? prev : { ...prev, [t.id]: ratio }));
                    }}
                  />
                </div>
              </button>
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
                  reference images. Anything you don&apos;t give us — prices, dates, contact details — stays off
                  the poster.
                </p>
                <Button onClick={() => remix(preview)} disabled={remixing} className="w-full justify-center">
                  <Wand2 size={16} /> {remixing ? "Opening…" : "Remix with this template"}
                </Button>
                {error && <p className="text-sm text-red-400">{error}</p>}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
