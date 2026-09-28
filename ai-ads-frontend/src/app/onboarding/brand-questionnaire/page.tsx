"use client";

import { DictationButton } from "@/components/ui/dictation-button";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { completeQuestionnaire, getProduct, uploadLogo, type Product } from "@/lib/api";

export default function BrandQuestionnairePage() {
  return (
    <Suspense fallback={null}>
      <BrandQuestionnaireForm />
    </Suspense>
  );
}

function BrandQuestionnaireForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("product");

  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#6c5ce7");
  const [secondaryColor, setSecondaryColor] = useState("#00cec9");
  const [font, setFont] = useState("");
  const [tagline, setTagline] = useState("");
  const [brandRules, setBrandRules] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      router.replace("/onboarding/organisation");
      return;
    }
    getProduct(productId)
      .then(({ product }) => setProduct(product))
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, [productId, router]);

  async function handleSubmit() {
    if (!productId || !font.trim() || !brandRules.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        const result = await uploadLogo(productId, logoFile);
        logoUrl = result.logoUrl;
      }
      await completeQuestionnaire(productId, {
        logoUrl,
        primaryColor,
        secondaryColor,
        font: font.trim(),
        tagline: tagline.trim(),
        brandRules: brandRules.trim(),
      });
      router.push(`/projects?product=${productId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
        <p className="mt-6 rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm text-red-400">
          {loadError}
        </p>
      </main>
    );
  }

  if (!product) return null;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden"
      >
        <div
          className="h-[420px] w-[720px] opacity-15 blur-[110px] dark:opacity-30"
          style={{
            background:
              "radial-gradient(closest-side, rgba(99,140,255,0.55), rgba(198,99,255,0.35) 45%, rgba(255,99,170,0.2) 70%, transparent 80%)",
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/onboarding/organisation")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Products
        </button>
        <ThemeToggle />
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">
          Brand questionnaire
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        <p className="text-sm text-muted">
          One-time setup for this product&apos;s brand kit. Projects unlock once this is done.
        </p>
      </div>

      <div className="rgb-border mt-8 flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Logo</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm text-muted transition-colors hover:border-border-strong">
            <Upload size={14} />
            {logoFile?.name || "Upload a logo file"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="primary-color" className="text-sm font-medium">
              Primary color
            </label>
            <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-background px-3 py-2">
              <input
                id="primary-color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-6 w-6 shrink-0 cursor-pointer rounded-full border-0 bg-transparent"
              />
              <span className="text-sm text-muted">{primaryColor}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="secondary-color" className="text-sm font-medium">
              Secondary color
            </label>
            <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-background px-3 py-2">
              <input
                id="secondary-color"
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
          <label htmlFor="font" className="text-sm font-medium">
            Font
          </label>
          <input
            id="font"
            value={font}
            onChange={(e) => setFont(e.target.value)}
            placeholder="e.g. Inter, Poppins, Montserrat"
            className="rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-border-strong"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="tagline" className="text-sm font-medium">
            Tagline <span className="text-muted">(optional)</span>
          </label>
          <input
            id="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Taste the difference"
            className="rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-border-strong"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="brand-rules" className="text-sm font-medium">
            Brand rules
          </label>
          <div className="relative">
            <textarea
              id="brand-rules"
              value={brandRules}
              onChange={(e) => setBrandRules(e.target.value)}
              rows={4}
              placeholder="Tone of voice, dos and don'ts, colors/imagery to avoid…"
              className="w-full pr-12 resize-none rounded-2xl border border-border-subtle bg-background px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-border-strong"
            />
            <DictationButton value={brandRules} onChange={setBrandRules} className="absolute right-2 bottom-2" />
          </div>
        </div>

        {submitError && <p className="text-sm text-red-400">{submitError}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !font.trim() || !brandRules.trim()}
          >
            {submitting ? "Saving…" : "Complete & go to Projects"}
          </Button>
          {/* The kit is optional: ads fall back to the tone's font and no extra rules, and it can be
              finished later from the brand panel on the projects page. */}
          <button
            type="button"
            disabled={submitting || !productId}
            onClick={() => router.push(`/projects?product=${productId}`)}
            className="text-sm font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </main>
  );
}
