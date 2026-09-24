import "./lib/gcp-credentials-bootstrap";
import { Worker } from "bullmq";
import { type GenerationTask, enqueueShotChoices, enqueueShotVideo, enqueueStoryboardStitch, redisConnection } from "./lib/queue";
import { getJob, updateJobStatus } from "./lib/jobs";
import { generateVideo } from "./lib/veo";
import { findMarksInVideo, findSuddenEffects } from "./lib/video-check";
import { type CreativeBrief, directionText, planShots, TONE_FONT, TONE_GRADE, TRANSITION_SECONDS, VIDEO_ARTIFACT_NEGATIVES } from "./lib/creative-brief";
import { renderEndCard, renderSuper } from "./lib/end-card";
import { generateMusic } from "./lib/music";
import { synthesizeVoiceover } from "./lib/voiceover";
import sharp from "sharp";
import { pickBestKeyframe } from "./lib/keyframe-pick";
import { generateCleanImage } from "./lib/image-gen";
import { type BrandContext, refineImagePrompt, refineShotImagePrompt, refineShotVideoPrompt, refineVideoPrompt, splitNegativePrompt } from "./lib/prompt-refiner";
import { applyBrandOverlay } from "./lib/poster-overlay";
import { getProjectById } from "./lib/projects";
import { getProductById, type ProductRow, toBrandContext } from "./lib/products";
import { getTemplateById } from "./lib/templates";
import { ensureMediaBucket, uploadPoster, uploadVideo } from "./lib/storage";
import { extractLastFrame, stitchVideos } from "./lib/video-stitch";
import {
  getShot,
  getStoryboardById,
  listShots,
  selectShotChoice,
  SHOT_CHOICE_COUNT,
  updateShot,
  updateStoryboardStatus,
} from "./lib/storyboards";

if (!redisConnection) {
  console.error("[worker] UPSTASH_REDIS_URL not set — cannot start worker.");
  process.exit(1);
}

const DEFAULT_VIDEO_DURATION_SECONDS = 8;

async function getBrandContextForProject(projectId: string): Promise<BrandContext | undefined> {
  const project = await getProjectById(projectId);
  const product = project?.product_id ? await getProductById(project.product_id) : null;
  return toBrandContext(product);
}

async function processGenerationJob(jobId: string): Promise<void> {
  await updateJobStatus(jobId, { status: "processing" });

  const job = await getJob(jobId);
  if (!job) throw new Error(`job ${jobId} not found`);

  const project = await getProjectById(job.project_id);
  const product = project?.product_id ? await getProductById(project.product_id) : null;
  const brand = toBrandContext(product);
  const template = job.template_id ? await getTemplateById(job.template_id) : null;

  let referenceImage: { imageBytes: string; mimeType: string } | undefined;
  if (job.reference_image_url) {
    const referenceRes = await fetch(job.reference_image_url);
    if (!referenceRes.ok) throw new Error(`failed to fetch reference image: ${referenceRes.status}`);
    const imageBytes = Buffer.from(await referenceRes.arrayBuffer()).toString("base64");
    referenceImage = { imageBytes, mimeType: "image/png" };
  }

  let outputUrl: string;

  if (job.output_type === "poster") {
    const refinedPrompt = await refineImagePrompt(
      job.prompt,
      job.aspect_ratio,
      brand,
      template?.template_prompt,
      job.reference_image_role ?? undefined,
    );
    // A "subject" reference is the user's own product photo — its real branding is expected.
    const image = await generateCleanImage(
      refinedPrompt,
      job.aspect_ratio,
      referenceImage ? [referenceImage] : [],
      job.reference_image_role !== "subject",
    );
    const rawBuffer = Buffer.from(image.imageBytes, "base64");

    const finalBuffer = await applyBrandOverlay(rawBuffer, {
      logoUrl: product?.logo_url,
      primaryColor: product?.primary_color,
      tagline: job.tagline,
      font: product?.font,
    });

    outputUrl = await uploadPoster(jobId, finalBuffer);
  } else {
    const durationSeconds = job.duration_seconds || DEFAULT_VIDEO_DURATION_SECONDS;
    const refinedPrompt = await refineVideoPrompt(
      job.prompt,
      durationSeconds,
      job.aspect_ratio,
      brand,
      template?.template_prompt,
      job.reference_image_role ?? undefined,
    );
    const video = await generateVideo(refinedPrompt, {
      generateAudio: true,
      durationSeconds,
      aspectRatio: job.aspect_ratio,
      image: referenceImage,
    });
    const videoBuffer = Buffer.from(video.videoBytes, "base64");
    outputUrl = await uploadVideo(jobId, videoBuffer, video.mimeType);
  }

  await updateJobStatus(jobId, { status: "completed", output_url: outputUrl });
}

