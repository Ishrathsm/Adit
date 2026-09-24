"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, Lock, LogOut, User } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { createClient } from "@/lib/supabase/client";
import { getAccount, type Account } from "@/lib/api";
import { MIN_PASSWORD_LENGTH, PasswordInput } from "@/components/ui/password-input";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      // Google OAuth populates these on user_metadata — absent for email/password sign-ins.
      // Same fallback as the sidebar: the part of the email before "@" when there's no profile name.
      setName(data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name ?? data.user?.email?.split("@")[0] ?? null);
      const linked = (data.user?.app_metadata?.providers as string[] | undefined) ?? [data.user?.app_metadata?.provider as string | undefined];
      setProviders(linked.filter((p): p is string => Boolean(p)));
      setAvatarUrl(data.user?.user_metadata?.avatar_url ?? data.user?.user_metadata?.picture ?? null);
    });
    getAccount()
      .then(({ account }) => setAccount(account))
      .catch(() => {
        /* account may not exist yet mid-onboarding — email is still shown either way */
      })
      .finally(() => setLoading(false));
  }, []);

  // Password (email + password accounts only): masked by default; "Forgot password?" reveals the
  // fields to set a new one. Stored passwords are hashed, so the real one can never be shown.
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function closePasswordForm() {
    setShowPasswordForm(false);
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleChangePassword() {
    setPasswordMessage(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordMessage({ ok: false, text: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ ok: false, text: "The passwords don't match." });
      return;
    }
    setPasswordSaving(true);
    const { error } = await createClient().auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordMessage({ ok: false, text: error.message });
      return;
    }
    closePasswordForm();
    setPasswordMessage({ ok: true, text: "Password updated." });
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10 sm:px-10">
      <BackLink href="/projects" label="Projects" />

      <div className="mt-8 flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">Account</p>
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
      </div>

      {loading ? (
        <div className="mt-8 h-56 animate-pulse rounded-2xl bg-surface" />
      ) : (
        // Plain stacked rows (no cards), one per line.
        <div className="mt-8 flex flex-col divide-y divide-border-subtle border-y border-border-subtle">
          <div className="flex items-center gap-4 py-5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote Google profile photo
              <img src={avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full border border-border-strong object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border-strong">
                <User size={18} />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-medium">{name ?? "—"}</p>
              <p className="truncate text-sm text-muted">{email ?? "—"}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border-strong">
                <Building2 size={18} />
              </div>
              <div>
                <p className="text-xs text-muted">Account</p>
                {account ? (
                  <p className="mt-0.5 flex items-center gap-2">
                    <span className="text-sm font-bold">{account.account_type === "organisation" ? "Organisation" : "Individual"}</span>
                    <span className={`plan-pill ${account.plan === "pro" ? "plan-pill-pro" : "plan-pill-free"}`}>
                      {account.plan === "pro" ? "Pro" : "Free"}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-muted">Not set up yet</p>
                )}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-60"
            >
              <LogOut size={14} />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>

          <div className="flex items-center gap-4 py-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border-strong">
              <KeyRound size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted">Signed in with</p>
              <p className="truncate text-sm font-medium">
                {providers.map((p) => (p === "google" ? "Google" : p === "email" ? "Email" : p)).join(" + ") || "—"}
                <span className="font-normal text-muted"> · {email ?? "—"}</span>
              </p>
            </div>
          </div>

          {providers.includes("email") && (
            <div className="flex items-start gap-4 py-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border-strong">
                <Lock size={18} />
              </div>
              <div className="flex w-full max-w-sm flex-col gap-2">
                <p className="text-xs text-muted">Password</p>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium tracking-[0.2em]">••••••••</p>
                  {!showPasswordForm && (
                    <button
                      onClick={() => {
                        setPasswordMessage(null);
                        setShowPasswordForm(true);
                      }}
                      className="text-xs text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                {showPasswordForm && (
                  <div className="mt-1 flex flex-col gap-2">
                    <PasswordInput id="new-password" value={newPassword} onChange={setNewPassword} placeholder={`New password (${MIN_PASSWORD_LENGTH}+ characters)`} autoComplete="new-password" disabled={passwordSaving} />
                    <PasswordInput id="confirm-password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" autoComplete="new-password" disabled={passwordSaving} />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleChangePassword}
                        disabled={passwordSaving || !newPassword || !confirmPassword}
                        className="rounded-full bg-button-bg px-4 py-2 text-sm font-medium text-button-fg transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        {passwordSaving ? "Saving…" : "Save new password"}
                      </button>
                      <button onClick={closePasswordForm} disabled={passwordSaving} className="text-xs text-muted hover:text-foreground">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {passwordMessage && (
                  <p className={`text-xs ${passwordMessage.ok ? "text-emerald-400" : "text-red-400"}`}>{passwordMessage.text}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-4 py-5 text-xs text-muted">
            <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </a>
            <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
