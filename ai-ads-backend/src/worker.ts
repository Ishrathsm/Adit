import "./lib/gcp-credentials-bootstrap";
import { Worker } from "bullmq";
import { type GenerationTask, enqueueStoryboardStitch, redisConnection } from "./lib/queue";
import { getJob, updateJobStatus } from "./lib/jobs";
import { generateVideo } from "./lib/veo";
import { generateImage } from "./lib/image-gen";
import { type BrandContext, refineImagePrompt, refineShotImagePrompt, refineShotVideoPrompt, refineVideoPrompt } from "./lib/prompt-refiner";
import { applyBrandOverlay } from "./lib/poster-overlay";
import { getProjectById } from "./lib/projects";
import { getProductById, type ProductRow } from "./lib/products";
import { getTemplateById } from "./lib/templates";
import { ensureMediaBucket, uploadPoster, uploadVideo } from "./lib/storage";
import { stitchVideos } from "./lib/video-stitch";
import {
  getShot,
  getStoryboardById,
  listShots,
  SHOT_CHOICE_COUNT,
  updateShot,
  updateStoryboardStatus,
} from "./lib/storyboards";

if (!redisConnection) {
  console.error("[worker] UPSTASH_REDIS_URL not set — cannot start worker.");
  process.exit(1);
}

const DEFAULT_VIDEO_DURATION_SECONDS = 8;

function toBrandContext(product: ProductRow | null): BrandContext | undefined {
  if (!product) return undefined;
  return {
    productName: product.name,
    primaryColor: product.primary_color,
    secondaryColor: product.secondary_color,
    font: product.font,
    tagline: product.tagline,
    brandRules: product.brand_rules,
  };
}

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
    const image = await generateImage(refinedPrompt, job.aspect_ratio, referenceImage);
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

    // Shot 0 grounds on the user's own reference image (if they gave one); every shot after
    // that grounds on the previous shot's chosen image instead (image-to-image) so the
    // subject/product/style stay visually consistent across the storyboard, rather than each
    // shot being generated fresh from text alone.
    let referenceImage: { imageBytes: string; mimeType: string } | undefined;
    let referenceImageRole: "subject" | "style" | undefined;
    if (shot.shot_index === 0 && storyboard.reference_image_url) {
      const referenceRes = await fetch(storyboard.reference_image_url);
      if (!referenceRes.ok) throw new Error(`failed to fetch reference image: ${referenceRes.status}`);
      const imageBytes = Buffer.from(await referenceRes.arrayBuffer()).toString("base64");
      referenceImage = { imageBytes, mimeType: "image/png" };
      referenceImageRole = storyboard.reference_image_role ?? "subject";
    } else if (shot.shot_index > 0) {
      const siblingShots = await listShots(shot.storyboard_id);
      const previous = siblingShots.find((s) => s.shot_index === shot.shot_index - 1);
      if (previous?.selected_choice !== null && previous?.selected_choice !== undefined && previous.choice_urls) {
        const referenceUrl = previous.choice_urls[previous.selected_choice];
        const referenceRes = await fetch(referenceUrl);
        if (!referenceRes.ok) throw new Error(`failed to fetch reference image: ${referenceRes.status}`);
        const imageBytes = Buffer.from(await referenceRes.arrayBuffer()).toString("base64");
        referenceImage = { imageBytes, mimeType: "image/png" };
        referenceImageRole = "subject";
      }
    }

    const refinedPrompt = await refineShotImagePrompt(
      shot.description,
      storyboard.concept,
      shot.shot_index,
      storyboard.shot_count,
      storyboard.aspect_ratio,
      brand,
      referenceImageRole,
    );
    const images = await Promise.all(
      Array.from({ length: SHOT_CHOICE_COUNT }, () =>
        generateImage(refinedPrompt, storyboard.aspect_ratio, referenceImage),
      ),
    );
    const urls = await Promise.all(
      images.map((image, i) => uploadPoster(`${shotId}-choice-${i}`, Buffer.from(image.imageBytes, "base64"))),
    );
    await updateShot(shotId, { choice_urls: urls, status: "choices_ready" });
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
    );

    const video = await generateVideo(refinedPrompt, {
      generateAudio: false,
      durationSeconds: storyboard.shot_duration_seconds,
      aspectRatio: storyboard.aspect_ratio,
      image: { imageBytes, mimeType: "image/png" },
    });

    const videoUrl = await uploadVideo(shotId, Buffer.from(video.videoBytes, "base64"), video.mimeType);
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

    const finalBuffer = await stitchVideos(clipBuffers);
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
