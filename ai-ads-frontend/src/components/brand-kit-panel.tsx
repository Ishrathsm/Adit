"use client";

import { useState } from "react";
import { ChevronDown, Palette, Upload } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { completeQuestionnaire, uploadLogo, type Product } from "@/lib/api";

// Shown at the top of a brand's own projects page — collapsed by default (logo, name, color
// swatches), expands in place into the full editable form instead of navigating to a
// separate page.
export function BrandKitPanel({
  product,
  onUpdate,
}: {
  product: Product;
  onUpdate: (product: Product) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(product.logo_url);
  const [primaryColor, setPrimaryColor] = useState(product.primary_color ?? "#6c5ce7");
  const [secondaryColor, setSecondaryColor] = useState(product.secondary_color ?? "#00cec9");
  const [font, setFont] = useState(product.font ?? "");
  const [tagline, setTagline] = useState(product.tagline ?? "");
  const [brandRules, setBrandRules] = useState(product.brand_rules ?? "");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    if (!font.trim() || !brandRules.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      let logoUrl = product.logo_url ?? undefined;
      if (logoFile) {
        const result = await uploadLogo(product.id, logoFile);
        logoUrl = result.logoUrl;
      }
      const { product: updated } = await completeQuestionnaire(product.id, {
        logoUrl,
        primaryColor,
        secondaryColor,
        font: font.trim(),
        tagline: tagline.trim(),
        brandRules: brandRules.trim(),
      });
      onUpdate(updated);
      setLogoFile(null);
      setExpanded(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rgb-border mt-4 flex flex-col">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-background">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote or freshly-picked logo preview
            <img src={logoPreview} alt="" className="h-full w-full object-contain" />
          ) : (
            <Palette size={14} className="text-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{product.name}</p>
          <p className="text-xs text-muted">{expanded ? "Editing brand kit" : "Brand kit — click to edit"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="h-4 w-4 rounded-full border border-border-subtle"
            style={{ backgroundColor: primaryColor }}
          />
          <span
            className="h-4 w-4 rounded-full border border-border-subtle"
            style={{ backgroundColor: secondaryColor }}
          />
        </div>
        <ChevronDown size={16} className={clsx("shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="grid gap-6 border-t border-border-subtle p-5 md:grid-cols-2">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Logo</label>
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm text-muted transition-colors hover:border-border-strong">
                <Upload size={14} />
                {logoFile?.name || "Upload a new logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setLogoFile(file);
                    if (file) setLogoPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor={`primary-color-${product.id}`} className="text-sm font-medium">
                  Primary color
                </label>
                <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-background px-3 py-2">
                  <input
                    id={`primary-color-${product.id}`}
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-6 w-6 shrink-0 cursor-pointer rounded-full border-0 bg-transparent"
                  />
                  <span className="text-sm text-muted">{primaryColor}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor={`secondary-color-${product.id}`} className="text-sm font-medium">
                  Secondary color
                </label>
                <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-background px-3 py-2">
                  <input
                    id={`secondary-color-${product.id}`}
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-6 w-6 shrink-0 cursor-pointer rounded-full border-0 bg-transparent"
                  />
                  <span className="text-sm text-muted">{secondaryColor}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor={`font-${product.id}`} className="text-sm font-medium">
                Font
              </label>
              <input
                id={`font-${product.id}`}
                value={font}
                onChange={(e) => setFont(e.target.value)}
                placeholder="e.g. Inter, Poppins, Montserrat"
                className="rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-border-strong"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor={`tagline-${product.id}`} className="text-sm font-medium">
                Tagline <span className="text-muted">(optional)</span>
              </label>
              <input
                id={`tagline-${product.id}`}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Taste the difference"
                className="rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-border-strong"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor={`brand-rules-${product.id}`} className="text-sm font-medium">
                Brand rules
              </label>
              <textarea
                id={`brand-rules-${product.id}`}
                value={brandRules}
                onChange={(e) => setBrandRules(e.target.value)}
                rows={8}
                placeholder="Tone of voice, dos and don'ts, colors/imagery to avoid…"
                className="min-h-[160px] flex-1 resize-none rounded-2xl border border-border-subtle bg-background px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-border-strong"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} disabled={saving || !font.trim() || !brandRules.trim()}>
                {saving ? "Saving…" : "Save brand kit"}
              </Button>
              <button
                onClick={() => setExpanded(false)}
                className="text-sm text-muted transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            {saveError && <p className="text-sm text-red-400">{saveError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
