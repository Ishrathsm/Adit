import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

// BullMQ needs a standard Redis (TCP) connection, not Upstash's REST API credentials —
// grab this from the Upstash dashboard's "TCP" tab, not the REST URL/token pair.
export const redisConnection = env.upstashRedisUrl
  ? new IORedis(env.upstashRedisUrl, { maxRetriesPerRequest: null })
  : null;

if (!redisConnection) {
  console.warn(
    "[queue] UPSTASH_REDIS_URL not set — job queue disabled. Grab the TCP connection " +
      'string from the Upstash dashboard ("TCP" tab, not the REST URL/token).',
  );
}

export const generationQueue = redisConnection
  ? new Queue("generation", {
      connection: redisConnection,
      // Google's image/video APIs 429 under burst load — retry with backoff instead of
      // failing the shot outright on a transient quota hit.
      defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 15000 } },
    })
  : null;

export type GenerationTask =
  | { kind: "job"; jobId: string }
  | { kind: "storyboard-shot-choices"; shotId: string }
  | { kind: "storyboard-shot-video"; shotId: string }
  | { kind: "storyboard-stitch"; storyboardId: string };

async function enqueue(task: GenerationTask): Promise<void> {
  if (!generationQueue) {
    throw new Error("Generation queue is disabled — UPSTASH_REDIS_URL not set");
  }
  await generationQueue.add(task.kind, task);
}

export function enqueueGenerationJob(jobId: string): Promise<void> {
  return enqueue({ kind: "job", jobId });
}

export function enqueueShotChoices(shotId: string): Promise<void> {
  return enqueue({ kind: "storyboard-shot-choices", shotId });
}

export function enqueueShotVideo(shotId: string): Promise<void> {
  return enqueue({ kind: "storyboard-shot-video", shotId });
}

export function enqueueStoryboardStitch(storyboardId: string): Promise<void> {
  return enqueue({ kind: "storyboard-stitch", storyboardId });
}
