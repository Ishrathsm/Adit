"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Download, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  createStoryboard,
  generateStoryboardVideo,
  getStoryboard,
  selectShotChoice,
  type Storyboard,
  type StoryboardShot,
} from "@/lib/api";

const POLL_INTERVAL_MS = 4000;

// Reuses assets we already generated and paid for today — lets the whole stepper flow be
// checked without spending any Imagen/Veo credits. Swap for the real API once verified.
const MOCK_IMAGE_URL =
  "https://cbjnnyfevxwktfmxdtqi.supabase.co/storage/v1/object/public/generated-media/9863e624-107d-4d32-80a7-4d748e7bed47.png";
const MOCK_VIDEO_URL =
  "https://cbjnnyfevxwktfmxdtqi.supabase.co/storage/v1/object/public/generated-media/8aa5874d-e00c-4336-8050-b1189f79522e.mp4";

function mockShot(index: number, opts: { picked?: boolean; withVideo?: boolean } = {}): StoryboardShot {
  return {
    id: `mock-shot-${index}`,
    storyboard_id: "mock-storyboard",
    shot_index: index,
    description: `Shot ${index + 1}: a dynamic close-up of the product in action, cinematic lighting.`,
    choice_urls: [MOCK_IMAGE_URL, MOCK_IMAGE_URL, MOCK_IMAGE_URL],
    selected_choice: opts.picked || opts.withVideo ? 0 : null,
    video_url: opts.withVideo ? MOCK_VIDEO_URL : null,
    status: "choices_ready",
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function mockStoryboard(status: Storyboard["status"]): Storyboard {
  return {
    id: "mock-storyboard",
    project_id: "mock",
    concept: "Preview storyboard — not a real generation",
    shot_count: 4,
    shot_duration_seconds: 5,
    status,
    output_url: status === "completed" ? MOCK_VIDEO_URL : null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export default function StoryboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [concept, setConcept] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [shots, setShots] = useState<StoryboardShot[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generating, setGenerating] = useState(false);

  const isMock = storyboard?.id === "mock-storyboard";

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
      const { storyboard, shots } = await createStoryboard(id, concept.trim());
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
      setStoryboard(mockStoryboard("drafting"));
      setShots([0, 1, 2, 3].map((i) => mockShot(i)));
    } else if (kind === "ready") {
      setStoryboard(mockStoryboard("drafting"));
      setShots([0, 1, 2, 3].map((i) => mockShot(i, { picked: true })));
    } else {
      setStoryboard(mockStoryboard("completed"));
      setShots([0, 1, 2, 3].map((i) => mockShot(i, { withVideo: true })));
    }
    setCurrentIndex(0);
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

  async function handleGenerateFinal() {
    if (!storyboard) return;
    setGenerating(true);
    try {
      if (isMock) {
        setStoryboard((prev) => (prev ? { ...prev, status: "generating_video" } : prev));
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setShots((prev) => prev.map((s) => ({ ...s, video_url: MOCK_VIDEO_URL, status: "video_ready" })));
        setStoryboard((prev) => (prev ? { ...prev, status: "completed", output_url: MOCK_VIDEO_URL } : prev));
      } else {
        const { storyboard: updated } = await generateStoryboardVideo(storyboard.id);
        setStoryboard(updated);
      }
    } finally {
      setGenerating(false);
    }
  }

  const allPicked = shots.length > 0 && shots.every((s) => s.selected_choice !== null);
  const needsGeneration = shots.some((s) => !s.video_url);
  const currentShot = shots[currentIndex];

  return (
    <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/projects/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <ThemeToggle />
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">Text → Storyboard → Video</p>
        <h1 className="text-2xl font-semibold tracking-tight">Storyboard</h1>
      </div>

      {!storyboard ? (
        <div className="mt-8 flex flex-col gap-4">
          <div className="rgb-border flex flex-col gap-3 p-5">
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
              We&apos;ll split this into 4 shots (5s each) and generate 3 visual choices per shot.
            </p>
            <Button onClick={handleCreate} disabled={creating || !concept.trim()} className="self-start">
              {creating ? "Breaking into shots…" : "Create Storyboard"}
            </Button>
            {createError && <p className="text-sm text-red-400">{createError}</p>}
          </div>

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
          <div className="flex items-center justify-center gap-2">
            {shots.map((shot, i) => (
              <button
                key={shot.id}
                onClick={() => setCurrentIndex(i)}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i === currentIndex
                    ? "bg-foreground"
                    : shot.selected_choice !== null
                      ? "bg-emerald-400"
                      : "bg-border-strong"
                }`}
                aria-label={`Shot ${i + 1}`}
              />
            ))}
          </div>

          {currentShot && (
            <div className="rgb-border flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Shot {currentIndex + 1} of {shots.length}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    disabled={currentIndex === 0}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-strong disabled:opacity-30"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setCurrentIndex((i) => Math.min(shots.length - 1, i + 1))}
                    disabled={currentIndex === shots.length - 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-strong disabled:opacity-30"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <p className="text-sm text-muted">{currentShot.description}</p>

              {currentShot.status === "pending" && (
                <div className="flex items-center gap-3 py-8">
                  <Loader2 size={18} className="animate-spin text-muted" />
                  <p className="text-sm text-muted">Generating 3 choices for this shot…</p>
                </div>
              )}

              {currentShot.status === "failed" && (
                <div className="flex items-start gap-3">
                  <XCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
                  <p className="text-sm text-red-400">{currentShot.error}</p>
                </div>
              )}

              {currentShot.choice_urls && (
                <div className="grid grid-cols-3 gap-3">
                  {currentShot.choice_urls.map((url, choiceIndex) => (
                    <button
                      key={choiceIndex}
                      onClick={() => handleSelect(currentShot, choiceIndex)}
                      className={`relative overflow-hidden rounded-2xl border-2 transition-colors ${
                        currentShot.selected_choice === choiceIndex
                          ? "border-emerald-400"
                          : "border-transparent hover:border-border-strong"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated image */}
                      <img src={url} alt={`Choice ${choiceIndex + 1}`} className="aspect-square w-full object-cover" />
                      {currentShot.selected_choice === choiceIndex && (
                        <div className="absolute right-1.5 top-1.5 rounded-full bg-emerald-400 p-0.5">
                          <CheckCircle2 size={14} className="text-background" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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

          {(needsGeneration || storyboard.status === "generating_video") && (
            <Button onClick={handleGenerateFinal} disabled={!allPicked || generating} className="self-center">
              {storyboard.status === "generating_video"
                ? "Generating final video…"
                : storyboard.output_url
                  ? "Regenerate video"
                  : "Generate Final Video"}
            </Button>
          )}

          {storyboard.status === "completed" && storyboard.output_url && !needsGeneration && (
            <div className="rgb-border flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <p className="text-sm font-medium">Final video ready</p>
              </div>
              <video src={storyboard.output_url} controls className="w-full rounded-xl" />
              <a
                href={storyboard.output_url}
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
