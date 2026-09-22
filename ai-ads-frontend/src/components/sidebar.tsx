"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { CircleUserRound, FolderKanban, LogOut } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { createClient } from "@/lib/supabase/client";

// Icon+label on sm: and up, collapses to a narrow icon-only rail below it — no slide-in
// drawer/overlay, so it stays usable on mobile without the extra state/complexity that'd add.
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const projectsActive = pathname === "/projects" || pathname.startsWith("/projects/");

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-16 shrink-0 flex-col gap-1 border-r border-border-subtle bg-surface px-2 py-4 sm:w-56 sm:px-3">
      <Link href="/projects" className="mb-6 flex items-center justify-center px-1 sm:justify-start sm:px-2">
        <Logo className="text-foreground" />
      </Link>

      <Link
        href="/projects"
        className={clsx(
          "flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium transition-colors sm:justify-start sm:px-3",
          projectsActive ? "bg-button-bg text-button-fg" : "text-muted hover:bg-white/5 hover:text-foreground",
        )}
      >
        <FolderKanban size={16} className="shrink-0" />
        <span className="hidden sm:inline">Projects</span>
      </Link>

      <div className="flex-1" />

      <NotificationBell />

      <div className="flex items-center justify-center px-1 py-2 sm:justify-start sm:px-3">
        <ThemeToggle />
      </div>

      <Link
        href="/account"
        className={clsx(
          "flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium transition-colors sm:justify-start sm:px-3",
          pathname === "/account" ? "bg-button-bg text-button-fg" : "text-muted hover:bg-white/5 hover:text-foreground",
        )}
      >
        <CircleUserRound size={16} className="shrink-0" />
        <span className="hidden sm:inline">Account</span>
      </Link>

      <button
        onClick={handleSignOut}
        className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground sm:justify-start sm:px-3"
      >
        <LogOut size={16} className="shrink-0" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </aside>
  );
}
