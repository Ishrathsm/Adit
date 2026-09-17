"use client";

import { FolderPlus, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ProjectsPage() {
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
        <p className="text-sm font-medium text-muted">Projects</p>
        <ThemeToggle />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="rgb-border flex h-16 w-16 items-center justify-center">
          <FolderPlus size={22} />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">No projects yet</h1>
          <p className="mx-auto max-w-sm text-sm text-muted">
            Every ad you make lives in a project. Start your first one below.
          </p>
        </div>
        <Button>New Project</Button>
      </div>

      <div className="grid gap-4 pb-10 sm:grid-cols-2">
        <div className="rgb-border flex items-start gap-3 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong">
            <ImageIcon size={16} />
          </div>
          <div>
            <h2 className="mb-1 text-sm font-medium">Poster</h2>
            <p className="text-xs leading-relaxed text-muted">
              Template, configure, and get a downloadable static ad.
            </p>
          </div>
        </div>
        <div className="rgb-border flex items-start gap-3 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong">
            <Video size={16} />
          </div>
          <div>
            <h2 className="mb-1 text-sm font-medium">Video</h2>
            <p className="text-xs leading-relaxed text-muted">
              Text-to-video, storyboard, or motion poster.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
