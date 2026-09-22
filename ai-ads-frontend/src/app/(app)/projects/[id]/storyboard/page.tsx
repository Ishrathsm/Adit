"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Download, Loader2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { consumePrefillForProject } from "@/lib/draft-prompt";
import {
  createStoryboard,
  getStoryboard,
  selectShotChoice,
  uploadStoryboardReferenceImage,
  STORYBOARD_ASPECT_RATIOS,
  STORYBOARD_SHOT_COUNTS,
  STORYBOARD_SHOT_DURATIONS,
  type ReferenceImageRole,
  type Storyboard,
  type StoryboardAspectRatio,
  type StoryboardShot,
  type StoryboardShotCount,
  type StoryboardShotDuration,
} from "@/lib/api";

const POLL_INTERVAL_MS = 4000;

// Reuses assets we already generated and paid for today — lets the whole flow be checked
// without spending any Imagen/Veo credits. Swap for the real API once verified.
const MOCK_IMAGE_URL =
  "https://cbjnnyfevxwktfmxdtqi.supabase.co/storage/v1/object/public/generated-media/9863e624-107d-4d32-80a7-4d748e7bed47.png";
const MOCK_VIDEO_URL =
  "https://cbjnnyfevxwktfmxdtqi.supabase.co/storage/v1/object/public/generated-media/8aa5874d-e00c-4336-8050-b1189f79522e.mp4";

// Tailwind needs static class names to pick them up — can't interpolate `grid-cols-${n}`.
const SHOT_GRID_COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

