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
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || undefined,
  geminiApiKey: process.env.GEMINI_API_KEY || undefined,
};
