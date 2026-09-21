import Link from "next/link";
import { Logo } from "@/components/logo";
import { CinematicThemeSwitcher } from "@/components/ui/cinematic-theme-switcher";
import { FunctionalHero } from "@/components/functional-hero";
import { OutputSamples } from "@/components/output-samples";
import { WorkflowAnimation } from "@/components/workflow-animation";
import { AccountComparison } from "@/components/account-comparison";

const PRIMARY_BUTTON =
  "shiny-button inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium text-button-fg transition-transform duration-150 hover:scale-[1.03] active:scale-95";

export default function LandingPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden"
      >
        <div
          className="h-[420px] w-[900px] opacity-15 blur-[110px] dark:opacity-30"
          style={{
            background:
              "radial-gradient(closest-side, rgba(99,140,255,0.55), rgba(198,99,255,0.35) 45%, rgba(255,99,170,0.2) 70%, transparent 80%)",
          }}
        />
      </div>

      <div className="fixed top-4 right-8 z-[60] hidden origin-top-right scale-[0.65] md:block">
        <CinematicThemeSwitcher />
      </div>

      <div className="sticky top-4 z-50 mt-4 mb-8">
        <header className="mx-auto flex w-full max-w-2xl items-center justify-between rounded-full border border-border-subtle bg-background/70 px-4 py-2.5 shadow-lg shadow-black/10 backdrop-blur-xl sm:px-6">
          <Logo className="text-foreground" />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link href="/login?mode=sign-up" className={PRIMARY_BUTTON}>
              Get started
            </Link>
          </div>
        </header>
      </div>

      <section className="flex flex-col items-center gap-6 pt-8 pb-16 text-center sm:pb-24">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          What&apos;s the ad in your head?
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-muted">
          Pick a poster or a video. Build it shot by shot with a storyboard for full
          control. Adit keeps it on-brand either way.
        </p>
        <div className="w-full pt-4">
          <FunctionalHero />
        </div>
      </section>

      <section className="py-10">
        <OutputSamples />
      </section>

      <section className="py-16">
        <WorkflowAnimation />
      </section>

      <section className="py-16">
        <AccountComparison />
      </section>

      <section className="flex flex-col items-center gap-6 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Ready to make your first ad?
        </h2>
        <Link href="/login?mode=sign-up" className={PRIMARY_BUTTON}>
          Get started free
        </Link>
      </section>

      <footer className="flex items-center justify-between border-t border-border-subtle py-8 text-xs text-muted">
        <Logo className="h-5 w-auto text-foreground opacity-70" />
        <p>© {new Date().getFullYear()} Adit</p>
      </footer>
    </main>
  );
}
