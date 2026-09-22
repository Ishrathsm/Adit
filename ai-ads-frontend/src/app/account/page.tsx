"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";
import { getAccount, type Account } from "@/lib/api";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
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
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <AppHeader back={{ href: "/projects", label: "Projects" }} />

      <div className="mt-8 flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">Account</p>
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
      </div>

      {loading ? (
        <div className="mt-8 h-32 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          <div className="rgb-border flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-strong">
                <User size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted">Email</p>
                <p className="truncate text-sm font-medium">{email ?? "—"}</p>
              </div>
            </div>
            {account && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-strong">
                  <Building2 size={16} />
                </div>
                <div>
                  <p className="text-xs text-muted">Account type</p>
                  <p className="text-sm font-medium capitalize">{account.account_type}</p>
                </div>
              </div>
            )}
          </div>

          <Button variant="ghost" onClick={handleSignOut} disabled={signingOut} className="self-start">
            <LogOut size={14} />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>

          <div className="flex gap-4 text-xs text-muted">
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
