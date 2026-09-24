"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { MIN_PASSWORD_LENGTH, PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";

type Stage = "verifying" | "ready" | "invalid" | "done";

// Remembers (for this tab only) that a genuine reset link was opened, so a reload keeps working.
const VERIFIED_KEY = "adit:password-recovery";
function markVerified() {
  try {
    sessionStorage.setItem(VERIFIED_KEY, "1");
  } catch {
    /* storage unavailable — a reload will just ask for a new link */
  }
}
function readVerified(): boolean {
  try {
    return sessionStorage.getItem(VERIFIED_KEY) === "1";
  } catch {
    return false;
  }
}
function clearVerified() {
  try {
    sessionStorage.removeItem(VERIFIED_KEY);
  } catch {
    /* ignore */
  }
}

// Where password-reset emails land (from "Forgot password?" on the login page, or an admin's
// "Send password reset email"). Supabase signs the user in from the link, then they set a new
// password here. Handles both link styles: `?code=` (sent from the browser) and
// `#access_token=…&type=recovery` (sent by the backend).
export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = new URLSearchParams(window.location.search).get("code");

    async function verify() {
      if (hash.get("error_description")) return false;
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken && hash.get("type") === "recovery") {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        // Clear the tokens from the address bar once they've been used.
        window.history.replaceState(null, "", window.location.pathname);
        return !error;
      }
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        window.history.replaceState(null, "", window.location.pathname);
        return !error;
      }
      // A reload after arriving from the link (the tokens are gone from the URL by then). Being
      // merely signed in isn't enough: this page is only for reset links — signed-in users change
      // their password from the profile page.
      const { data } = await supabase.auth.getSession();
      return Boolean(data.session) && readVerified();
    }

    verify().then((ok) => {
      if (ok) markVerified();
      setStage(ok ? "ready" : "invalid");
    });
  }, []);

  async function handleSave() {
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== confirm) return setError("The passwords don't match.");
    setSaving(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (error) return setError(error.message);
    clearVerified();
    setStage("done");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <Link href="/" aria-label="Adit home">
        <Logo className="text-foreground" />
      </Link>

      <div className="flex w-full max-w-sm flex-col gap-4">
        {stage === "verifying" && <p className="text-center text-sm text-muted">Checking your link…</p>}

        {stage === "invalid" && (
          <>
            <h1 className="text-center text-xl font-semibold">This link has expired</h1>
            <p className="text-center text-sm text-muted">
              Password reset links work once and expire after a while. Request a new one from the login page.
            </p>
            <Link href="/login" className="self-center rounded-full bg-button-bg px-5 py-2 text-sm font-medium text-button-fg">
              Back to login
            </Link>
          </>
        )}

        {stage === "ready" && (
          <>
            <h1 className="text-center text-xl font-semibold">Set a new password</h1>
            <PasswordInput id="new-password" value={password} onChange={setPassword} placeholder={`New password (${MIN_PASSWORD_LENGTH}+ characters)`} autoComplete="new-password" disabled={saving} />
            <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm} placeholder="Confirm new password" autoComplete="new-password" disabled={saving} />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              onClick={handleSave}
              disabled={saving || !password || !confirm}
              className="rounded-full bg-button-bg py-2.5 text-sm font-medium text-button-fg transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save new password"}
            </button>
          </>
        )}

        {stage === "done" && (
          <>
            <h1 className="text-center text-xl font-semibold">Password updated</h1>
            <p className="text-center text-sm text-muted">You&apos;re signed in with your new password.</p>
            <button onClick={() => router.push("/projects")} className="self-center rounded-full bg-button-bg px-5 py-2 text-sm font-medium text-button-fg">
              Go to your projects
            </button>
          </>
        )}
      </div>
    </main>
  );
}
