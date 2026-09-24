"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Building2,
  CircleUserRound,
  Clapperboard,
  FolderKanban,
  Image as ImageIcon,
  LayoutTemplate,
  LogOut,
  Moon,
  Plus,
  Sparkles,
  Sun,
  ShieldCheck,
  Video,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { createClient } from "@/lib/supabase/client";
import { createProject, getAccount, listProducts, type Account, type Product, type ProjectType } from "@/lib/api";

function NavLink({
  href,
  icon: Icon,
  label,
  sublabel,
  active,
}: {
  href: string;
  icon: typeof FolderKanban;
  label: string;
  sublabel?: string;
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
      <span className="hidden min-w-0 flex-1 sm:flex sm:flex-col sm:items-start sm:leading-tight">
        <span className="truncate">{label}</span>
        {sublabel && (
          <span className={clsx("truncate text-[10px] font-normal", active ? "text-button-fg/70" : "text-muted")}>
            {sublabel}
          </span>
        )}
      </span>
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
  const [products, setProducts] = useState<Product[] | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [quickCreating, setQuickCreating] = useState<ProjectType | null>(null);
  const [flowMenuOpenFor, setFlowMenuOpenFor] = useState<{ type: ProjectType; top: number; left: number } | null>(
    null,
  );

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    getAccount()
      .then(({ account }) => {
        setAccount(account);
        if (account?.account_type === "organisation") {
          listProducts()
            .then(({ products }) => setProducts(products))
            .catch(() => {
              /* the brand list is a nav convenience — a load failure shouldn't block the sidebar */
            });
        }
      })
      .catch(() => {
        /* only used to gate org accounts (which need a product picked) behind the projects page instead */
      });
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setAvatarUrl(data.user?.user_metadata?.avatar_url ?? data.user?.user_metadata?.picture ?? null);
      });
  }, []);

  async function handleQuickCreate(type: ProjectType, storyboard = false) {
    setFlowMenuOpenFor(null);
    if (account?.account_type === "organisation") {
      // Org accounts need a product context first — the projects page already handles that flow.
      router.push("/projects");
      return;
    }
    setQuickCreating(type);
    try {
      const name = type === "video" ? "Untitled Video Ad" : "Untitled Poster Ad";
      const { project } = await createProject(name, type);
      router.push(storyboard ? `/projects/${project.id}/storyboard` : `/projects/${project.id}`);
    } finally {
      setQuickCreating(null);
    }
  }

  function toggleFlowMenu(e: MouseEvent<HTMLButtonElement>, type: ProjectType) {
    if (flowMenuOpenFor?.type === type) {
      setFlowMenuOpenFor(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setFlowMenuOpenFor({ type, top: rect.top, left: rect.right + 8 });
  }

  function handleTemplatesClick() {
    if (pathname === "/projects") {
      document.getElementById("templates")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push("/projects#templates");
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
      {/* Admins only — the admin API is also admin-checked server-side, this just hides the link. */}
      {account?.is_admin && <NavLink href="/admin" icon={ShieldCheck} label="Admin" active={pathname.startsWith("/admin")} />}
      <button
        onClick={handleTemplatesClick}
        className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground sm:justify-start sm:px-3"
      >
        <LayoutTemplate size={16} className="shrink-0" />
        <span className="hidden sm:inline">Templates</span>
      </button>
      {account?.account_type === "organisation" && (
        <>
          <p className="mt-5 mb-1 hidden px-3 text-[10px] font-medium tracking-wide text-muted uppercase sm:block">
            Brands
          </p>
          {products?.map((product) => (
            <Link
              key={product.id}
              href={`/projects?product=${product.id}`}
              className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground sm:justify-start sm:px-3"
            >
              {product.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote product logo
                <img src={product.logo_url} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
              ) : (
                <Building2 size={16} className="shrink-0" />
              )}
              <span className="hidden truncate sm:inline">{product.name}</span>
            </Link>
          ))}
          <Link
            href="/products"
            className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground sm:justify-start sm:px-3"
          >
            <Plus size={16} className="shrink-0" />
            <span className="hidden sm:inline">New brand</span>
          </Link>
        </>
      )}

      <p className="mt-5 mb-1 hidden px-3 text-[10px] font-medium tracking-wide text-muted uppercase sm:block">
        Categories
      </p>
      <button
        onClick={(e) => toggleFlowMenu(e, "poster")}
        disabled={quickCreating !== null}
        className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-50 sm:justify-start sm:px-3"
      >
        <ImageIcon size={16} className="shrink-0" />
        <span className="hidden sm:inline">{quickCreating === "poster" ? "Creating…" : "Poster"}</span>
      </button>
      <button
        onClick={(e) => toggleFlowMenu(e, "video")}
        disabled={quickCreating !== null}
        className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-50 sm:justify-start sm:px-3"
      >
        <Video size={16} className="shrink-0" />
        <span className="hidden sm:inline">{quickCreating === "video" ? "Creating…" : "Video"}</span>
      </button>
      {flowMenuOpenFor &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setFlowMenuOpenFor(null)} />
            <div
              style={{ top: flowMenuOpenFor.top, left: flowMenuOpenFor.left }}
              className="fixed z-50 w-48 rounded-2xl border border-border-strong bg-surface p-1.5 shadow-lg"
            >
              {flowMenuOpenFor.type === "poster" ? (
                <button
                  onClick={() => handleQuickCreate("poster")}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                >
                  <ImageIcon size={12} /> New poster
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleQuickCreate("video")}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                  >
                    <Video size={12} /> New video
                  </button>
                  <button
                    onClick={() => handleQuickCreate("video", true)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                  >
                    <Clapperboard size={12} /> Shot by shot
                  </button>
                </>
              )}
            </div>
          </>,
          document.body,
        )}
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

      <div className="flex items-center gap-1">
        <Link
          href="/account"
          className={clsx(
            "flex h-10 flex-1 items-center justify-center gap-2.5 rounded-xl text-sm font-medium transition-colors sm:justify-start sm:px-3",
            pathname === "/account"
              ? "bg-button-bg text-button-fg"
              : "text-muted hover:bg-white/5 hover:text-foreground",
          )}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Google profile photo
            <img src={avatarUrl} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
          ) : (
            <CircleUserRound size={16} className="shrink-0" />
          )}
          <span className="hidden min-w-0 flex-1 sm:flex sm:flex-col sm:items-start sm:leading-tight">
            <span className="truncate">Account</span>
            {account && (
              <span
                className={clsx(
                  "truncate text-[10px] font-normal",
                  pathname === "/account" ? "text-button-fg/70" : "text-muted",
                )}
              >
                {account.account_type === "organisation" ? "Organisation" : "Individual"}
              </span>
            )}
          </span>
        </Link>

        <button
          onClick={handleSignOut}
          title="Sign out"
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-white/5 hover:text-foreground sm:flex"
        >
          <LogOut size={16} className="shrink-0" />
        </button>
      </div>
    </aside>
  );
}
