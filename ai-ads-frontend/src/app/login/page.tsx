"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [exchangingCode, setExchangingCode] = useState(Boolean(code));

  useEffect(() => {
    if (!code) return;
    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(error.message);
        setExchangingCode(false);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }, [code, router]);

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    if (mode === "sign-up") {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      setSubmitting(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (!data.session) {
        setConfirmationSent(true);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (exchangingCode) return null;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
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

      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-8 py-16">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "sign-in" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted">
            {mode === "sign-in" ? "Sign in to keep making ads." : "Takes a minute — no card required."}
          </p>
        </div>

        {confirmationSent ? (
          <div className="rgb-border flex flex-col items-center gap-3 p-6 text-center">
            <Mail size={22} />
            <p className="text-sm font-medium">Check your email</p>
            <p className="text-sm text-muted">
              We sent a confirmation link to <span className="text-foreground">{email}</span>. Click it,
              then come back and sign in.
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmationSent(false);
                setMode("sign-in");
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <div className="rgb-border flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-border-strong"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                placeholder="••••••••"
                className="rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-border-strong"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button onClick={handleSubmit} disabled={submitting || !email.trim() || !password}>
              {submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Sign up"}
            </Button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              }}
              className="text-center text-sm text-muted transition-colors hover:text-foreground"
            >
              {mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
