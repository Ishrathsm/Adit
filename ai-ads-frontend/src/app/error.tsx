"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FolderKanban, RotateCcw } from "lucide-react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

// Catches unexpected errors thrown while rendering any page, so the user gets a way forward
// instead of a blank screen; "Try again" uses retry(), which re-fetches and re-renders the page
// (Next 16 prefers it over reset()). Same visual language as the 404 page (components/ui/not-found-2).
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[app] unexpected error:", error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      <Empty>
        <EmptyHeader>
          <EmptyTitle className="mask-b-from-20% mask-b-to-80% text-8xl font-extrabold">Oops</EmptyTitle>
          <EmptyDescription className="-mt-6 text-foreground/80">
            Something went wrong on our side. Please try again.
            {error.digest && (
              <>
                <br />
                <span className="text-xs text-muted">Reference: {error.digest}</span>
              </>
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <button
              onClick={() => retry()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-button-bg px-6 text-sm font-medium text-button-fg transition-opacity hover:opacity-90"
            >
              <RotateCcw className="size-4" />
              Try again
            </button>
            <Link
              href="/projects"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-strong px-6 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
            >
              <FolderKanban className="size-4" />
              Your projects
            </Link>
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
