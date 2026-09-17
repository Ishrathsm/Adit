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
  ? new Queue("generation", { connection: redisConnection })
  : null;
