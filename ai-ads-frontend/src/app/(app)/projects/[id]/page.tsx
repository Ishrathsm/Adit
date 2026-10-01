"use client";

import { DictationButton } from "@/components/ui/dictation-button";
import { Accordion } from "@/components/ui/accordion";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Upload,
  Download,
  Image as ImageIcon,
  Loader2,
  Wand2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { consumePrefillForProject } from "@/lib/draft-prompt";
import {
  AD_LOOKS,
  AD_TONES,
  ASPECT_RATIOS,
  MAX_POSTER_ASSETS,
  createJob,
  getAccount,
  uploadStoryboardReferenceImage,
  type AdLook,
  type AdTone,
  type PosterAssetKind,
  type Features,
  getJob,
  getLatestJobForProject,
  getProject,
  listTemplates,
  type AspectRatio,
  type Job,
  type Project,
  type Template,
} from "@/lib/api";

const POLL_INTERVAL_MS = 4000;

function chipClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
    active ? "border-transparent bg-button-bg text-button-fg" : "border-border-strong text-foreground hover:bg-white/5"
  }`;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  // Set by a template's Remix button: preselect that template for this poster.
  const remixTemplateId = useSearchParams().get("template");

  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  // Poster brief: structured copy + style + guidance + reference photos.
  const [headline, setHeadline] = useState("");
  const [subline, setSubline] = useState("");
  const [offer, setOffer] = useState("");
  const [cta, setCta] = useState("");
  const [contactLine, setContactLine] = useState("");
  const [featureList, setFeatureList] = useState<string[]>(["", "", "", ""]);
  const [tone, setTone] = useState<AdTone>("premium");
  const [look, setLook] = useState<AdLook>("photoreal");
  const [audience, setAudience] = useState("");
  const [mustShow, setMustShow] = useState("");
  const [avoid, setAvoid] = useState("");
  // Feature switches (plan defaults + admin overrides); null until loaded = treat as available.
  const [features, setFeatures] = useState<Features | null>(null);
  useEffect(() => {
    getAccount()
      .then(({ features }) => setFeatures(features))
      .catch(() => setFeatures(null));
  }, []);
  const has = (key: keyof Features) => features?.[key] ?? true;
  const [posterAssets, setPosterAssets] = useState<{ file: File; previewUrl: string; kind: PosterAssetKind; name: string }[]>([]);

  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Defaults on: once a project has a result, regenerating is treated as "remixing" it (ground
  // the new generation on the existing output) unless the user opts out.
  const [referenceEnabled, setReferenceEnabled] = useState(true);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  // A landing-page hand-off prompt wins over restoring the last brief.
  const handedOff = useRef(false);

  useEffect(() => {
    getProject(id)
      .then(({ project }) => setProject(project))
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, [id]);

  useEffect(() => {
    // Surfaces whatever was last generated for this project (if anything) instead of
    // always landing on a blank generate form for projects that already have a result.
    getLatestJobForProject(id)
      .then(({ job }) => {
        if (!job) return;
        setJob(job);
        // Reopen the poster's brief so editing means changing it, not retyping it. Uploaded
        // reference photos aren't restored (they're picked again as files).
        if (handedOff.current) return;
        const b = job.poster_brief;
        setPrompt((p) => p || job.prompt);
        if ((ASPECT_RATIOS as readonly string[]).includes(job.aspect_ratio)) setAspectRatio(job.aspect_ratio as AspectRatio);
        if (job.template_id) setTemplateId(job.template_id);
        if (b) {
          setHeadline(b.headline ?? "");
          setSubline(b.subline ?? "");
          setOffer(b.offer ?? "");
          setCta(b.cta ?? "");
          setContactLine(b.contactLine ?? "");
          setFeatureList([...(b.features ?? []), "", "", "", ""].slice(0, 4));
          if (b.tone) setTone(b.tone);
          if (b.look) setLook(b.look);
          setAudience(b.audience ?? "");
          setMustShow(b.mustShow ?? "");
          setAvoid(b.avoid ?? "");
        }
      })
      .catch(() => {
        /* no existing job is a normal state for a brand-new project — nothing to show */
      });
  }, [id]);

  useEffect(() => {
    if (!project) return;
    // Video is made on the storyboard page (quick single shot or full ad) — this page is the poster
    // editor only. Redirect before touching the landing-page hand-off, so the storyboard page is
    // the one that picks the prompt up.
    if (project.type !== "poster") {
      router.replace(`/projects/${id}/storyboard`);
      return;
    }
    // Reading a one-time hand-off from sessionStorage into state, not an external subscription.
    const prefill = consumePrefillForProject(id);
    if (prefill) {
      handedOff.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrompt(prefill);
    }
  }, [project, id, router]);

  useEffect(() => {
    if (!project) return;
    listTemplates(project.type)
      .then(({ templates }) => {
        setTemplates(templates);
        // Preselect the ratio this specific template was designed at — templates span every
        // ratio (landscape billboards, portrait posters, square posts), so there is no one
        // default to assume here.
        const remixTemplate = remixTemplateId ? templates.find((t) => t.id === remixTemplateId) : undefined;
        if (remixTemplate) {
          setTemplateId(remixTemplate.id);
          setAspectRatio(remixTemplate.aspect_ratio);
        }
      })
      .catch(() => {
        /* templates are an optional enhancement — a load failure shouldn't block generation */
      });
  }, [project, remixTemplateId]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(() => {
      getJob(job.id)
        .then(({ job: updated }) => setJob(updated))
        .catch(() => {
          /* transient network errors during polling — next tick retries */
        });
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job]);

  const isPoster = project?.type === "poster";
  const busy = submitting || (job !== null && job.status !== "completed" && job.status !== "failed");
  const canUseReference = job?.status === "completed" && Boolean(job.output_url);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    const referenceImageUrl = canUseReference && referenceEnabled ? (job?.output_url ?? undefined) : undefined;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const posterBrief = isPoster
        ? {
            headline: headline.trim() || null,
            subline: subline.trim() || null,
            offer: offer.trim() || null,
            cta: cta.trim() || null,
            contactLine: contactLine.trim() || null,
            features: featureList.map((f) => f.trim()).filter(Boolean),
            tone,
            look,
            audience: audience.trim() || null,
            mustShow: mustShow.trim() || null,
            avoid: avoid.trim() || null,
            assets: await Promise.all(
              posterAssets.map(async (asset) => ({
                kind: asset.kind,
                name: asset.name.trim(),
                imageUrl: (await uploadStoryboardReferenceImage(asset.file)).referenceImageUrl,
              })),
            ),
          }
        : undefined;
      const { job: newJob } = await createJob(id, prompt.trim(), {
        aspectRatio,
        posterBrief,
        templateId: templateId ?? undefined,
        ...(referenceImageUrl ? { referenceImageUrl, referenceImageRole: "subject" as const } : {}),
      });
      setJob(newJob);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const ratio = (job?.status === "completed" && job.aspect_ratio ? job.aspect_ratio : aspectRatio).split(":").map(Number) as [number, number];
  const resultUrl = job?.output_url && job.output_type === "poster" ? job.output_url : null;
  const generating = job !== null && (job.status === "queued" || job.status === "processing");
  const visibleTemplates = showAllTemplates ? templates : templates.slice(0, 5);
  // What's already set inside each closed optional section.
  const count = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? "" : "s"}` : null);
  const templateNote = templateId ? templates.find((t) => t.id === templateId)?.name ?? "1 selected" : null;
  const copyNote = count([headline, subline, offer, cta, contactLine].filter((v) => v.trim()).length, "line");
  const featureNote = count(featureList.filter((f) => f.trim()).length, "feature");
  const guidanceNote = count([audience, mustShow, avoid].filter((v) => v.trim()).length, "note");

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-4 py-6 sm:px-8 lg:py-8">
      <BackLink href="/projects" label="Projects" />

      {loadError && (
        <p className="mt-6 rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm text-red-400">
          {loadError}
        </p>
      )}

      {project && isPoster && (
        <div className="mt-4 grid items-start gap-6 lg:grid-cols-2">
          {/* Canvas (right on wide screens, first on phones): the poster at its real size ratio, pinned while the panel scrolls. */}
          <section className="flex flex-col gap-3 lg:order-2 lg:sticky lg:top-6 lg:h-[calc(100dvh-6rem)]">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight">{project.name}</h1>
              <StatusPill job={job} />
              {resultUrl && (
                <div className="ml-auto flex gap-2">
                  <a
                    href={`${resultUrl}?download`}
                    download
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-4 text-xs font-medium transition-colors hover:bg-white/5"
                  >
                    <Download size={12} />
                    Download
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(resultUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-4 text-xs font-medium transition-colors hover:bg-white/5"
                  >
                    Share to WhatsApp
                  </a>
                </div>
              )}
            </div>

            <div className="relative flex h-[62vh] min-h-0 items-center justify-center rounded-3xl border border-border-subtle bg-surface/60 p-4 sm:p-6 lg:h-auto lg:flex-1">
              {resultUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated poster
                <img
                  src={resultUrl}
                  alt="Generated poster"
                  className={`max-h-full max-w-full rounded-xl object-contain shadow-2xl transition-opacity ${generating ? "opacity-40" : ""}`}
                />
              ) : (
                <div className="relative flex h-full max-h-full max-w-full items-center justify-center">
                  <svg viewBox={`0 0 ${ratio[0] * 100} ${ratio[1] * 100}`} className="h-full max-h-full w-auto max-w-full" aria-hidden="true">
                    <rect x="1" y="1" width={ratio[0] * 100 - 2} height={ratio[1] * 100 - 2} rx="10" fill="none" stroke="currentColor" strokeDasharray="6 6" className="text-border-strong" />
                  </svg>
                  {!generating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                      <ImageIcon size={18} className="text-muted" />
                      <p className="text-sm font-medium">Your poster appears here</p>
                      <p className="text-xs text-muted">{aspectRatio} · describe it on the right and hit Generate</p>
                    </div>
                  )}
                </div>
              )}
              {generating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                  <Loader2 size={22} className="animate-spin" />
                  <p className="text-sm font-medium">{job?.status === "queued" ? "Queued" : resultUrl ? "Making a new version…" : "Generating your poster…"}</p>
                  <p className="text-xs text-muted">This usually takes a few seconds.</p>
                </div>
              )}
            </div>

            {job?.status === "failed" && (
              <p className="flex items-start gap-2 rounded-2xl border border-border-strong bg-surface px-4 py-3 text-xs text-red-400">
                <XCircle size={14} className="mt-0.5 shrink-0" />
                Generation failed{job.error ? `: ${job.error}` : ""}
              </p>
            )}

            {canUseReference && (
              <label className="flex cursor-pointer items-center gap-3 self-start rounded-full border border-border-subtle px-4 py-2 text-sm transition-colors hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={referenceEnabled}
                  onChange={(e) => setReferenceEnabled(e.target.checked)}
                  disabled={busy}
                  className="h-4 w-4 shrink-0 accent-foreground"
                />
                <Wand2 size={13} className="shrink-0 text-muted" />
                <span>Build on this design</span>
                <span className="hidden text-xs text-muted sm:inline">· the next version starts from this one</span>
              </label>
            )}
          </section>

          {/* Editing panel (left on wide screens): grouped settings, Generate always in reach at the bottom. */}
          <section className="rgb-border flex flex-col lg:order-1">
            <div className="flex flex-col gap-6 p-5">
              <PanelGroup title="Brief">
                <div className="relative">
                  <textarea
                    id="prompt"
                    aria-label="Describe the ad"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={busy}
                    placeholder="A refreshing bottle of cold brew on ice, condensation dripping, bright summer light"
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-border-subtle bg-background px-4 py-3 pr-12 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50"
                  />
                  <DictationButton value={prompt} onChange={setPrompt} disabled={busy} className="absolute right-2 bottom-2" />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-muted">Size</span>
                  <div className="flex flex-wrap gap-2">
                    {ASPECT_RATIOS.map((r) => (
                      <button key={r} type="button" disabled={busy} onClick={() => setAspectRatio(r)} className={chipClass(aspectRatio === r)}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </PanelGroup>

              <PanelGroup title="Style">
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-muted">Tone</span>
                  <div className="flex flex-wrap gap-2">
                    {AD_TONES.map((option) => (
                      <button key={option.value} type="button" disabled={busy} onClick={() => setTone(option.value)} className={chipClass(tone === option.value)}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-muted">Look</span>
                  <div className="flex flex-wrap gap-2">
                    {AD_LOOKS.map((option) => (
                      <button key={option.value} type="button" disabled={busy} onClick={() => setLook(option.value)} className={chipClass(look === option.value)}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </PanelGroup>

              {/* Everything optional in one place, closed until opened; a note says what's already set. */}
              <PanelGroup title="Optional" hint="Template, text on the poster, features, guidance and reference photos.">
                <div className="flex flex-col gap-4">
                  {templates.length > 0 && (
                    <Accordion title="Template" badge={templateNote ? <span className="text-xs text-muted">{templateNote}</span> : null}>
                      <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setTemplateId(null)}
                      className={`flex aspect-[4/5] items-center justify-center rounded-xl border text-center text-xs font-medium transition-colors disabled:opacity-50 ${
                        templateId === null ? "border-transparent bg-button-bg text-button-fg" : "border-border-strong text-muted hover:bg-white/5"
                      }`}
                    >
                      No template
                    </button>
                    {visibleTemplates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setTemplateId(t.id);
                          setAspectRatio(t.aspect_ratio);
                        }}
                        title={t.description ?? t.name}
                        className={`flex flex-col gap-1 overflow-hidden rounded-xl border p-1 text-left transition-colors disabled:opacity-50 ${
                          templateId === t.id ? "border-foreground" : "border-border-subtle hover:bg-white/5"
                        }`}
                      >
                        {t.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote curated template thumbnail
                          <img src={t.thumbnail_url} alt="" className="aspect-[4/5] w-full rounded-lg bg-surface object-contain" />
                        ) : (
                          <div className="aspect-[4/5] w-full rounded-lg bg-surface" />
                        )}
                        <span className="line-clamp-1 px-0.5 text-[11px]">{t.name}</span>
                      </button>
                    ))}
                  </div>
                  {templates.length > 5 && (
                    <button type="button" onClick={() => setShowAllTemplates((v) => !v)} className="self-start text-xs text-muted underline-offset-4 hover:text-foreground hover:underline">
                      {showAllTemplates ? "Show fewer" : `Show all ${templates.length} templates`}
                    </button>
                  )}
                    </Accordion>
                  )}
                  <Accordion title="Text on the poster" badge={copyNote ? <span className="text-xs text-muted">{copyNote}</span> : null}>
                    <p className="text-xs text-muted">Typeset exactly as written; the image itself never contains text.</p>
                    <input value={headline} onChange={(e) => setHeadline(e.target.value)} disabled={busy} maxLength={60} placeholder="Headline, e.g. Run further" className={INPUT} />
                <input value={subline} onChange={(e) => setSubline(e.target.value)} disabled={busy} maxLength={120} placeholder="Supporting line, e.g. The lightest runner we've made" className={INPUT} />
                <div className="grid grid-cols-2 gap-2">
                  <input value={offer} onChange={(e) => setOffer(e.target.value)} disabled={busy} maxLength={24} placeholder="Offer badge, e.g. 30% off" className={INPUT} />
                  <input value={cta} onChange={(e) => setCta(e.target.value)} disabled={busy} maxLength={28} placeholder="Button, e.g. Shop now" className={INPUT} />
                </div>
                <input value={contactLine} onChange={(e) => setContactLine(e.target.value)} disabled={busy} maxLength={120} placeholder="Contact line: address, phone, website" className={INPUT} />
                  </Accordion>
                  <Accordion title="Feature list" badge={featureNote ? <span className="text-xs text-muted">{featureNote}</span> : null}>
                  {featureList.map((value, i) => (
                    <input
                      key={i}
                      value={value}
                      onChange={(e) => setFeatureList((list) => list.map((f, j) => (j === i ? e.target.value : f)))}
                      disabled={busy}
                      maxLength={70}
                      placeholder={i === 0 ? "e.g. Test Prep: SAT, ACT and AP" : `Feature ${i + 1}`}
                      className={INPUT}
                    />
                  ))}
                  <p className="text-xs text-muted">Shown as bullets under the headline. Write &ldquo;Label: detail&rdquo; to set the label in bold.</p>
                </Accordion>
                  <Accordion title="Guidance" badge={guidanceNote ? <span className="text-xs text-muted">{guidanceNote}</span> : null}>
                  {[
                    { id: "audience", value: audience, set: setAudience, placeholder: "Audience, e.g. Parents of school-age kids in Hyderabad" },
                    { id: "must-show", value: mustShow, set: setMustShow, placeholder: "Must show, e.g. our campus, students in uniform" },
                    { id: "avoid", value: avoid, set: setAvoid, placeholder: "Avoid, e.g. no crowds, no night scenes" },
                  ].map((field) => (
                    <input key={field.id} value={field.value} onChange={(e) => field.set(e.target.value)} disabled={busy} maxLength={300} placeholder={field.placeholder} className={INPUT} />
                  ))}
                </Accordion>
                  <Accordion
                  title="Reference photos"
                  badge={<span className="rounded-full border border-border-strong px-2 py-0.5 text-[10px] font-semibold tracking-wide">PRO</span>}
                >
                  {posterAssets.map((asset, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file */}
                      <img src={asset.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      <select
                        value={asset.kind}
                        onChange={(e) => setPosterAssets((list) => list.map((a, i) => (i === index ? { ...a, kind: e.target.value as PosterAssetKind } : a)))}
                        disabled={busy}
                        className="rounded-full border border-border-subtle bg-background px-3 py-2 text-xs outline-none"
                      >
                        <option value="product">Product</option>
                        <option value="character">Person</option>
                        <option value="location">Location</option>
                        <option value="logo">Logo</option>
                      </select>
                      <input
                        value={asset.name}
                        onChange={(e) => setPosterAssets((list) => list.map((a, i) => (i === index ? { ...a, name: e.target.value } : a)))}
                        disabled={busy}
                        maxLength={60}
                        placeholder="Name"
                        className={`min-w-0 flex-1 ${INPUT}`}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          URL.revokeObjectURL(asset.previewUrl);
                          setPosterAssets((list) => list.filter((_, i) => i !== index));
                        }}
                        className="text-xs text-muted hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {!has("reference_assets") && <p className="text-xs text-muted">Reference uploads aren&apos;t enabled on your account.</p>}
                  {posterAssets.length < MAX_POSTER_ASSETS && has("reference_assets") && (
                    <label className={`flex cursor-pointer items-center gap-2 self-start rounded-full border border-border-strong px-3 py-1.5 text-xs ${busy ? "pointer-events-none opacity-50" : "hover:bg-white/5"}`}>
                      <Upload size={14} /> Upload a product, person, location, or logo
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setPosterAssets((list) => [...list, { file, previewUrl: URL.createObjectURL(file), kind: "product", name: "" }]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </Accordion>
                </div>
              </PanelGroup>
            </div>

            <div className="sticky bottom-0 flex flex-col gap-2 rounded-b-[inherit] border-t border-border-subtle bg-background/90 p-4 backdrop-blur">
              {!has("poster") && <p className="text-xs text-muted">Posters aren&apos;t enabled on your account.</p>}
              {submitError && <p className="text-xs text-red-400">{submitError}</p>}
              <Button onClick={handleGenerate} disabled={busy || !has("poster") || !prompt.trim() || posterAssets.some((a) => !a.name.trim())} className="w-full">
                {submitting ? "Starting…" : generating ? "Generating…" : resultUrl ? "Generate new version" : "Generate"}
              </Button>
              {!prompt.trim() && <p className="text-center text-xs text-muted">Describe the ad to generate.</p>}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const INPUT =
  "rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50";

function PanelGroup({ title, optional, hint, children }: { title: string; optional?: boolean; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {title}
          {optional && <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted">Optional</span>}
        </h2>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function StatusPill({ job }: { job: Job | null }) {
  if (!job) return null;
  if (job.status === "queued" || job.status === "processing")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-2.5 py-1 text-xs text-muted">
        <Loader2 size={12} className="animate-spin" /> {job.status === "queued" ? "Queued" : "Generating"}
      </span>
    );
  if (job.status === "failed")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-2.5 py-1 text-xs text-red-400">
        <XCircle size={12} /> Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-2.5 py-1 text-xs text-muted">
      <CheckCircle2 size={12} className="text-emerald-400" /> Done
    </span>
  );
}
