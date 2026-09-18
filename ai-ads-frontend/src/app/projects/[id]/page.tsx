"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clapperboard, Download, Loader2, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ASPECT_RATIOS,
  createJob,
  getJob,
  getProject,
  listTemplates,
  type AspectRatio,
  type Job,
  type JobStatus,
  type Project,
  type Template,
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
    tagline: null,
    template_id: null,
    output_url: status === "completed" ? PREVIEW_VIDEO_URL : null,
    error: status === "failed" ? "Simulated failure for UI preview — not a real error." : null,
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
  const [tagline, setTagline] = useState("");

  const [job, setJob] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getProject(id)
      .then(({ project }) => setProject(project))
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
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

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { job } = await createJob(id, prompt.trim(), {
        ...(isPoster ? { aspectRatio, tagline: tagline.trim() || undefined } : {}),
        templateId: templateId ?? undefined,
      });
      setJob(job);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/projects")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Projects
        </button>
        <ThemeToggle />
      </div>

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

          <div className="mt-8 flex flex-col gap-6">
            <div className="rgb-border flex flex-col gap-4 p-5">
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

              <Button onClick={handleGenerate} disabled={busy || !prompt.trim()} className="self-start">
                {submitting ? "Starting…" : "Generate"}
              </Button>
              {submitError && <p className="text-sm text-red-400">{submitError}</p>}
            </div>

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

            {job && <JobStatusCard job={job} />}
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
      <div className="rgb-border flex items-center gap-3 p-5">
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
      <div className="rgb-border flex items-start gap-3 p-5">
        <XCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
        <div>
          <p className="text-sm font-medium">Generation failed</p>
          <p className="mt-1 text-xs text-muted">{job.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rgb-border flex flex-col gap-3 p-5">
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
            href={job.output_url}
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
