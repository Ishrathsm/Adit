"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clapperboard,
  Download,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { consumePrefillForProject } from "@/lib/draft-prompt";
import {
  ASPECT_RATIOS,
  createJob,
  getJob,
  getLatestJobForProject,
  getProject,
  listTemplates,
  VIDEO_DURATIONS,
  type AspectRatio,
  type Job,
  type JobStatus,
  type Project,
  type Template,
  type VideoDuration,
} from "@/lib/api";

const POLL_INTERVAL_MS = 4000;

// Reuses a video we already generated and paid for — lets you check every UI state
// (queued/processing/completed/failed) without spending any Veo credits.
const PREVIEW_VIDEO_URL =
  "https://cbjnnyfevxwktfmxdtqi.supabase.co/storage/v1/object/public/generated-media/8aa5874d-e00c-4336-8050-b1189f79522e.mp4";

function mockJob(status: JobStatus): Job {
  return {
    id: `preview-${status}`,
    project_id: "preview",
    status,
    prompt: "Preview job — not a real generation",
    output_type: "video",
    aspect_ratio: "16:9",
    duration_seconds: 8,
    tagline: null,
    template_id: null,
    output_url: status === "completed" ? PREVIEW_VIDEO_URL : null,
    error: status === "failed" ? "Simulated failure for UI preview — not a real error." : null,
    reference_image_url: null,
    reference_image_role: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [durationSeconds, setDurationSeconds] = useState<VideoDuration>(8);
  const [tagline, setTagline] = useState("");

  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Defaults on: once a project has a result, regenerating is treated as "remixing" it (ground
  // the new generation on the existing output) unless the user opts out.
  const [referenceEnabled, setReferenceEnabled] = useState(true);

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
        if (job) setJob(job);
      })
      .catch(() => {
        /* no existing job is a normal state for a brand-new project — nothing to show */
      });
  }, [id]);

  useEffect(() => {
    // Reading a one-time hand-off from sessionStorage into state, not an external subscription.
    const prefill = consumePrefillForProject(id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (prefill) setPrompt(prefill);
  }, [id]);

  useEffect(() => {
    if (!project) return;
    listTemplates(project.type)
      .then(({ templates }) => setTemplates(templates))
      .catch(() => {
        /* templates are an optional enhancement — a load failure shouldn't block generation */
      });
  }, [project]);

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
      const { job: newJob } = await createJob(id, prompt.trim(), {
        ...(isPoster
          ? { aspectRatio, tagline: tagline.trim() || undefined }
          : { durationSeconds }),
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

  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10 sm:px-10">
      <BackLink href="/projects" label="Projects" />

      {loadError && (
        <p className="mt-6 rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm text-red-400">
          {loadError}
        </p>
      )}

      {project && (
        <>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">{project.name}</h1>

          {!isPoster && (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rgb-border flex flex-col gap-2 p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong">
                  <Sparkles size={14} />
                </div>
                <p className="text-sm font-medium">Text → Video</p>
                <p className="text-xs text-muted">One prompt, straight to a finished clip.</p>
              </div>
              <button
                onClick={() => router.push(`/projects/${id}/storyboard`)}
                className="rgb-border flex flex-col gap-2 p-4 text-left transition-opacity hover:opacity-90"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong">
                  <Clapperboard size={14} />
                </div>
                <p className="text-sm font-medium">Text → Storyboard → Video</p>
                <p className="text-xs text-muted">Pick a look per shot, then stitch the final cut.</p>
              </button>
              <div className="flex flex-col gap-2 rounded-[1.75rem] border border-border-subtle bg-surface p-4 opacity-50">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong">
                  <Sparkles size={14} />
                </div>
                <p className="text-sm font-medium">Motion Poster · Coming soon</p>
                <p className="text-xs text-muted">Upload a poster, animate it into a GIF.</p>
              </div>
            </div>
          )}

          <div className="rgb-border mt-8 grid divide-y divide-border-subtle md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="flex flex-col gap-4 p-5">
              {canUseReference && (
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border-subtle bg-background/50 p-3 transition-colors hover:bg-background/80">
                  <input
                    type="checkbox"
                    checked={referenceEnabled}
                    onChange={(e) => setReferenceEnabled(e.target.checked)}
                    disabled={busy}
                    className="h-4 w-4 shrink-0 accent-foreground"
                  />
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
                    {job?.output_type === "poster" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated thumbnail
                      <img src={job.output_url ?? undefined} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <video src={job?.output_url ?? undefined} className="h-full w-full object-cover" muted />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Wand2 size={12} className="shrink-0 text-muted" />
                      Remix current design
                    </p>
                    <p className="text-xs text-muted">Ground the next generation on what&apos;s already here</p>
                  </div>
                </label>
              )}

              {templates.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    Template <span className="text-muted">(optional)</span>
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setTemplateId(null)}
                      className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border text-center text-[11px] font-medium transition-colors disabled:opacity-50 ${
                        templateId === null
                          ? "border-transparent bg-button-bg text-button-fg"
                          : "border-border-strong text-muted hover:bg-white/5"
                      }`}
                    >
                      No template
                    </button>
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={busy}
                        onClick={() => setTemplateId(t.id)}
                        title={t.description ?? t.name}
                        className={`flex h-20 w-20 shrink-0 flex-col items-center gap-1 overflow-hidden rounded-2xl border p-1 transition-colors disabled:opacity-50 ${
                          templateId === t.id
                            ? "border-foreground"
                            : "border-border-strong hover:bg-white/5"
                        }`}
                      >
                        {t.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote curated template thumbnail
                          <img src={t.thumbnail_url} alt={t.name} className="h-12 w-full rounded-xl object-cover" />
                        ) : (
                          <div className="h-12 w-full rounded-xl bg-surface" />
                        )}
                        <span className="line-clamp-1 w-full text-[10px] text-foreground">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label htmlFor="prompt" className="text-sm font-medium">
                  Describe the ad
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={busy}
                  placeholder={
                    isPoster
                      ? "A refreshing bottle of cold brew on ice, condensation dripping, bright summer light"
                      : "A sleek smartphone rotating on a reflective podium, dramatic studio lighting, cinematic product ad style"
                  }
                  rows={4}
                  className="resize-none rounded-2xl border border-border-subtle bg-background px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50"
                />
              </div>

              {isPoster && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Aspect ratio</label>
                    <div className="flex flex-wrap gap-2">
                      {ASPECT_RATIOS.map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          disabled={busy}
                          onClick={() => setAspectRatio(ratio)}
                          className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                            aspectRatio === ratio
                              ? "border-transparent bg-button-bg text-button-fg"
                              : "border-border-strong text-foreground hover:bg-white/5"
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="tagline" className="text-sm font-medium">
                      Tagline <span className="text-muted">(optional)</span>
                    </label>
                    <input
                      id="tagline"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      disabled={busy}
                      placeholder="e.g. 50% off this weekend only"
                      className="rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50"
                    />
                  </div>
                </>
              )}

              {!isPoster && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {VIDEO_DURATIONS.map((seconds) => (
                      <button
                        key={seconds}
                        type="button"
                        disabled={busy}
                        onClick={() => setDurationSeconds(seconds)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                          durationSeconds === seconds
                            ? "border-transparent bg-button-bg text-button-fg"
                            : "border-border-strong text-foreground hover:bg-white/5"
                        }`}
                      >
                        {seconds}s
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted">8s is Veo&apos;s max for a single generation.</p>
                </div>
              )}

              <Button onClick={handleGenerate} disabled={busy || !prompt.trim()} className="self-start">
                {submitting ? "Starting…" : "Generate"}
              </Button>
              {submitError && <p className="text-sm text-red-400">{submitError}</p>}
            </div>

            <div className="flex flex-col gap-4 p-5">
              {process.env.NODE_ENV !== "production" && !isPoster && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border-strong p-3 text-xs text-muted">
                  <span className="font-medium">Preview (no credits used):</span>
                  {(["queued", "processing", "completed", "failed"] satisfies JobStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setJob(mockJob(status))}
                      className="rounded-full border border-border-strong px-3 py-1 transition-colors hover:bg-white/5"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}

              {job ? (
                <JobStatusCard job={job} />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-strong text-muted">
                    {isPoster ? <ImageIcon size={16} /> : <Sparkles size={16} />}
                  </div>
                  <p className="text-sm font-medium">Nothing generated yet</p>
                  <p className="text-xs text-muted">Your result will show up here once you hit Generate.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function JobStatusCard({ job }: { job: Job }) {
  if (job.status === "queued" || job.status === "processing") {
    const isPoster = job.output_type === "poster";
    return (
      <div className="flex items-center gap-3">
        <Loader2 size={18} className="animate-spin text-muted" />
        <div>
          <p className="text-sm font-medium">
            {job.status === "queued" ? "Queued" : isPoster ? "Generating your poster…" : "Generating your video…"}
          </p>
          <p className="text-xs text-muted">
            {isPoster
              ? "This usually takes a few seconds."
              : "This usually takes 1–3 minutes. Feel free to leave this page — it'll keep going."}
          </p>
        </div>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="flex items-start gap-3">
        <XCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
        <div>
          <p className="text-sm font-medium">Generation failed</p>
          <p className="mt-1 text-xs text-muted">{job.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} className="text-emerald-400" />
        <p className="text-sm font-medium">Done</p>
      </div>
      {job.output_url && job.output_type === "poster" && (
        // eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated image
        <img src={job.output_url} alt="Generated poster" className="w-full rounded-xl" />
      )}
      {job.output_url && job.output_type !== "poster" && (
        <video src={job.output_url} controls className="w-full rounded-xl" />
      )}
      {job.output_url && (
        <div className="flex gap-2">
          <a
            href={`${job.output_url}?download`}
            download
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-4 text-xs font-medium transition-colors hover:bg-white/5"
          >
            <Download size={12} />
            Download
          </a>
          {job.output_type === "poster" && (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(job.output_url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-4 text-xs font-medium transition-colors hover:bg-white/5"
            >
              Share to WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  );
}
