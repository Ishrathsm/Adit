import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",

  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),

  // Optional: features degrade gracefully instead of crashing at boot when these are unset,
  // since not every POC account is created yet.
  upstashRedisUrl: process.env.UPSTASH_REDIS_URL || undefined,
  // Separate from the TCP url above — Ratelimit talks to Upstash over its REST API, not
  // ioredis. Same underlying database, different credential pair (Upstash dashboard's "REST"
  // tab, not "TCP"). Rate limiting is disabled (fails open) when these aren't set.
  upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL || undefined,
  upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || undefined,
  geminiApiKey: process.env.GEMINI_API_KEY || undefined,

  // Google Cloud / Veo. GOOGLE_APPLICATION_CREDENTIALS is read directly by google-auth-library
  // from process.env — not duplicated here.
  googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID || undefined,
  googleCloudLocation: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
  // veo-2.0-generate-001 was retired — veo-3.1-lite-generate-001 is the current cheapest tier.
  veoModel: process.env.VEO_MODEL ?? "veo-3.1-lite-generate-001",
  // Imagen (imagen-4.x, all variants) 404s on this project in every region tried — blocked at
  // the account/entitlement level, unrelated to model naming. Gemini's native image output
  // ("Nano Banana") is a separate product/API path and does work. gemini-3.1-flash-image
  // (Nano Banana 2, Google's current most-capable image model) is only live in the "global"
  // location for this project — it 404s in us-central1 same as Imagen does.
  imageModel: process.env.IMAGE_MODEL ?? "gemini-3.1-flash-image",
  imageLocation: process.env.IMAGE_LOCATION ?? "global",
  // Text generation (prompt refinement, storyboard shot breakdown) — plain Gemini text, no
  // region quirks observed. Pro over Flash: the refined prompt is the single biggest lever
  // on output quality (brand-rule adherence, actually following the user's brief), worth the
  // extra cost/latency over the budget tier.
  textModel: process.env.TEXT_MODEL ?? "gemini-2.5-pro",
};
