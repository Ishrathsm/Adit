"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { CircleUserRound, FolderKanban, Image as ImageIcon, LogOut, Moon, Sparkles, Sun, Video } from "lucide-react";
import { useTheme } from "next-themes";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { createClient } from "@/lib/supabase/client";
import { createProject, getAccount, type Account, type ProjectType } from "@/lib/api";

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: typeof FolderKanban;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium transition-colors sm:justify-start sm:px-3",
        active ? "bg-button-bg text-button-fg" : "text-muted hover:bg-white/5 hover:text-foreground",
      )}
    >
      <Icon size={16} className="shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

// Icon+label on sm: and up, collapses to a narrow icon-only rail below it — no slide-in
// drawer/overlay, so it stays usable on mobile without the extra state/complexity that'd add.
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [quickCreating, setQuickCreating] = useState<ProjectType | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    getAccount()
      .then(({ account }) => setAccount(account))
      .catch(() => {
        /* only used to gate org accounts (which need a product picked) behind the projects page instead */
      });
  }, []);

  async function handleQuickCreate(type: ProjectType) {
    if (account?.account_type === "organisation") {
      // Org accounts need a product context first — the projects page already handles that flow.
      router.push("/projects");
      return;
    }
    setQuickCreating(type);
    try {
      const name = type === "video" ? "Untitled Video Ad" : "Untitled Poster Ad";
      const { project } = await createProject(name, type);
      router.push(`/projects/${project.id}`);
    } finally {
      setQuickCreating(null);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isDark = resolvedTheme === "dark";

  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border-subtle bg-surface px-2 py-4 sm:w-56 sm:px-3">
      <Link href="/projects" className="mb-6 flex items-center justify-center px-1 sm:justify-start sm:px-2">
        <Logo className="text-foreground" />
      </Link>

      <NavLink
        href="/projects"
        icon={FolderKanban}
        label="Projects"
        active={pathname === "/projects" || pathname.startsWith("/projects/")}
      />

      <p className="mt-5 mb-1 hidden px-3 text-[10px] font-medium tracking-wide text-muted uppercase sm:block">
        Categories
      </p>
      <button
        onClick={() => handleQuickCreate("poster")}
        disabled={quickCreating !== null}
        className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-50 sm:justify-start sm:px-3"
      >
        <ImageIcon size={16} className="shrink-0" />
        <span className="hidden sm:inline">{quickCreating === "poster" ? "Creating…" : "Poster"}</span>
      </button>
      <button
        onClick={() => handleQuickCreate("video")}
        disabled={quickCreating !== null}
        className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-50 sm:justify-start sm:px-3"
      >
        <Video size={16} className="shrink-0" />
        <span className="hidden sm:inline">{quickCreating === "video" ? "Creating…" : "Video"}</span>
      </button>
      <div
        className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted opacity-50 sm:justify-start sm:px-3"
        title="Motion Poster · Coming soon"
      >
        <Sparkles size={16} className="shrink-0" />
        <span className="hidden sm:inline">Motion Poster</span>
        <span className="hidden text-[10px] text-muted sm:inline">Soon</span>
      </div>

      <div className="flex-1" />

      <NotificationBell />

      <button
        type="button"
        onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
        className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground sm:justify-between sm:px-3"
      >
        <span className="flex items-center gap-2.5">
          {mounted && isDark ? <Moon size={16} className="shrink-0" /> : <Sun size={16} className="shrink-0" />}
          <span className="hidden sm:inline">{mounted && isDark ? "Dark mode" : "Light mode"}</span>
        </span>
      </button>

      <NavLink href="/account" icon={CircleUserRound} label="Account" active={pathname === "/account"} />

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
