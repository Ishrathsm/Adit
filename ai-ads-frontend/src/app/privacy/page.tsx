import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

export const metadata = { title: "Privacy Policy — Adit" };

export default function PrivacyPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Draft — this page has not been reviewed by a lawyer. Don&apos;t rely on it for anything
          contractual until it has been.
        </p>
      </div>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="mb-2 text-base font-medium text-foreground">What we collect</h2>
          <p>
            Your email address and password (for account access), the prompts, reference images,
            and brand assets (logo, colors, tagline) you submit, and the ads Adit generates from
            them.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-medium text-foreground">How it&apos;s used</h2>
          <p>
            Your prompts and reference images are sent to Google&apos;s Gemini and Veo APIs to
            generate your ads. Generated output, brand assets, and account data are stored in our
            database and file storage (Supabase) to power your Projects list and let you come back
            to previous generations.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-medium text-foreground">Third parties</h2>
          <p>
            We use Google Cloud (Gemini/Veo) for generation, Supabase for authentication, database,
            and file storage, and Upstash for background job processing. Each has its own privacy
            practices governing data they process on our behalf.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-medium text-foreground">Data retention</h2>
          <p>
            Your projects, generated ads, and account data are retained until you delete your
            account. Deleting your account removes your data from our systems, subject to any
            copies already cached by the third-party providers above during generation.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-base font-medium text-foreground">Your choices</h2>
          <p>
            You can request deletion of your account and its data at any time by contacting us.
            Reference images and brand assets you remove from a project are deleted from our
            storage.
          </p>
        </section>
      </div>
    </main>
  );
}
