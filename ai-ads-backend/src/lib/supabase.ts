import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Service-role client for server-side use only — bypasses RLS. Never expose this client
// or its key to the frontend; the frontend uses its own anon-key client instead.
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
