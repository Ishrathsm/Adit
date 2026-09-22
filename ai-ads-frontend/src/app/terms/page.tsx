import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

export const metadata = { title: "Terms of Service — Adit" };

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-10">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Home
        </Link>
        <Logo className="text-foreground" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Draft — this page has not been reviewed by a lawyer. Don&apos;t rely on it for anything
          contractual until it has been.
        </p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="mb-2 text-base font-medium text-foreground">1. What Adit does</h2>
          <p>
            Adit generates poster and video advertisements from text prompts and optional
            reference images using third-party AI models (currently Google&apos;s Gemini and Veo).
            You describe an ad; we send that description, and any reference image you upload, to
            those providers and return the result to you.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-medium text-foreground">2. Your content and ownership</h2>
          <p>
            You own the prompts, reference images, and brand assets you upload, and you own the
            ads Adit generates for you, subject to the underlying AI providers&apos; own usage
            terms. You&apos;re responsible for having the rights to anything you upload (logos,
            product photos, etc.) and for how you use the generated output.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-medium text-foreground">3. Acceptable use</h2>
          <p>
            Don&apos;t use Adit to generate deceptive, infringing, or illegal advertising content,
            and don&apos;t attempt to abuse or overload the generation pipeline. We may rate-limit
            or suspend accounts that do.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-medium text-foreground">4. Credits and billing</h2>
          <p>
            Adit is currently in early access and no payment is being collected. When paid plans
            launch, credits will be non-refundable once consumed by a generation, and this section
            will be updated with full billing terms before that happens.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-medium text-foreground">5. No warranty</h2>
          <p>
            Adit is provided during an early-access period without warranty of any kind. AI-
            generated output can be inaccurate, unexpected, or unsuitable for your intended use —
            review everything before you publish it.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-medium text-foreground">6. Changes</h2>
          <p>
            These terms may change as the product develops. Continued use after a change means
            you accept the updated terms.
          </p>
        </section>
      </div>
    </main>
  );
}
