"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Bumped every time this screenshot is recaptured, so browsers that cached the old bytes at the
// same filename are forced to fetch the new one instead of silently showing a stale image.
const IMAGE_VERSION = "1";

export default function MakeAVideoAdTutorialPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 sm:px-10">
      <Link href="/tutorials" className="flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
        <ArrowLeft size={14} /> Tutorials
      </Link>

      <div className="mt-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Make a video ad</h1>
        <p className="text-sm text-muted">Start your video the same way you start a poster, just a different format.</p>
      </div>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border-strong bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-button-bg text-xs font-semibold text-button-fg">
            1
          </span>
          <h4 className="text-sm font-semibold tracking-tight">Write your video&apos;s brief</h4>
        </div>
        <p className="text-xs text-muted">
          On the Projects page, type what your video is for into the &quot;What will you create today?&quot; box, then click
          Video. A &quot;Shot by shot&quot; option appears next to it — toggle it on if you want a scripted, multi-shot ad
          instead of one quick clip. When you&apos;re ready, hit Create.
        </p>
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element -- a real screenshot of the app, not a remote/dynamic image */}
          <img
            src={`/tutorials/make-a-video-ad/step1-write-brief.png?v=${IMAGE_VERSION}`}
            alt="Write your video's brief"
            className="h-auto w-full"
          />
        </div>
      </div>
    </main>
  );
}
