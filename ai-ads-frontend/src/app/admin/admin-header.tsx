"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";

export function AdminHeader() {
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-surface">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6 sm:px-10">
        <Logo className="text-foreground" />
        <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">
          Admin
        </span>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/projects" className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground">
            Open app <ArrowUpRight size={14} />
          </Link>
          <ThemeToggle />
          <button onClick={handleSignOut} title="Sign out" className="text-muted transition-colors hover:text-foreground">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
