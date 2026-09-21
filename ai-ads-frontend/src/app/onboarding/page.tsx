"use client";

import { Building2, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { createAccount, getAccount, type AccountType } from "@/lib/api";

const OPTIONS: {
  id: AccountType;
  icon: typeof User;
  title: string;
  description: string;
}[] = [
  {
    id: "individual",
    icon: User,
    title: "Individual",
    description: "One brand kit, straight into your Projects. Best if it's just you.",
  },
  {
    id: "organisation",
    icon: Building2,
    title: "Organisation",
    description:
      "Multiple products, each with its own brand kit. Starts with a quick brand questionnaire per product.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<AccountType | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAccount()
      .then(({ account }) => {
        if (!account) {
          setCheckingAccount(false);
          return;
        }
        router.replace(account.account_type === "organisation" ? "/onboarding/organisation" : "/projects");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setCheckingAccount(false);
      });
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleContinue() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await createAccount(selected);
      router.push(selected === "individual" ? "/projects" : "/onboarding/organisation");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  if (checkingAccount) return null;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden"
      >
        <div
          className="h-[420px] w-[720px] opacity-15 blur-[110px] dark:opacity-30"
          style={{
            background:
              "radial-gradient(closest-side, rgba(99,140,255,0.55), rgba(198,99,255,0.35) 45%, rgba(255,99,170,0.2) 70%, transparent 80%)",
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <Logo className="text-foreground" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-muted transition-colors hover:text-foreground"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-10 py-16">
        <div className="flex flex-col gap-3 text-center">
          <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">
            Welcome
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            How will you be creating ads?
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted">
            This decides how your account is set up. You can&apos;t switch it later without
            starting a new account.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selected === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelected(option.id)}
                className={clsx(
                  "rgb-border cursor-pointer p-6 text-left transition-transform duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                  isSelected ? "scale-[1.01]" : "hover:scale-[1.005]",
                )}
              >
                <div
                  className={clsx(
                    "mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors",
                    isSelected
                      ? "border-transparent bg-button-bg text-button-fg"
                      : "border-border-strong text-foreground",
                  )}
                >
                  <Icon size={18} />
                </div>
                <h2 className="mb-1.5 text-base font-medium">{option.title}</h2>
                <p className="text-sm leading-relaxed text-muted">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        {error && <p className="text-center text-sm text-red-400">{error}</p>}

        <div className="flex justify-center">
          <Button disabled={!selected || submitting} onClick={handleContinue}>
            {submitting ? "Setting up…" : "Continue"}
          </Button>
        </div>
      </div>
    </main>
  );
}
