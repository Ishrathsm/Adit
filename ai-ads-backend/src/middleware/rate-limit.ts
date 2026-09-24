import type { NextFunction, Response } from "express";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "../lib/env";
import type { AuthedRequest } from "./auth";

const redis =
  env.upstashRedisRestUrl && env.upstashRedisRestToken
    ? new Redis({ url: env.upstashRedisRestUrl, token: env.upstashRedisRestToken })
    : null;

if (!redis) {
  console.warn(
    "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — generation rate limiting disabled.",
  );
}

// 10 generations per user per 10 minutes — generous for real use, tight enough that one
// account can't run up the Google Cloud bill by spamming the queue.
const ratelimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "10 m"), prefix: "generation-limit" })
  : null;

export async function rateLimitGenerations(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  // Fails open (no limiter configured) rather than blocking all generation when the REST
  // credentials aren't set — matches how the rest of this codebase degrades gracefully when
  // optional infra isn't configured yet (see lib/queue.ts, lib/veo.ts).
  // Only requests that start generation count — reads (the storyboard page polls every few
  // seconds) used to count too, so polling alone hit the limit within a minute and the page
  // silently stopped updating.
  if (!ratelimit || req.method === "GET") {
    next();
    return;
  }

  const { success, reset } = await ratelimit.limit(req.userId!);
  if (!success) {
    const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    res.status(429).json({
      error: `You're generating too quickly — try again in about ${retryAfterSeconds}s.`,
    });
    return;
  }

  next();
}
