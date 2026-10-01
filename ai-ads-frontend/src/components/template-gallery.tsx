"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createProject, listTemplates, type Template } from "@/lib/api";

// Curated poster templates: click one to preview it large, then Remix to start a poster in that
// template's style — the template is preselected, the prompt is left empty for the user's own ad,
// and their logo or product photos go in as reference images.
export function TemplateGallery({ productId, needsProduct }: { productId: string | null; needsProduct: boolean }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const [remixing, setRemixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTemplates("poster")
      .then(({ templates }) => setTemplates(templates.filter((t) => t.thumbnail_url)))
      .catch(() => setTemplates([]));
  }, []);

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

  return (
    <>
      {/* Every card shares one row height; width comes naturally from the browser scaling each
          image to that height at its own true shape — never stretched, never cropped. No name
          shown here; it only appears in the popup below. */}
      <div className="flex flex-wrap gap-4">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setError(null);
              setPreview(t);
            }}
            className="group shrink-0 text-left focus-visible:outline-none"
          >
            {/* The image's own corners are rounded to match --radius-card (the same token
                .rgb-border uses) so the picture's edge and its card chrome read as one
                consistent shape, instead of two different roundings stacked on top of each
                other. */}
            <div className="rgb-border h-48 sm:h-56">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote curated template image */}
              <img
                src={t.thumbnail_url!}
                alt={t.name}
                className="h-full w-auto"
                style={{ borderRadius: "var(--radius-card)" }}
              />
            </div>
          </button>
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