function mockShot(index: number, opts: { picked?: boolean; withVideo?: boolean } = {}): StoryboardShot {
  return {
    id: `mock-shot-${index}`,
    storyboard_id: "mock-storyboard",
    shot_index: index,
    description: `Shot ${index + 1}: a dynamic close-up of the product in action, cinematic lighting.`,
    choice_urls: [MOCK_IMAGE_URL, MOCK_IMAGE_URL],
    selected_choice: opts.picked || opts.withVideo ? 0 : null,
    video_url: opts.withVideo ? MOCK_VIDEO_URL : null,
    status: "choices_ready",
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mockStoryboard(status: Storyboard["status"], shotCount: number): Storyboard {
  return {
    id: "mock-storyboard",
    project_id: "mock",
    concept: "Preview storyboard — not a real generation",
    shot_count: shotCount,
    shot_duration_seconds: 4,
    aspect_ratio: "9:16",
    reference_image_url: null,
    reference_image_role: null,
    status,
    output_url: status === "completed" ? MOCK_VIDEO_URL : null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function pillClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
    active
      ? "border-transparent bg-button-bg text-button-fg"
      : "border-border-strong text-foreground hover:bg-white/5"
  }`;
}

export default function StoryboardPage() {
  const { id } = useParams<{ id: string }>();

  const [concept, setConcept] = useState("");
  const [aspectRatio, setAspectRatio] = useState<StoryboardAspectRatio>("9:16");
  const [shotDurationSeconds, setShotDurationSeconds] = useState<StoryboardShotDuration>(4);
  const [shotCount, setShotCount] = useState<StoryboardShotCount>(3);
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [referenceImageRole, setReferenceImageRole] = useState<ReferenceImageRole>("subject");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [shots, setShots] = useState<StoryboardShot[]>([]);

  const isMock = storyboard?.id === "mock-storyboard";

  useEffect(() => {
    // Reading a one-time hand-off from sessionStorage into state, not an external subscription.
    const prefill = consumePrefillForProject(id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (prefill) setConcept(prefill);
  }, [id]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isMock || !storyboard) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const settled = storyboard.status === "completed" || storyboard.status === "failed";
    const shotsSettled = shots.every((s) => s.status !== "pending");
    if (settled && shotsSettled) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(() => {
      getStoryboard(storyboard.id)
        .then(({ storyboard: updated, shots: updatedShots }) => {
          setStoryboard(updated);
          setShots(updatedShots);
        })
        .catch(() => {
          /* transient network errors during polling — next tick retries */
        });
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- polls on storyboard identity/status, not every shots mutation
  }, [storyboard, isMock]);

  async function handleCreate() {
    if (!concept.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      let referenceImageUrl: string | undefined;
      if (referenceImageFile) {
        const uploaded = await uploadStoryboardReferenceImage(referenceImageFile);
        referenceImageUrl = uploaded.referenceImageUrl;
      }
      const { storyboard, shots } = await createStoryboard(id, concept.trim(), {
        aspectRatio,
        shotCount,
        shotDurationSeconds,
        referenceImageUrl,
        referenceImageRole: referenceImageUrl ? referenceImageRole : undefined,
      });
      setStoryboard(storyboard);
      setShots(shots);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  function loadMock(kind: "choices" | "ready" | "completed") {
    if (kind === "choices") {
      setStoryboard(mockStoryboard("drafting", shotCount));
      setShots(Array.from({ length: shotCount }, (_, i) => mockShot(i)));
    } else if (kind === "ready") {
      setStoryboard(mockStoryboard("drafting", shotCount));
      setShots(Array.from({ length: shotCount }, (_, i) => mockShot(i, { picked: true })));
    } else {
      setStoryboard(mockStoryboard("completed", shotCount));
      setShots(Array.from({ length: shotCount }, (_, i) => mockShot(i, { withVideo: true })));
    }
  }

  async function handleSelect(shot: StoryboardShot, choiceIndex: number) {
    if (isMock) {
      setShots((prev) =>
        prev.map((s) => (s.id === shot.id ? { ...s, selected_choice: choiceIndex, video_url: null } : s)),
      );
      return;
    }
    try {
      const { shot: updated } = await selectShotChoice(storyboard!.id, shot.id, choiceIndex);
      setShots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {
      /* surfaced via the shot's own error state on next poll if it persists */
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10 sm:px-10">
      <BackLink href={`/projects/${id}`} label="Project" />

      <div className="mt-8 flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">Text → Storyboard → Video</p>
        <h1 className="text-2xl font-semibold tracking-tight">Storyboard</h1>
      </div>

      {!storyboard ? (
        <div className="mt-8 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rgb-border flex flex-col gap-3 p-5 sm:col-span-2">
              <label htmlFor="concept" className="text-sm font-medium">
                Describe the ad concept
              </label>
              <textarea
                id="concept"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                disabled={creating}
                rows={4}
                placeholder="A cold brew coffee brand's morning routine ad — from grinding beans to the first sip"
                className="resize-none rounded-2xl border border-border-subtle bg-background px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50"
              />
              <p className="text-xs text-muted">
                We&apos;ll split this into {shotCount} shots ({shotDurationSeconds}s each) and generate 2 visual
                choices per shot, one shot at a time as you pick.
              </p>
            </div>

            <div className="rgb-border flex flex-col gap-2 p-5">
              <label htmlFor="aspect-ratio" className="text-sm font-medium">
                Aspect ratio
              </label>
              <select
                id="aspect-ratio"
                value={aspectRatio}
                disabled={creating}
                onChange={(e) => setAspectRatio(e.target.value as StoryboardAspectRatio)}
                className="rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm outline-none focus:border-border-strong disabled:opacity-50"
              >
                {STORYBOARD_ASPECT_RATIOS.map((ratio) => (
                  <option key={ratio.value} value={ratio.value}>
                    {ratio.label} ({ratio.value})
                  </option>
                ))}
              </select>
            </div>

            <div className="rgb-border flex flex-col gap-2 p-5">
              <label className="text-sm font-medium">
                Reference image <span className="text-muted">(optional)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm text-muted transition-colors hover:border-border-strong">
                <Upload size={14} />
                <span className="truncate">{referenceImageFile?.name || "Upload an image"}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={creating}
                  className="hidden"
                  onChange={(e) => setReferenceImageFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {referenceImageFile && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReferenceImageRole("subject")}
                    className={pillClass(referenceImageRole === "subject")}
                  >
                    This is my product
                  </button>
                  <button
                    type="button"
                    onClick={() => setReferenceImageRole("style")}
                    className={pillClass(referenceImageRole === "style")}
                  >
                    Match this look
                  </button>
                </div>
              )}
            </div>

            <div className="rgb-border flex flex-col gap-2 p-5">
              <label className="text-sm font-medium">Shot duration</label>
              <div className="flex gap-2">
                {STORYBOARD_SHOT_DURATIONS.map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    disabled={creating}
                    onClick={() => setShotDurationSeconds(duration)}
                    className={pillClass(shotDurationSeconds === duration)}
                  >
                    {duration}s
                  </button>
                ))}
              </div>
            </div>

            <div className="rgb-border flex flex-col gap-2 p-5">
              <label className="text-sm font-medium">Number of shots</label>
              <div className="flex gap-2">
                {STORYBOARD_SHOT_COUNTS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    disabled={creating}
                    onClick={() => setShotCount(count)}
                    className={pillClass(shotCount === count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={handleCreate} disabled={creating || !concept.trim()} className="self-start">
            {creating ? (referenceImageFile ? "Uploading reference…" : "Breaking into shots…") : "Create Storyboard"}
          </Button>
          {createError && <p className="text-sm text-red-400">{createError}</p>}

          {process.env.NODE_ENV !== "production" && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border-strong p-3 text-xs text-muted">
              <span className="font-medium">Preview (no credits used):</span>
              <button
                onClick={() => loadMock("choices")}
                className="rounded-full border border-border-strong px-3 py-1 transition-colors hover:bg-white/5"
              >
                choices ready
              </button>
              <button
                onClick={() => loadMock("ready")}
                className="rounded-full border border-border-strong px-3 py-1 transition-colors hover:bg-white/5"
              >
                all picked
              </button>
              <button
                onClick={() => loadMock("completed")}
                className="rounded-full border border-border-strong px-3 py-1 transition-colors hover:bg-white/5"
              >
                completed
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          <div className={`grid grid-cols-1 gap-4 ${SHOT_GRID_COLS[shots.length] ?? "sm:grid-cols-2"}`}>
            {shots.map((shot, index) => {
              const previous = shots[index - 1];
              const waitingOnPrevious = index > 0 && previous && previous.selected_choice === null;
              const locked = shot.selected_choice !== null && shot.choice_urls;

              return (
                <div key={shot.id} className="rgb-border flex flex-col gap-3 p-4">
                  <p className="text-xs font-medium text-muted">
                    Shot {index + 1} of {shots.length}
                  </p>
                  <p className="line-clamp-3 text-sm text-muted">{shot.description}</p>

                  {shot.status === "pending" && (
                    <div className="flex items-center gap-2 py-6">
                      {waitingOnPrevious ? (
                        <p className="text-xs text-muted">Pick shot {index} first.</p>
                      ) : (
                        <>
                          <Loader2 size={16} className="animate-spin text-muted" />
                          <p className="text-xs text-muted">Generating choices…</p>
                        </>
                      )}
                    </div>
                  )}

                  {shot.status === "failed" && shot.selected_choice === null && (
                    <div className="flex items-start gap-2">
                      <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                      <p className="text-xs text-red-400">{shot.error}</p>
                    </div>
                  )}

                  {shot.choice_urls && shot.selected_choice === null && (
                    <div className="grid grid-cols-2 gap-2">
                      {shot.choice_urls.map((url, choiceIndex) => (
                        <button
                          key={choiceIndex}
                          onClick={() => handleSelect(shot, choiceIndex)}
                          className="relative overflow-hidden rounded-xl border-2 border-transparent transition-colors hover:border-border-strong"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated image */}
                          <img
                            src={url}
                            alt={`Choice ${choiceIndex + 1}`}
                            className="aspect-square w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {locked && (
                    <div className="relative overflow-hidden rounded-xl">
                      {shot.video_url ? (
                        <video src={shot.video_url} controls className="w-full rounded-xl" />
                      ) : (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated image */}
                          <img
                            src={shot.choice_urls![shot.selected_choice!]}
                            alt="Selected"
                            className="aspect-square w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60">
                            <Loader2 size={16} className="animate-spin" />
                            <p className="text-xs font-medium">Generating video…</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {process.env.NODE_ENV !== "production" && isMock && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border-strong p-3 text-xs text-muted">
              <span className="font-medium">Preview (no credits used):</span>
              <button
                onClick={() => loadMock("choices")}
                className="rounded-full border border-border-strong px-3 py-1 transition-colors hover:bg-white/5"
              >
                choices ready
              </button>
              <button
                onClick={() => loadMock("ready")}
                className="rounded-full border border-border-strong px-3 py-1 transition-colors hover:bg-white/5"
              >
                all picked
              </button>
              <button
                onClick={() => loadMock("completed")}
                className="rounded-full border border-border-strong px-3 py-1 transition-colors hover:bg-white/5"
              >
                completed
              </button>
            </div>
          )}

          {storyboard.status === "completed" && storyboard.output_url && (
            <div className="rgb-border flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <p className="text-sm font-medium">Final video ready</p>
              </div>
              <video src={storyboard.output_url} controls className="w-full rounded-xl" />
              <a
                href={`${storyboard.output_url}?download`}
                download
                className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-border-strong px-4 text-xs font-medium transition-colors hover:bg-white/5"
              >
                <Download size={12} />
                Download
              </a>
            </div>
          )}

          {storyboard.status === "failed" && (
            <div className="rgb-border flex items-start gap-3 p-5">
              <XCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
              <p className="text-sm text-red-400">{storyboard.error}</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
