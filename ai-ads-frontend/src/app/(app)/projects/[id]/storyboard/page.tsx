"use client";

import { DictationButton } from "@/components/ui/dictation-button";
import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Download, Loader2, Play, Upload, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { InfoTip } from "@/components/ui/info-tip";
import { Accordion } from "@/components/ui/accordion";
import { consumePrefillForProject } from "@/lib/draft-prompt";
import {
  createStoryboard,
  getAccount,
  getLatestJobForProject,
  getLatestStoryboard,
  getStoryboard,
  listTemplates,
  regenerateStoryboardAsset,
  startStoryboard,
  selectShotChoice,
  uploadStoryboardReferenceImage,
  STORYBOARD_ASPECT_RATIOS,
  AD_LOOKS,
  AD_TONES,
  SINGLE_SHOT_SECONDS,
  footageSeconds,
  MAX_FOOTAGE_SECONDS,
  pacingForShotSeconds,
  SHOT_COUNTS,
  SHOT_SECONDS,
  type ShotSeconds,
  type AdFormat,
  type SingleShotSeconds,
  MAX_ON_SCREEN_LINES,
  VOICEOVER_LANGUAGES,
  maxVoiceoverWords,
  type VoiceGender,
  type VoiceoverLanguage,
  type AdLength,
  type AdLook,
  type AdTone,
  type AssetKind,
  type Features,
  type Job,
  type ReferenceImageRole,
  type StoryboardAsset,
  type Storyboard,
  type StoryboardAspectRatio,
  type StoryboardShot,
  type Template,
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
    asset_names: [],
    choice_urls: [MOCK_IMAGE_URL, MOCK_IMAGE_URL],
    selected_choice: opts.picked || opts.withVideo ? 0 : null,
    video_url: opts.withVideo ? MOCK_VIDEO_URL : null,
    status: "choices_ready",
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Rough make time, from real app runs (2026-09-25): script ~5 min, character references ~3 min,
// ~3.5 min per shot (2 keyframes, auto-pick, Veo clip, quality checks — one job at a time), and
// ~1.5 min for music, voiceover, and the edit. Shown as a range; quota retries can add more.
function estimateMakeMinutes(shots: number, castSheet: boolean, voiceover: boolean): { low: number; high: number } {
  const mid = 5 + (castSheet ? 3 : 0) + shots * 3.5 + 1.5 + (voiceover ? 0.5 : 0);
  const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
  return { low: round5(mid * 0.8), high: round5(mid * 1.3) };
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
    look_sheet: null,
    creative_brief: null,
    status,
    output_url: status === "completed" ? MOCK_VIDEO_URL : null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Provider errors arrive as raw JSON ("Veo generation failed: {"code":3,"message":"…"}") — show
// just the human-readable message.
function readableError(error: string | null): string {
  if (!error) return "unknown error";
  const message = error.match(/"message"\s*:\s*"([^"]+)"/)?.[1];
  return message ?? error;
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
  // Creative brief — the ad's treatment adapts to the brand instead of one house style.
  // ?mode=quick (the project page's Text -> Video) starts on the single-shot format.
  const searchParams = useSearchParams();
  const [format, setFormat] = useState<AdFormat>(searchParams.get("mode") === "quick" ? "single" : "ad");
  const [singleSeconds, setSingleSeconds] = useState<SingleShotSeconds>(8);
  // Multi-shot plan: N shots x S seconds (2 x 6s = 12s). Default stays under 20s, which every
  // plan allows; longer ads need the long_ads feature.
  const [plannedShots, setPlannedShots] = useState(3);
  const [shotSeconds, setShotSeconds] = useState<ShotSeconds>(6);
  const [tone, setTone] = useState<AdTone>("premium");
  const [look, setLook] = useState<AdLook>("photoreal");
  const pacing = pacingForShotSeconds(shotSeconds);
  const [audience, setAudience] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [mustShow, setMustShow] = useState("");
  const [avoid, setAvoid] = useState("");
  const [brandName, setBrandName] = useState("");
  const [contactLine, setContactLine] = useState("");
  const [onScreenText, setOnScreenText] = useState<string[]>(["", ""]);
  const [voiceover, setVoiceover] = useState(false);
  const [voiceoverLanguage, setVoiceoverLanguage] = useState<VoiceoverLanguage>("en");
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("female");
  const [voiceoverScript, setVoiceoverScript] = useState("");

  // ?template=<id>&length=15|30: a video template picked on the Projects page. The form starts
  // from its recipe (tone, look, shot plan, voice-over), and the director follows its notes.
  const [template, setTemplate] = useState<Template | null>(null);
  useEffect(() => {
    const templateId = searchParams.get("template");
    if (!templateId) return;
    const wantedLength = Number(searchParams.get("length"));
    listTemplates("video")
      .then(({ templates }) => {
        const picked = templates.find((t) => t.id === templateId);
        const recipe = picked?.recipe;
        if (!picked || !recipe) return;
        const plan = recipe.plans.find((p) => p.length === wantedLength) ?? recipe.plans[recipe.plans.length - 1];
        if (!recipe.singleSeconds && !plan) return;
        setTemplate(picked);
        if (recipe.singleSeconds) {
          setFormat("single");
          setSingleSeconds(recipe.singleSeconds);
        } else {
          setFormat("ad");
          setPlannedShots(plan.shotCount);
          setShotSeconds(plan.shotSeconds);
        }
        setTone(recipe.tone);
        setLook(recipe.look);
        setVoiceover(recipe.voiceover);
        if (picked.aspect_ratio === "16:9" || picked.aspect_ratio === "9:16") setAspectRatio(picked.aspect_ratio);
      })
      .catch(() => {});
  }, [searchParams]);
  const scriptWords = voiceoverScript.trim() ? voiceoverScript.trim().split(/\s+/).length : 0;
  const adSeconds = plannedShots * shotSeconds;
  // Older briefs' length field, sent for compatibility; the explicit plan overrides it.
  const lengthSeconds: AdLength = adSeconds > 20 ? 30 : adSeconds > 15 ? 20 : 15;
  const footage = footageSeconds({ format, singleSeconds, lengthSeconds, shotCount: plannedShots, shotSeconds });
  const maxScriptWords = maxVoiceoverWords(footage);
  const scriptTooLong = voiceover && scriptWords > maxScriptWords;
  const shotCount = format === "single" ? 1 : plannedShots;
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [referenceImageRole, setReferenceImageRole] = useState<ReferenceImageRole>("subject");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [shots, setShots] = useState<StoryboardShot[]>([]);
  const [assets, setAssets] = useState<StoryboardAsset[]>([]);

  // Feature switches (plan defaults + admin overrides) — locked options are shown disabled; the
  // server enforces the same switches. Null until loaded: treat everything as available meanwhile.
  const [features, setFeatures] = useState<Features | null>(null);
  useEffect(() => {
    getAccount()
      .then(({ features }) => setFeatures(features))
      .catch(() => setFeatures(null));
  }, []);
  const has = (key: keyof Features) => features?.[key] ?? true;
  // Opened in a format this account doesn't have (e.g. ?mode=quick without quick video) — switch.
  useEffect(() => {
    if (!features) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time correction once switches load
    if (format === "single" && !features.video_quick && features.video_ad) setFormat("ad");
    else if (format === "ad" && !features.video_ad && features.video_quick) setFormat("single");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the switches arrive
  }, [features]);

  // Reopening a video project resumes its latest ad; older projects made with the previous quick
  // Text -> Video flow show that video instead. ?mode=quick / fresh projects have neither.
  const [resuming, setResuming] = useState(true);
  const [legacyJob, setLegacyJob] = useState<Job | null>(null);
  useEffect(() => {
    getLatestStoryboard(id)
      .then(async ({ storyboard: latest, shots: latestShots, assets: latestAssets }) => {
        if (latest) {
          setStoryboard(latest);
          setShots(latestShots);
          setAssets(latestAssets);
          return;
        }
        const { job } = await getLatestJobForProject(id);
        if (job?.output_type === "video" && job.status === "completed" && job.output_url) setLegacyJob(job);
      })
      .catch(() => {
        /* nothing to resume — the form is shown */
      })
      .finally(() => setResuming(false));
  }, [id]);

  function startNewAd() {
    setStoryboard(null);
    setShots([]);
    setAssets([]);
    setLegacyJob(null);
  }

  // Reference assets + character sheet (future Pro features; not gated until tiers are decided).
  const [proAssets, setProAssets] = useState<{ file: File; previewUrl: string; kind: AssetKind; name: string; description: string }[]>([]);
  const [characterSheet, setCharacterSheet] = useState(false);
  // Swapping a keyframe re-renders that shot in Veo, so a thumbnail click only opens this preview;
  // the swap happens on an explicit confirm (a click to look at a frame used to re-render it).
  const [swapPreview, setSwapPreview] = useState<{ shot: StoryboardShot; choiceIndex: number } | null>(null);
  const makeTime = estimateMakeMinutes(shotCount, format === "ad" && characterSheet, voiceover);
  const makeTimeNote = (
    <div className="flex items-center gap-1 text-xs text-muted">
      <Clock size={12} />
      <span>
        Takes about {makeTime.low}–{makeTime.high} min to make
      </span>
      <InfoTip
        side="top"
        label="make time"
        text={`Estimate for ${shotCount} shot${shotCount === 1 ? "" : "s"}: writing the script (~5 min)${format === "ad" && characterSheet ? ", your cast references (~3 min, then waits for your approval)" : ""}, about 3–4 min per shot (keyframes, then animating), and ~2 min for ${voiceover ? "music, voiceover," : "music"} and the final edit. Busy times can take longer. You can leave this page — we'll keep working.`}
      />
    </div>
  );
  const [starting, setStarting] = useState(false);

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
        .then(({ storyboard: updated, shots: updatedShots, assets: updatedAssets }) => {
          setStoryboard(updated);
          setShots(updatedShots);
          setAssets(updatedAssets ?? []);
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

  async function handleStart() {
    if (!storyboard) return;
    setStarting(true);
    try {
      const { storyboard: updated } = await startStoryboard(storyboard.id);
      setStoryboard(updated);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  async function handleRegenerate(asset: StoryboardAsset) {
    if (!storyboard) return;
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, status: "pending" } : a)));
    await regenerateStoryboardAsset(storyboard.id, asset.id).catch((err) =>
      setCreateError(err instanceof Error ? err.message : String(err)),
    );
  }

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
      const uploadedAssets = await Promise.all(
        proAssets.map(async (asset) => ({
          kind: asset.kind,
          name: asset.name.trim(),
          description: asset.description.trim() || null,
          imageUrl: (await uploadStoryboardReferenceImage(asset.file)).referenceImageUrl,
        })),
      );
      const { storyboard, shots, assets: createdAssets } = await createStoryboard(id, concept.trim(), {
        aspectRatio,
        assets: uploadedAssets,
        characterSheet,
        brief: {
          format,
          singleSeconds,
          lengthSeconds,
          ...(format === "ad" ? { shotCount: plannedShots, shotSeconds } : {}),
          tone,
          look,
          pacing,
          audience: audience.trim() || null,
          keyMessage: keyMessage.trim() || null,
          mustShow: mustShow.trim() || null,
          avoid: avoid.trim() || null,
          brandName: brandName.trim() || null,
          contactLine: contactLine.trim() || null,
          onScreenText: onScreenText.map((line) => line.trim()).filter(Boolean),
          voiceover,
          voiceoverLanguage,
          voiceGender,
          voiceoverScript: voiceover ? voiceoverScript.trim() || null : null,
        },
        referenceImageUrl,
        referenceImageRole: referenceImageUrl ? referenceImageRole : undefined,
        templateId: template?.id,
      });
      setStoryboard(storyboard);
      setShots(shots);
      setAssets(createdAssets ?? []);
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
      <BackLink href="/projects" label="Projects" />

      <div className="mt-8 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">Video</p>
          <h1 className="text-2xl font-semibold tracking-tight">{storyboard ? "Your ad" : "New video ad"}</h1>
        </div>
        {storyboard && !isMock && (
          <Button onClick={startNewAd} variant="ghost" className="shrink-0">
            New ad
          </Button>
        )}
      </div>

      {resuming ? (
        <div className="mt-8 h-56 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      ) : !storyboard ? (
        <div className="mt-8 flex flex-col gap-4">
          {legacyJob?.output_url && (
            <div className="rgb-border flex flex-col gap-3 p-5">
              <p className="text-sm font-medium">Earlier quick video</p>
              <video src={legacyJob.output_url} controls className="max-h-80 w-full rounded-xl bg-black object-contain" />
            </div>
          )}
          <div className="rgb-border grid gap-x-8 gap-y-7 p-6 sm:grid-cols-2 sm:p-8">
            {template && (
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-button-bg py-1 pr-1 pl-3 text-xs font-medium text-button-fg">
                  <Play size={11} className="fill-current" /> Template: {template.name}
                  <button
                    type="button"
                    onClick={() => setTemplate(null)}
                    disabled={creating}
                    aria-label="Stop using this template"
                    className="rounded-full p-0.5 hover:bg-black/10"
                  >
                    <X size={12} />
                  </button>
                </span>
                <span className="text-xs text-muted">The settings below start from the template; change anything you like.</span>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:col-span-2">
              <label htmlFor="concept" className="text-sm font-medium">
                Describe the ad concept
              </label>
              <div className="relative">
                <textarea
                  id="concept"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  disabled={creating}
                  rows={4}
                  placeholder="A cold brew coffee brand's morning routine ad — from grinding beans to the first sip"
                  className="w-full pr-12 resize-none rounded-2xl border border-border-subtle bg-background px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50"
                />
                <DictationButton value={concept} onChange={setConcept} disabled={creating} className="absolute right-2 bottom-2" />
              </div>
              <p className="text-xs text-muted">
                {format === "single"
                  ? `We'll plan one continuous ${singleSeconds}s shot in the tone and look you choose below, generate 2 keyframes and auto-pick the best (you can swap it), animate it, and finish with a branded end card.`
                  : `We'll write a ${adSeconds}s, ${shotCount}-shot script in the tone and look you choose below, generate 2 keyframes per shot and auto-pick the best (you can swap any), animate each shot, and finish with a branded end card.`}
              </p>
            </div>

            <div className="flex flex-col gap-2">
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

            <div className="flex flex-col gap-2">
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

            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-sm font-medium">Format</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={creating || !has("video_ad")} onClick={() => setFormat("ad")} className={pillClass(format === "ad")}>
                  Full ad (multiple shots)
                </button>
                <button type="button" disabled={creating || !has("video_quick")} onClick={() => setFormat("single")} className={pillClass(format === "single")}>
                  Quick single shot
                </button>
              </div>
            </div>

            {format === "single" ? (
              <div className="flex flex-col gap-2 sm:col-span-2">
                <label className="text-sm font-medium">Shot length</label>
                <div className="flex flex-wrap gap-2">
                  {SINGLE_SHOT_SECONDS.map((seconds) => (
                    <button key={seconds} type="button" disabled={creating} onClick={() => setSingleSeconds(seconds)} className={pillClass(singleSeconds === seconds)}>
                      {seconds}s
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted">Plus a short branded end card.</p>
                {makeTimeNote}
              </div>
            ) : (
              <>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Shots</label>
                <div className="flex flex-wrap gap-2">
                  {SHOT_COUNTS.map((count) => {
                    const total = count * shotSeconds;
                    const blocked = total > MAX_FOOTAGE_SECONDS || (total > 20 && !has("long_ads"));
                    return (
                      <button key={count} type="button" disabled={creating || blocked} onClick={() => setPlannedShots(count)} className={pillClass(plannedShots === count)}>
                        {count}
                      </button>
                    );
                  })}
                </div>
                {makeTimeNote}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Seconds per shot</label>
                <div className="flex flex-wrap gap-2">
                  {SHOT_SECONDS.map((seconds) => {
                    const total = plannedShots * seconds;
                    const blocked = total > MAX_FOOTAGE_SECONDS || (total > 20 && !has("long_ads"));
                    return (
                      <button key={seconds} type="button" disabled={creating || blocked} onClick={() => setShotSeconds(seconds)} className={pillClass(shotSeconds === seconds)}>
                        {seconds}s
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted">
                  {plannedShots} &times; {shotSeconds}s = <span className="font-medium text-foreground">{adSeconds}s ad</span>, plus the end card
                  {!has("long_ads") ? " · up to 20s on your plan" : ""}
                </p>
              </div>
              </>
            )}

            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-sm font-medium">Tone</label>
              <div className="flex flex-wrap gap-2">
                {AD_TONES.map((option) => (
                  <button key={option.value} type="button" disabled={creating} onClick={() => setTone(option.value)} className={pillClass(tone === option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <label className="text-sm font-medium">Look</label>
              <div className="flex flex-wrap gap-2">
                {AD_LOOKS.map((option) => (
                  <button key={option.value} type="button" disabled={creating} onClick={() => setLook(option.value)} className={pillClass(look === option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">Photoreal keeps everything filmable-real. Effects only appear with Surreal.</p>
            </div>

            <div className="flex flex-col gap-3 sm:col-span-2">
              <label className="text-sm font-medium">Audio</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={creating} onClick={() => setVoiceover(false)} className={pillClass(!voiceover)}>
                  Music only
                </button>
                <button type="button" disabled={creating || !has("voiceover")} onClick={() => setVoiceover(true)} className={pillClass(voiceover)}>
                  Music + voiceover
                </button>
              </div>
              {voiceover && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {VOICEOVER_LANGUAGES.map((option) => (
                      <button key={option.value} type="button" disabled={creating} onClick={() => setVoiceoverLanguage(option.value)} className={pillClass(voiceoverLanguage === option.value)}>
                        {option.label}
                      </button>
                    ))}
                    <span className="mx-1 self-center text-muted">·</span>
                    {(["female", "male"] as const).map((gender) => (
                      <button key={gender} type="button" disabled={creating} onClick={() => setVoiceGender(gender)} className={pillClass(voiceGender === gender)}>
                        {gender === "female" ? "Female voice" : "Male voice"}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <textarea
                      value={voiceoverScript}
                      onChange={(e) => setVoiceoverScript(e.target.value)}
                      disabled={creating}
                      rows={3}
                      placeholder="Paste your voiceover script, or leave empty and we'll write one"
                      className="w-full pr-12 resize-none rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50"
                    />
                    <DictationButton value={voiceoverScript} onChange={setVoiceoverScript} disabled={creating} className="absolute right-2 bottom-2" />
                  </div>
                  <p className={`text-xs ${scriptTooLong ? "text-red-400" : "text-muted"}`}>
                    {scriptWords ? `${scriptWords} / ${maxScriptWords} words` : `Up to ${maxScriptWords} words fit ${Math.round(footage)}s of footage`}
                    {scriptTooLong && " — shorten it or pick a longer ad"}
                  </p>
                </div>
              )}
              <p className="text-xs text-muted">No one speaks on camera — music is composed for the ad, and narration is added only if you choose it.</p>
            </div>

            <Accordion optional title="On-screen text" defaultOpen={onScreenText.some((l) => l.trim())} className="sm:col-span-2">
              {onScreenText.map((line, index) => (
                <input
                  key={index}
                  value={line}
                  onChange={(e) => setOnScreenText((lines) => lines.map((l, i) => (i === index ? e.target.value : l)))}
                  disabled={creating}
                  maxLength={60}
                  placeholder={index === 0 ? "CBSE curriculum" : "Smart classrooms"}
                  className="rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50"
                />
              ))}
              {onScreenText.length < MAX_ON_SCREEN_LINES && (
                <button type="button" disabled={creating} onClick={() => setOnScreenText((lines) => [...lines, ""])} className="self-start text-xs text-muted underline-offset-2 hover:underline">
                  + Add a line
                </button>
              )}
              <p className="text-xs text-muted">Shown one line per shot, in order. This is the only text in the film besides the end card.</p>
            </Accordion>

            <Accordion optional title="End card" defaultOpen={Boolean(brandName || keyMessage || contactLine)} className="sm:col-span-2">
              {[
                { id: "brand-name", label: "Brand name (defaults to your brand kit)", value: brandName, set: setBrandName, placeholder: "Saraswati Vidyalaya" },
                { id: "key-message", label: "Key message", value: keyMessage, set: setKeyMessage, placeholder: "Admissions open for 2027" },
                { id: "contact-line", label: "Contact line", value: contactLine, set: setContactLine, placeholder: "Road No. 36, Jubilee Hills, Hyderabad · 040 1234 5678" },
              ].map((field) => (
                <div key={field.id} className="flex flex-col gap-1">
                  <label htmlFor={field.id} className="text-xs text-muted">{field.label}</label>
                  <input id={field.id} value={field.value} onChange={(e) => field.set(e.target.value)} disabled={creating} maxLength={300} placeholder={field.placeholder} className="rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50" />
                </div>
              ))}
              <p className="text-xs text-muted">The logo comes from the project&apos;s brand kit.</p>
            </Accordion>

            <Accordion optional title="Guidance" defaultOpen={Boolean(audience || mustShow || avoid)} className="sm:col-span-2">
              {[
                { id: "audience", label: "Audience", value: audience, set: setAudience, placeholder: "Parents of school-age kids in Hyderabad" },
                { id: "must-show", label: "Must show", value: mustShow, set: setMustShow, placeholder: "Our campus building, students in uniform" },
                { id: "avoid", label: "Avoid", value: avoid, set: setAvoid, placeholder: "No crowds, no night scenes, no phones" },
              ].map((field) => (
                <div key={field.id} className="flex flex-col gap-1">
                  <label htmlFor={field.id} className="text-xs text-muted">{field.label}</label>
                  <input id={field.id} value={field.value} onChange={(e) => field.set(e.target.value)} disabled={creating} maxLength={300} placeholder={field.placeholder} className="rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50" />
                </div>
              ))}
            </Accordion>

            <Accordion optional title="References & cast" badge={<span className="rounded-full border border-border-strong px-2 py-0.5 text-[10px] font-semibold tracking-wide">PRO</span>} defaultOpen={proAssets.length > 0 || characterSheet} className="sm:col-span-2">

              {proAssets.map((asset, index) => (
                <div key={index} className="flex flex-col gap-2 rounded-xl border border-border-subtle p-3 sm:flex-row sm:items-start">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file */}
                  <img src={asset.previewUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      {(["product", "character", "location"] as const).map((kind) => (
                        <button key={kind} type="button" disabled={creating} onClick={() => setProAssets((list) => list.map((a, i) => (i === index ? { ...a, kind } : a)))} className={pillClass(asset.kind === kind)}>
                          {kind === "product" ? "Product" : kind === "character" ? "Person" : "Location"}
                        </button>
                      ))}
                      <button type="button" disabled={creating} onClick={() => {
                          URL.revokeObjectURL(asset.previewUrl);
                          setProAssets((list) => list.filter((_, i) => i !== index));
                        }} className="ml-auto text-xs text-muted hover:text-red-400">
                        Remove
                      </button>
                    </div>
                    <input value={asset.name} onChange={(e) => setProAssets((list) => list.map((a, i) => (i === index ? { ...a, name: e.target.value } : a)))} disabled={creating} maxLength={60} placeholder="Name (e.g. Aqua bottle, Ms. Rao, Main campus)" className="rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50" />
                    <input value={asset.description} onChange={(e) => setProAssets((list) => list.map((a, i) => (i === index ? { ...a, description: e.target.value } : a)))} disabled={creating} maxLength={300} placeholder="Short description (optional)" className="rounded-xl border border-border-subtle bg-background px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-border-strong disabled:opacity-50" />
                  </div>
                </div>
              ))}
              {!has("reference_assets") && <p className="text-xs text-muted">Reference uploads aren&apos;t enabled on your account.</p>}
              {proAssets.length < 6 && has("reference_assets") && (
                <label className={`flex cursor-pointer items-center gap-2 self-start rounded-full border border-border-strong px-3 py-1.5 text-xs ${creating ? "pointer-events-none" : "hover:bg-white/5"}`}>
                  <Upload size={14} /> Upload a product, person, or location photo
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={creating}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setProAssets((list) => [...list, { file, previewUrl: URL.createObjectURL(file), kind: "product", name: "", description: "" }]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={characterSheet} disabled={creating || !has("character_sheet")} onChange={(e) => setCharacterSheet(e.target.checked)} />
                Generate a character sheet — review and approve the cast before any shot is made
              </label>
              <p className="text-xs text-muted">Your photos are used as references in every shot they appear in, so the real product, people, and places stay consistent.</p>
            </Accordion>
          </div>

          <Button
            onClick={handleCreate}
            disabled={creating || !concept.trim() || scriptTooLong || proAssets.some((a) => !a.name.trim())}
            className="self-start"
          >
            {creating ? (referenceImageFile ? "Uploading reference…" : "Writing the script…") : "Create Storyboard"}
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
          {storyboard.status === "casting" && (
            <div className="rgb-border flex flex-col gap-4 p-5">
              <div>
                <p className="text-sm font-medium">Review your cast</p>
                <p className="text-xs text-muted">Every shot will use these references. Regenerate anyone who doesn&apos;t look right, then start.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {assets.map((asset) => (
                  <div key={asset.id} className="flex flex-col gap-2">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-white/5">
                      {asset.image_url && asset.status !== "pending" && (
                        // eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated image
                        <img src={asset.image_url} alt={asset.name} className="h-full w-full object-cover" />
                      )}
                      {asset.status === "pending" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 size={16} className="animate-spin text-muted" />
                        </div>
                      )}
                      {asset.status === "failed" && <p className="p-2 text-xs text-red-400">{asset.error}</p>}
                    </div>
                    <p className="text-xs font-medium">
                      {asset.name} <span className="font-normal text-muted">· {asset.source === "uploaded" ? "your photo" : asset.kind}</span>
                    </p>
                    {asset.source === "generated" && (
                      <button type="button" disabled={asset.status === "pending"} onClick={() => handleRegenerate(asset)} className="self-start text-xs text-muted underline-offset-2 hover:underline disabled:opacity-50">
                        Regenerate
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button onClick={handleStart} disabled={starting || assets.some((a) => a.status !== "ready")} className="self-start">
                {starting ? "Starting…" : "Approve cast & start"}
              </Button>
            </div>
          )}

          {storyboard.status !== "casting" && assets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted">References:</p>
              {assets.map((asset) =>
                asset.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated image
                  <img key={asset.id} src={asset.image_url} alt={asset.name} title={asset.name} className="h-10 w-10 rounded-md object-cover" />
                ) : null,
              )}
            </div>
          )}

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
                      {storyboard.status === "casting" ? (
                        <p className="text-xs text-muted">Starts after you approve the cast.</p>
                      ) : waitingOnPrevious ? (
                        <p className="text-xs text-muted">Waiting for shot {index}…</p>
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

                  {locked && shot.choice_urls!.length > 1 && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted">Swap keyframe:</p>
                      {shot.choice_urls!.map((url, choiceIndex) =>
                        choiceIndex === shot.selected_choice ? null : (
                          <button
                            key={choiceIndex}
                            onClick={() => setSwapPreview({ shot, choiceIndex })}
                            // No swaps while this shot is still rendering — each one queues another Veo render.
                            disabled={!shot.video_url && shot.status !== "failed"}
                            title={!shot.video_url && shot.status !== "failed" ? "Available once this shot's video is ready" : "Preview this keyframe"}
                            className="overflow-hidden rounded-md border border-border-subtle transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated image */}
                            <img src={url} alt={`Alternative ${choiceIndex + 1}`} className="h-12 w-12 object-cover" />
                          </button>
                        ),
                      )}
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
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 p-3">
                            {shot.status === "failed" ? (
                              // A picked shot whose video failed — show why (swap the keyframe to retry).
                              <p className="flex w-full items-start gap-1.5 rounded-lg bg-background/80 p-2 text-left text-xs text-red-400">
                                <XCircle size={14} className="mt-0.5 shrink-0" />
                                <span className="line-clamp-4">Video failed: {readableError(shot.error)}</span>
                              </p>
                            ) : (
                              <>
                                <Loader2 size={16} className="animate-spin" />
                                <p className="text-xs font-medium">Generating video…</p>
                              </>
                            )}
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
      {swapPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => setSwapPreview(null)}>
          <div className="rgb-border flex w-full max-w-2xl flex-col gap-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-semibold">Use this keyframe for shot {swapPreview.shot.shot_index + 1}?</h2>
              <p className="text-sm text-muted">This re-renders the shot&rsquo;s video (about 3&ndash;4 min) and then the final ad.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Current", url: swapPreview.shot.choice_urls![swapPreview.shot.selected_choice!] },
                { label: "New", url: swapPreview.shot.choice_urls![swapPreview.choiceIndex] },
              ].map((frame) => (
                <div key={frame.label} className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted">{frame.label}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated image */}
                  <img src={frame.url} alt={`${frame.label} keyframe`} className="w-full rounded-xl object-cover" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSwapPreview(null)}>
                Keep current
              </Button>
              <Button
                onClick={() => {
                  const { shot, choiceIndex } = swapPreview;
                  setSwapPreview(null);
                  handleSelect(shot, choiceIndex);
                }}
              >
                Use this keyframe
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