async function processShotChoices(shotId: string): Promise<void> {
  const shot = await getShot(shotId);
  if (!shot) throw new Error(`shot ${shotId} not found`);

  const storyboard = await getStoryboardById(shot.storyboard_id);
  if (!storyboard) throw new Error(`storyboard ${shot.storyboard_id} not found`);

  try {
    const brand = await getBrandContextForProject(storyboard.project_id);

    // Every shot grounds on the user's own reference image (if they gave one), and every shot
    // after the first also on the previous shot's chosen frame — together they keep the product
    // and the film's look consistent, rather than each shot drifting from text alone.
    const fetchImage = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`failed to fetch reference image: ${res.status}`);
      return { imageBytes: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType: "image/png" };
    };
    const referenceImages: { imageBytes: string; mimeType: string }[] = [];
    const userRole = storyboard.reference_image_url ? storyboard.reference_image_role ?? "subject" : undefined;
    if (storyboard.reference_image_url) referenceImages.push(await fetchImage(storyboard.reference_image_url));
    if (shot.shot_index > 0) {
      const siblingShots = await listShots(shot.storyboard_id);
      const previous = siblingShots.find((s) => s.shot_index === shot.shot_index - 1);
      if (previous?.selected_choice !== null && previous?.selected_choice !== undefined && previous.choice_urls) {
        referenceImages.push(await fetchImage(previous.choice_urls[previous.selected_choice]));
      }
    }
    // A previous frame means "keep this subject"; otherwise the user's chosen role applies.
    const referenceImageRole = shot.shot_index > 0 && referenceImages.length ? "subject" : userRole;

    const refinedPrompt = await refineShotImagePrompt(
      shot.description,
      storyboard.concept,
      shot.shot_index,
      storyboard.shot_count,
      storyboard.aspect_ratio,
      brand,
      referenceImageRole,
      storyboard.look_sheet,
      directionText(storyboard.creative_brief),
    );
    // Sequential, not parallel — bursting the image API is what trips its rate limit. The mark
    // check is skipped when the user's own product photo is a reference (real branding expected).
    const images = [];
    for (let i = 0; i < SHOT_CHOICE_COUNT; i++) {
      images.push(await generateCleanImage(refinedPrompt, storyboard.aspect_ratio, referenceImages, userRole !== "subject"));
    }
    const urls = await Promise.all(
      images.map((image, i) => uploadPoster(`${shotId}-choice-${i}`, Buffer.from(image.imageBytes, "base64"))),
    );
    await updateShot(shotId, { choice_urls: urls, status: "choices_ready" });

    // Auto-pick the best candidate and keep the film moving: the next shot's choices first (so
    // every keyframe is visible early), then this shot's video. The user can override any pick
    // through PATCH, which regenerates just that shot's video.
    const previousFrame = shot.shot_index > 0 ? referenceImages[referenceImages.length - 1] : undefined;
    const best = await pickBestKeyframe(images, shot.description, storyboard.look_sheet, previousFrame);
    await selectShotChoice(shotId, best);
    const next = (await listShots(shot.storyboard_id)).find((s) => s.shot_index === shot.shot_index + 1);
    if (next && next.status === "pending" && !next.choice_urls) await enqueueShotChoices(next.id);
    await enqueueShotVideo(shotId);
  } catch (err) {
    await updateShot(shotId, { status: "failed", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

async function processShotVideo(shotId: string): Promise<void> {
  const shot = await getShot(shotId);
  if (!shot) throw new Error(`shot ${shotId} not found`);
  if (shot.selected_choice === null || !shot.choice_urls) {
    throw new Error(`shot ${shotId} has no selected choice`);
  }

  const storyboard = await getStoryboardById(shot.storyboard_id);
  if (!storyboard) throw new Error(`storyboard ${shot.storyboard_id} not found`);

  try {
    const chosenImageUrl = shot.choice_urls[shot.selected_choice];
    const imageRes = await fetch(chosenImageUrl);
    if (!imageRes.ok) throw new Error(`failed to fetch chosen image: ${imageRes.status}`);
    const imageBytes = Buffer.from(await imageRes.arrayBuffer()).toString("base64");

    const brand = await getBrandContextForProject(storyboard.project_id);
    const refinedPrompt = await refineShotVideoPrompt(
      shot.description,
      storyboard.concept,
      shot.shot_index,
      storyboard.shot_count,
      storyboard.shot_duration_seconds,
      storyboard.aspect_ratio,
      brand,
      storyboard.look_sheet,
      directionText(storyboard.creative_brief),
    );
    const { prompt, negativePrompt: refinedNegative } = splitNegativePrompt(refinedPrompt);
    const brief = storyboard.creative_brief;
    const negativePrompt =
      [refinedNegative, brief?.avoid, brief?.look !== "surreal" ? VIDEO_ARTIFACT_NEGATIVES : null].filter(Boolean).join(", ") || undefined;

    const generate = () =>
      generateVideo(prompt, {
        // Silent footage: Veo's native audio ignored "no dialogue" and produced speech in testing.
        // Music (and voiceover, when requested) is laid over the whole edit instead.
        generateAudio: false,
        durationSeconds: storyboard.shot_duration_seconds,
        aspectRatio: storyboard.aspect_ratio,
        image: { imageBytes, mimeType: "image/png" },
        negativePrompt,
      });
    let video = await generate();
    let clip = Buffer.from(video.videoBytes, "base64");

    // One regeneration if Veo painted text/marks in, or added a sudden effect (smoke, flashes,
    // morphing) while animating — a Veo call is the expensive step, so no more than one retry.
    // The mark check is skipped when the user's own product photo is the reference (its real
    // branding would be flagged); the effects check is skipped for the surreal look.
    {
      const [marks, effects] = await Promise.all([
        storyboard.reference_image_role !== "subject" ? findMarksInVideo(clip) : Promise.resolve([]),
        brief?.look !== "surreal" ? findSuddenEffects(clip) : Promise.resolve([]),
      ]);
      const findings = [...marks, ...effects];
      if (findings.length) {
        console.warn(`[worker] shot ${shotId} video has problems, regenerating once:`, findings.join("; "));
        try {
          video = await generate();
          clip = Buffer.from(video.videoBytes, "base64");
        } catch (err) {
          console.warn(`[worker] shot ${shotId} regeneration failed, keeping first clip:`, err instanceof Error ? err.message : err);
        }
      }
    }

    const videoUrl = await uploadVideo(shotId, clip, video.mimeType);
    await updateShot(shotId, { video_url: videoUrl, status: "video_ready" });

    const siblingShots = await listShots(shot.storyboard_id);
    const allReady = siblingShots.every((s) => s.id === shotId || s.video_url);
    if (allReady) {
      await enqueueStoryboardStitch(shot.storyboard_id);
    }
  } catch (err) {
    await updateShot(shotId, { status: "failed", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// The finished cut for a briefed storyboard: dissolves at the pacing's length, the tone's grade,
// the user's on-screen text, a designed end card (brand name, logo, key message, contact line),
// and a soundtrack — Lyria music, plus the voiceover only when the brief asked for one. Music or
// voiceover failing degrades to a quieter ad rather than failing the whole storyboard.
async function editBriefedAd(clips: Buffer[], lastFrame: Buffer, brief: CreativeBrief, product: ProductRow | null): Promise<Buffer> {
  const font = product?.font || TONE_FONT[brief.tone];
  const { width = 720, height = 1280 } = await sharp(lastFrame).metadata();

  const [music, voiceover, endCard, supers] = await Promise.all([
    brief.audio?.musicPrompt
      ? generateMusic(brief.audio.musicPrompt).catch((err) => {
          console.warn("[worker] music generation failed, continuing without music:", err instanceof Error ? err.message : err);
          return undefined;
        })
      : undefined,
    brief.voiceover && brief.audio?.voiceoverScript
      ? synthesizeVoiceover(brief.audio.voiceoverScript, brief.voiceoverLanguage, brief.voiceGender, brief.tone).catch((err) => {
          console.warn("[worker] voiceover generation failed, continuing without voiceover:", err instanceof Error ? err.message : err);
          return undefined;
        })
      : undefined,
    renderEndCard(lastFrame, {
      brandName: brief.brandName ?? product?.name ?? null,
      keyMessage: brief.keyMessage ?? product?.tagline ?? null,
      contactLine: brief.contactLine,
      logoUrl: product?.logo_url ?? null,
      accentColor: product?.primary_color ?? null,
      font,
      uppercaseName: brief.tone === "bold",
    }),
    Promise.all(brief.onScreenText.map((line) => renderSuper(line, width, height, font, product?.primary_color ?? null))),
  ]);

  const plan = planShots(brief);
  return stitchVideos(clips, {
    endCard,
    cutSeconds: plan.cutSeconds,
    transitionSeconds: TRANSITION_SECONDS[brief.pacing],
    grade: TONE_GRADE[brief.tone],
    supers,
    music,
    voiceover,
  });
}

async function processStoryboardStitch(storyboardId: string): Promise<void> {
  try {
    const shots = await listShots(storyboardId);
    if (shots.some((shot) => !shot.video_url)) {
      throw new Error("not all shots have a generated video yet");
    }

    const clipBuffers = await Promise.all(
      shots.map(async (shot) => {
        const res = await fetch(shot.video_url!);
        if (!res.ok) throw new Error(`failed to fetch shot clip: ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      }),
    );

    const storyboard = await getStoryboardById(storyboardId);
    const project = storyboard ? await getProjectById(storyboard.project_id) : null;
    const product = project?.product_id ? await getProductById(project.product_id) : null;
    const brief = storyboard?.creative_brief ?? null;
    const lastFrame = await extractLastFrame(clipBuffers[clipBuffers.length - 1]);

    let finalBuffer: Buffer;
    if (brief) {
      finalBuffer = await editBriefedAd(clipBuffers, lastFrame, brief, product);
    } else {
      // Storyboards from before creative briefs: hard cuts, clips' own audio, poster-style card.
      const endLine = product?.tagline ?? null;
      const endCard = endLine || product?.logo_url
        ? await applyBrandOverlay(lastFrame, { logoUrl: product?.logo_url, primaryColor: product?.primary_color, tagline: endLine, font: product?.font })
        : undefined;
      finalBuffer = await stitchVideos(clipBuffers, { endCard });
    }
    const outputUrl = await uploadVideo(storyboardId, finalBuffer, "video/mp4");
    await updateStoryboardStatus(storyboardId, { status: "completed", output_url: outputUrl });
  } catch (err) {
    await updateStoryboardStatus(storyboardId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

const worker = new Worker(
  "generation",
  async (job) => {
    const task = job.data as GenerationTask;
    switch (task.kind) {
      case "job":
        try {
          await processGenerationJob(task.jobId);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await updateJobStatus(task.jobId, { status: "failed", error: message });
          throw err;
        }
        break;
      case "storyboard-shot-choices":
        await processShotChoices(task.shotId);
        break;
      case "storyboard-shot-video":
        await processShotVideo(task.shotId);
        break;
      case "storyboard-stitch":
        await processStoryboardStitch(task.storyboardId);
        break;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
    // Default drainDelay (5s) means BullMQ re-polls Redis every 5 seconds even when the
    // queue is empty — on Upstash's pay-per-request billing that idle polling alone burns
    // through the command quota in about a day. Generation jobs take many seconds to
    // minutes anyway, so a 60s poll interval costs nothing in real latency.
    drainDelay: 60,
  },
);

worker.on("completed", (job) => console.log(`[worker] job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));

ensureMediaBucket().catch((err) => console.error("[worker] failed to ensure media bucket:", err));

console.log("[worker] generation worker started, waiting for jobs...");
