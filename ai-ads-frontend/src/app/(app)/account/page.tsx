"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, KeyRound, LogOut, User } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { createClient } from "@/lib/supabase/client";
import { getAccount, type Account } from "@/lib/api";

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
            <div>
              <p className="text-xs text-muted">Signs in with</p>
              <p className="text-sm font-medium">
                {providers.length ? providers.map((p) => (p === "google" ? "Google" : p === "email" ? "Email & password" : p)).join(" · ") : "—"}
              </p>
            </div>
          </div>

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
