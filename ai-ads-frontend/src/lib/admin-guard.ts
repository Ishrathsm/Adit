import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// Server-side gate for the /admin console: signed-out visitors go to /login, anyone whose role
// isn't admin goes back to the app, before any of the console renders. The role comes from the
// backend (accounts has no client read policy), which verifies the token itself — and every
// /api/admin call is admin-checked there again, so this is never the only check.
export async function requireAdminPage(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${API_BASE_URL}/api/account`, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    cache: "no-store",
  }).catch(() => null);
  const body = res?.ok ? ((await res.json()) as { account?: { role?: string } | null }) : null;
  if (body?.account?.role !== "admin") redirect("/projects");
}
