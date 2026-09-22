"use client";

import Link from "next/link";
import { ArrowLeft, CircleUserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export interface AppHeaderBack {
  href: string;
  label: string;
}

// Shared top bar for every authenticated app page — the logo always links back to
// /projects (home), an optional `back` link goes to that page's specific parent, and
// the account icon is the one consistent place to reach sign-out/profile from anywhere.
export function AppHeader({ back }: { back?: AppHeaderBack }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {back && (
          <Link
            href={back.href}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">{back.label}</span>
          </Link>
        )}
        <Link href="/projects" className="shrink-0" aria-label="Adit home">
          <Logo className="text-foreground" />
        </Link>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <Link
          href="/account"
          title="Account"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-muted transition-colors hover:text-foreground"
        >
          <CircleUserRound size={16} />
        </Link>
      </div>
    </div>
  );
}
