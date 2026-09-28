import "./lib/gcp-credentials-bootstrap";
import { Worker } from "bullmq";
import { type GenerationTask, enqueueShotChoices, enqueueShotVideo, enqueueStoryboardStitch, redisConnection } from "./lib/queue";
import { env } from "./lib/env";
import { getJob, updateJobStatus } from "./lib/jobs";
import { generateVideo } from "./lib/veo";
import { findMarksInVideo, findSuddenEffects } from "./lib/video-check";
import { posterDirection } from "./lib/poster-brief";
import { type CreativeBrief, directionText, effectivePacing, footageSeconds, planShots, TONE_FONT, TONE_GRADE, TRANSITION_SECONDS, VIDEO_ARTIFACT_NEGATIVES } from "./lib/creative-brief";
import { renderEndCard, renderSuper } from "./lib/end-card";
import { generateMusic } from "./lib/music";
import { synthesizeVoiceover, synthesizeVoiceoverLines } from "./lib/voiceover";
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
import { renderScreenInsert } from "./lib/screen-insert";
import {
  getShot,
  getStoryboardById,
  type AssetKind,
  getAsset,
  listAssets,
  listShots,
  selectShotChoice,
  SHOT_CHOICE_COUNT,
  updateAsset,
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
    const brief = job.poster_brief;
    // References: the brief's product / person / location photos (labeled), plus an older-style
    // single reference image. The user's own product photos may show genuine branding.
    const assetRefs = await Promise.all(
      (brief?.assets ?? []).map(async (asset) => {
        const res = await fetch(asset.imageUrl);
        if (!res.ok) throw new Error(`failed to fetch reference asset "${asset.name}": ${res.status}`);
        return {
          image: { imageBytes: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType: "image/png" },
          label: ASSET_LABEL[asset.kind](asset.name),
          kind: asset.kind,
        };
      }),
    );
    const references = [...assetRefs];
    if (referenceImage) {
      references.push({
        image: referenceImage,
        label: job.reference_image_role === "style" ? "style reference — match its mood, palette, and lighting, but not its content" : "the client's product/subject photo — reproduce it exactly",
        kind: job.reference_image_role === "style" ? "location" : "product",
      });
    }
    const allowedMarks = [
      ...assetRefs.filter((r) => r.kind === "product").map((r) => r.image),
      ...(job.reference_image_role === "subject" && referenceImage ? [referenceImage] : []),
    ];

    const refinedPrompt = await refineImagePrompt(
      job.prompt,
      job.aspect_ratio,
      brand,
      template?.template_prompt,
      job.reference_image_role ?? undefined,
      brief ? posterDirection(brief) : null,
      brief?.assets.length ? references.map((r) => r.label) : undefined,
    );
    const image = await generateCleanImage(refinedPrompt, job.aspect_ratio, references.map((r) => r.image), allowedMarks);
    const rawBuffer = Buffer.from(image.imageBytes, "base64");

    const finalBuffer = await applyBrandOverlay(rawBuffer, {
      logoUrl: product?.logo_url,
      primaryColor: product?.primary_color,
      tagline: job.tagline,
      copy: brief,
      // Brand-kit font first, else the brief's tone font, so the type matches the poster's vibe.
      font: product?.font || (brief ? TONE_FONT[brief.tone] : null),
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

type RefImage = { imageBytes: string; mimeType: string };

const ASSET_REFERENCE_LIMIT = 3; // beyond ~3 subjects the image model starts blending them
const ASSET_LABEL: Record<AssetKind, (name: string) => string> = {
  character: (n) => `character "${n}" — reproduce this exact person: face, hair, skin tone, build, and wardrobe exactly as in the image (the image wins over any written description)`,
  product: (n) => `product "${n}" — the client's real product: reproduce its exact shape, colors, materials, and genuine branding`,
  location: (n) => `location "${n}" — the real place: keep its architecture, materials, and look`,
};

// The ready reference assets named in a shot, as labeled images (characters first, then product,
// then location), plus the product images on their own for the mark check's allow-list.
async function shotAssetReferences(storyboardId: string, names: string[], fetchImage: (url: string) => Promise<RefImage>) {
  if (!names.length) return { refs: [] as { image: RefImage; label: string; kind: AssetKind }[], productRefs: [] as RefImage[] };
  const order: AssetKind[] = ["character", "product", "location"];
  const assets = (await listAssets(storyboardId))
    .filter((a) => names.includes(a.name) && a.status === "ready" && a.image_url)
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .slice(0, ASSET_REFERENCE_LIMIT);
  const refs = await Promise.all(assets.map(async (a) => ({ image: await fetchImage(a.image_url!), label: ASSET_LABEL[a.kind](a.name), kind: a.kind })));
  return { refs, productRefs: refs.filter((r) => r.kind === "product").map((r) => r.image) };
}

// Pro character sheet: one clean, full-length reference photo per recurring character, in the
// film's look, so every shot featuring them reproduces the same person.
async function processCharacterReference(assetId: string): Promise<void> {
  const asset = await getAsset(assetId);
  if (!asset) throw new Error(`asset ${assetId} not found`);
  const storyboard = await getStoryboardById(asset.storyboard_id);
  if (!storyboard) throw new Error(`storyboard ${asset.storyboard_id} not found`);

  try {
    // The film's look sheet is deliberately left out: passing it pulled the film's location into
    // the reference (a garden instead of a studio). The character description already carries the
    // wardrobe, and a clean studio reference transfers best into every shot.
    const prompt = `Studio casting photograph of one person, photoreal. The person: ${asset.description ?? asset.name}.
Full-length, facing the camera, standing naturally with a relaxed, friendly expression; the whole body and face clearly visible and sharp. Shot indoors in a photo studio against a plain, empty light-grey seamless paper backdrop — nothing else in the frame, no location, no props. Soft even studio light, true-to-life natural color and skin tones, plain unmarked clothing exactly as described.`;
    const image = await generateCleanImage(prompt, "3:4");
    const url = await uploadPoster(`${assetId}-character-${Date.now()}`, Buffer.from(image.imageBytes, "base64"));
    await updateAsset(assetId, { image_url: url, status: "ready", error: null });
  } catch (err) {
    await updateAsset(assetId, { status: "failed", error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

async function processShotChoices(shotId: string): Promise<void> {
  const shot = await getShot(shotId);
  if (!shot) throw new Error(`shot ${shotId} not found`);

  const storyboard = await getStoryboardById(shot.storyboard_id);
  if (!storyboard) throw new Error(`storyboard ${shot.storyboard_id} not found`);

  // A screen insert has no keyframe to generate: its one "choice" is the product screen itself.
  if (shot.screen_url) {
    await updateShot(shotId, { choice_urls: [shot.screen_url], selected_choice: 0, status: "choices_ready" });
    const next = (await listShots(shot.storyboard_id)).find((s) => s.shot_index === shot.shot_index + 1);
    if (next && next.status === "pending" && !next.choice_urls) await enqueueShotChoices(next.id);
    await enqueueShotVideo(shotId);
    return;
  }

  try {
    const brand = await getBrandContextForProject(storyboard.project_id);

    // References for this keyframe, labeled in order: the reference assets that appear in the
    // shot (character sheet / the client's product and location photos), the user's older-style
    // single reference image, and — after the first shot — the previous shot's chosen frame for
    // continuity. Together they keep people, product, and place consistent across shots.
    const fetchImage = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`failed to fetch reference image: ${res.status}`);
      return { imageBytes: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType: "image/png" };
    };
    const { refs: assetRefs, productRefs } = await shotAssetReferences(storyboard.id, shot.asset_names, fetchImage);
    const references: { image: RefImage; label: string }[] = [...assetRefs];
    const userRole = storyboard.reference_image_url ? storyboard.reference_image_role ?? "subject" : undefined;
    const userRef = storyboard.reference_image_url ? await fetchImage(storyboard.reference_image_url) : undefined;
    if (userRef) {
      references.push({
        image: userRef,
        label: userRole === "style" ? "style reference — match its mood, palette, and lighting, but not its content" : "the client's product/subject photo — reproduce it exactly",
      });
    }
    let previousFrame: { imageBytes: string; mimeType: string } | undefined;
    if (shot.shot_index > 0) {
      const siblingShots = await listShots(shot.storyboard_id);
      // Continuity comes from the last live shot — a screen insert's product screen is no reference
      // for people, place, or light.
      const previous = siblingShots
        .filter((s) => s.shot_index < shot.shot_index && !s.screen_url)
        .sort((a, b) => b.shot_index - a.shot_index)[0];
      if (previous?.selected_choice !== null && previous?.selected_choice !== undefined && previous.choice_urls) {
        previousFrame = await fetchImage(previous.choice_urls[previous.selected_choice]);
        // With a cast sheet, people and wardrobe come from the character references, not from this
        // frame — otherwise one drifted outfit propagated to every later shot.
        const hasCast = assetRefs.some((r) => r.kind === "character");
        references.push({
          image: previousFrame,
          label: hasCast
            ? "the previous shot's chosen frame — keep continuity of place, light, and palette; people and wardrobe follow the character references above; the framing and action change"
            : "the previous shot's chosen frame — keep continuity of people, wardrobe, place, light, and palette; the framing and action change",
        });
      }
    }
    const referenceImages = references.map((r) => r.image);
    // The client's own product photos (and an older-style subject photo) may show genuine branding.
    const allowedMarks = [...productRefs, ...(userRole === "subject" && userRef ? [userRef] : [])];

    const refinedPrompt = await refineShotImagePrompt(
      shot.description,
      storyboard.concept,
      shot.shot_index,
      storyboard.shot_count,
      storyboard.aspect_ratio,
      brand,
      userRole,
      storyboard.look_sheet,
      directionText(storyboard.creative_brief),
      references.map((r) => r.label),
    );
    // Sequential, not parallel — bursting the image API is what trips its rate limit.
    const images = [];
    for (let i = 0; i < SHOT_CHOICE_COUNT; i++) {
      images.push(await generateCleanImage(refinedPrompt, storyboard.aspect_ratio, referenceImages, allowedMarks));
    }
    const urls = await Promise.all(
      images.map((image, i) => uploadPoster(`${shotId}-choice-${i}`, Buffer.from(image.imageBytes, "base64"))),
    );
    await updateShot(shotId, { choice_urls: urls, status: "choices_ready" });

    // Auto-pick the best candidate and keep the film moving: the next shot's choices first (so
    // every keyframe is visible early), then this shot's video. The user can override any pick
    // through PATCH, which regenerates just that shot's video.
    const cast = assetRefs.filter((r) => r.kind === "character").map((r) => ({ image: r.image, name: r.label }));
    const best = await pickBestKeyframe(images, shot.description, storyboard.look_sheet, previousFrame, cast);
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
    if (shot.screen_url) {
      // Built from the real screen, so no Veo call and no text/effects checks (it is all real UI).
      const res = await fetch(shot.screen_url);
      if (!res.ok) throw new Error(`failed to fetch product screen: ${res.status}`);
      const reveal = storyboard.creative_brief?.screens?.find((s) => s.url === shot.screen_url)?.reveal ?? null;
      const clip = await renderScreenInsert(Buffer.from(await res.arrayBuffer()), storyboard.aspect_ratio, storyboard.shot_duration_seconds, reveal);
      const videoUrl = await uploadVideo(shotId, clip, "video/mp4");
      await updateShot(shotId, { video_url: videoUrl, status: "video_ready" });
      const siblings = await listShots(shot.storyboard_id);
      if (siblings.every((s) => s.id === shotId || s.video_url)) await enqueueStoryboardStitch(shot.storyboard_id);
      return;
    }

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
      { imageBytes, mimeType: "image/png" },
      storyboard.reference_image_role === "subject" || (await listAssets(storyboard.id)).some((a) => a.kind === "product"),
    );
    const { prompt, negativePrompt: refinedNegative } = splitNegativePrompt(refinedPrompt);
    const brief = storyboard.creative_brief;
    const negativePrompt =
      [refinedNegative, brief?.avoid, brief?.exclusions, brief?.look !== "surreal" ? VIDEO_ARTIFACT_NEGATIVES : null].filter(Boolean).join(", ") || undefined;

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
      const { productRefs } = await shotAssetReferences(storyboard.id, shot.asset_names, async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`failed to fetch reference image: ${res.status}`);
        return { imageBytes: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType: "image/png" };
      });
      const [marks, effects] = await Promise.all([
        storyboard.reference_image_role !== "subject" ? findMarksInVideo(clip, productRefs) : Promise.resolve([]),
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
async function editBriefedAd(
  clips: Buffer[],
  lastFrame: Buffer,
  brief: CreativeBrief,
  product: ProductRow | null,
  // Shots that may carry on-screen text (live shots after the first; never a screen insert).
  superShots?: number[],
): Promise<Buffer> {
  const font = product?.font || TONE_FONT[brief.tone];
  const { width = 720, height = 1280 } = await sharp(lastFrame).metadata();

  const lines = brief.voiceover && !brief.voiceoverScript ? brief.audio?.voiceoverLines : undefined;
  const perShot = Boolean(lines?.some((l) => l?.trim()));
  const [music, voiceover, endCard, supers] = await Promise.all([
    brief.audio?.musicPrompt
      ? generateMusic(brief.audio.musicPrompt, `Instrumental background music for a ${brief.tone} ${Math.round(footageSeconds(brief))}-second ad: simple, steady, gentle dynamics, no vocals.`).catch((err) => {
          console.warn("[worker] music generation failed, continuing without music:", err instanceof Error ? err.message : err);
          return undefined;
        })
      : undefined,
    perShot
      ? synthesizeVoiceoverLines(lines!, brief.voiceoverLanguage, brief.voiceGender, brief.tone, brief.audio?.voiceoverDirection).catch((err) => {
          console.warn("[worker] voiceover generation failed, continuing without voiceover:", err instanceof Error ? err.message : err);
          return undefined;
        })
      : brief.voiceover && brief.audio?.voiceoverScript
      ? synthesizeVoiceover(brief.audio.voiceoverScript, brief.voiceoverLanguage, brief.voiceGender, brief.tone, brief.audio.voiceoverDirection).catch((err) => {
          console.warn("[worker] voiceover generation failed, continuing without voiceover:", err instanceof Error ? err.message : err);
          return undefined;
        })
      : undefined,
    renderEndCard(lastFrame, {
      brandName: brief.brandName ?? product?.name ?? null,
      tagline: brief.endCardTagline ?? null,
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
    endCard: endCard.background,
    endCardOverlay: endCard.overlay,
    cutSeconds: plan.cutSeconds,
    transitionSeconds: TRANSITION_SECONDS[effectivePacing(brief)],
    grade: TONE_GRADE[brief.tone],
    supers,
    superShots,
    music,
    ...(Array.isArray(voiceover) ? { voiceoverLines: voiceover } : { voiceover }),
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
      finalBuffer = await editBriefedAd(clipBuffers, lastFrame, brief, product, shots.filter((s) => s.shot_index > 0 && !s.screen_url).map((s) => s.shot_index));
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
      case "storyboard-character":
        await processCharacterReference(task.assetId);
        break;
    }
  },
  {
    connection: redisConnection,
    prefix: env.queuePrefix,
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
