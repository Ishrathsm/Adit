"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Mail, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { clearDraftPrompt, peekDraftPrompt, type DraftPrompt } from "@/lib/draft-prompt";

const DRAFT_TYPE_LABEL: Record<DraftPrompt["projectType"], string> = {
  poster: "Poster",
  video: "Video",
};

type Mode = "sign-in" | "sign-up";

const DISABLED_MESSAGE = "Your account has been disabled. If you think this is a mistake, please contact support.";

// Supabase's raw auth errors, reworded where a user needs a clearer message.
function friendlyAuthError(message: string): string {
  if (/banned/i.test(message)) return DISABLED_MESSAGE;
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Please try again.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first — check your inbox for the link.";
  return message;
}

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

  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "sign-up" ? "sign-up" : "sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Disabled accounts: redirected here after being signed out (?disabled=1), or refused by Supabase
  // at sign-in (email: "User is banned"; Google: sent back with ?error_description=...).
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("disabled") === "1"
      ? DISABLED_MESSAGE
      : searchParams.get("error_description")
        ? friendlyAuthError(searchParams.get("error_description")!)
        : null,
  );
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [exchangingCode, setExchangingCode] = useState(Boolean(code));
  const [draft, setDraft] = useState<DraftPrompt | null>(null);

  useEffect(() => {
    // Reading a one-time hand-off from sessionStorage into state, not an external subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (searchParams.get("draft") === "1") setDraft(peekDraftPrompt());
  }, [searchParams]);

  useEffect(() => {
    if (!code) return;
    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(friendlyAuthError(error.message));
        setExchangingCode(false);
        return;
      }
      router.push("/onboarding");
      router.refresh();
    });
  }, [code, router]);

  async function handleGoogleSignIn() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });
    // On success the browser navigates away to Google immediately — only a failure to even
    // start the redirect reaches this line.
    if (error) setError(friendlyAuthError(error.message));
  }

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    if (mode === "sign-up") {
      // Without emailRedirectTo, Supabase falls back to the project's dashboard-configured
      // Site URL for the confirmation link — which is easy to leave pointed at localhost
      // after moving to production. Pass the actual origin explicitly so it's always correct
      // regardless of what the dashboard default is set to.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      });
      setSubmitting(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (!data.session) {
        setConfirmationSent(true);
        return;
      }
      router.push("/onboarding");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      setError(friendlyAuthError(error.message));
      return;
    }
    router.push("/onboarding");
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
        {draft && (
          <div className="rgb-border flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
            <p className="truncate text-muted">
              Continuing: <span className="text-foreground">&ldquo;{draft.prompt}&rdquo;</span> (
              {DRAFT_TYPE_LABEL[draft.projectType]}
              {draft.projectType === "video" && draft.storyboard ? " · Storyboard" : ""})
            </p>
            <button
              type="button"
              onClick={() => {
                clearDraftPrompt();
                router.push("/");
              }}
              className="inline-flex shrink-0 items-center gap-1 font-medium text-muted transition-colors hover:text-foreground"
            >
              <Pencil size={11} />
              Edit
            </button>
          </div>
        )}

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
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-strong text-sm font-medium text-foreground transition-colors hover:bg-white/5"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 text-xs text-muted">
              <div className="h-px flex-1 bg-border-subtle" />
              or
              <div className="h-px flex-1 bg-border-subtle" />
            </div>

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
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  placeholder="••••••••"
                  className="w-full rounded-full border border-border-subtle bg-background px-4 py-2.5 pr-11 text-sm outline-none placeholder:text-muted focus:border-border-strong"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
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

        <p className="text-center text-xs text-muted">
          By continuing you agree to our{" "}
          <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
