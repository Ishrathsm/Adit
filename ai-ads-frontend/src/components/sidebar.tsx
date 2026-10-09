"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Building2,
  ChevronRight,
  CircleUserRound,
  Clapperboard,
  FolderKanban,
  Image as ImageIcon,
  LayoutTemplate,
  LogOut,
  Moon,
  PlayCircle,
  Plus,
  Sparkles,
  Sun,
  ShieldCheck,
  Video,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Logo } from "@/components/logo";
import { InfoTip } from "@/components/ui/info-tip";
import { NotificationBell } from "@/components/notification-bell";
import { createClient } from "@/lib/supabase/client";
import { createProject, getAccount, listProducts, type Account, type Features, type Product, type ProjectType } from "@/lib/api";

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

type CreateTarget = "poster" | "quick" | "ad";

// "Create ads" in the sidebar: each category expands in place to its flows. Each flow is tied to a
// feature switch, so options a user's plan/overrides don't include show greyed out.
const CREATE_CATEGORIES: {
  type: ProjectType;
  label: string;
  icon: typeof ImageIcon;
  options: { target: CreateTarget; label: string; hint: string; icon: typeof ImageIcon; feature: keyof Features }[];
}[] = [
  {
    type: "poster",
    label: "Poster",
    icon: ImageIcon,
    options: [{ target: "poster", label: "New poster", hint: "Design a poster ad", icon: Plus, feature: "poster" }],
  },
  {
    type: "video",
    label: "Video",
    icon: Video,
    options: [
      { target: "quick", label: "Quick video", hint: "One shot (4–8s) with music and an end card", icon: Sparkles, feature: "video_quick" },
      { target: "ad", label: "Full ad", hint: "A scripted multi-shot ad (15–30s)", icon: Clapperboard, feature: "video_ad" },
    ],
  },
];

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
  // Who's signed in: the Google profile name, else the part of the email before "@".
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [features, setFeatures] = useState<Features | null>(null);
  const [quickCreating, setQuickCreating] = useState<CreateTarget | null>(null);
  // Which "Create ads" categories are expanded in place.
  const [expanded, setExpanded] = useState<Record<ProjectType, boolean>>({ poster: false, video: false });

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    getAccount()
      .then(({ account, features }) => {
        setAccount(account);
        setFeatures(features);
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
        setDisplayName(
          data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name ?? data.user?.email?.split("@")[0] ?? null,
        );
      });
  }, []);

  async function handleCreate(target: CreateTarget) {
    if (account?.account_type === "organisation") {
      // Org accounts need a product context first — the projects page already handles that flow.
      router.push("/projects");
      return;
    }
    setQuickCreating(target);
    try {
      const type: ProjectType = target === "poster" ? "poster" : "video";
      const { project } = await createProject(type === "video" ? "Untitled Video Ad" : "Untitled Poster Ad", type);
      router.push(
        target === "poster"
          ? `/projects/${project.id}`
          : target === "quick"
            ? `/projects/${project.id}/storyboard?mode=quick`
            : `/projects/${project.id}/storyboard`,
      );
    } finally {
      setQuickCreating(null);
    }
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
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col gap-1 overflow-x-hidden overflow-y-auto border-r border-border-subtle bg-surface px-2 py-4 sm:w-56 sm:px-3">
      <Link href="/projects" className="mb-6 flex items-center justify-center px-1 sm:justify-start sm:px-2">
        <Logo className="text-foreground" />
      </Link>

      <NavLink
        href="/projects"
        icon={FolderKanban}
        label="Projects"
        active={pathname === "/projects" || pathname.startsWith("/projects/")}
      />
      {/* Admins only — /admin and the admin API are also admin-checked server-side, this just hides
          the link. The console is its own shell, outside the product, so the link is never active. */}
      {account?.role === "admin" && <NavLink href="/admin" icon={ShieldCheck} label="Admin console" active={false} />}
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
        Create ads
      </p>
      {CREATE_CATEGORIES.map((category) => (
        <div key={category.type} className="flex flex-col">
          <button
            onClick={() => setExpanded((e) => ({ ...e, [category.type]: !e[category.type] }))}
            aria-expanded={expanded[category.type]}
            className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground sm:justify-start sm:px-3"
          >
            <category.icon size={16} className="shrink-0" />
            <span className="hidden flex-1 text-left sm:inline">{category.label}</span>
            <ChevronRight
              size={14}
              className={clsx("hidden shrink-0 transition-transform sm:block", expanded[category.type] && "rotate-90")}
            />
          </button>
          {expanded[category.type] && (
            // Nested under its category: indented with a guide line (icon-only on the narrow rail).
            <div className="flex flex-col gap-0.5 sm:ml-5 sm:border-l sm:border-border-subtle sm:pl-2">
              {category.options.map((option) => {
                // Null until the account loads — show as available; the server enforces anyway.
                const locked = features ? !features[option.feature] : false;
                return (
                  <div key={option.target} className="flex items-center">
                    <button
                      onClick={() => handleCreate(option.target)}
                      disabled={quickCreating !== null || locked}
                      className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl text-xs text-muted transition-colors hover:bg-white/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:justify-start sm:px-3"
                    >
                      <option.icon size={14} className="shrink-0" />
                      <span className="hidden truncate sm:inline">{quickCreating === option.target ? "Creating…" : option.label}</span>
                    </button>
                    <InfoTip text={locked ? `${option.hint} — not enabled on your account.` : option.hint} label={option.label} className="hidden sm:flex" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <div
        className="flex h-10 items-center justify-center gap-2.5 rounded-xl text-sm font-medium text-muted opacity-50 sm:justify-start sm:px-3"
        title="Motion Poster · Coming soon"
      >
        <Sparkles size={16} className="shrink-0" />
        <span className="hidden sm:inline">Motion Poster</span>
        <span className="hidden text-[10px] text-muted sm:inline">Soon</span>
      </div>
      <NavLink href="/tutorials" icon={PlayCircle} label="Tutorials" active={pathname.startsWith("/tutorials")} />

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
            "flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-xl text-sm font-medium transition-colors sm:justify-start sm:px-3 sm:py-1.5",
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
            <span className="max-w-full truncate" title={displayName ?? undefined}>
              {displayName ?? "Account"}
            </span>
            {account && (
              <span className="mt-0.5 flex items-center gap-1.5">
                <span
                  className={clsx(
                    "truncate text-[10px] font-bold",
                    pathname === "/account" ? "text-button-fg/80" : "text-foreground/80",
                  )}
                >
                  {account.account_type === "organisation" ? "Organisation" : "Individual"}
                </span>
                <span className={clsx("plan-pill", account.plan === "pro" ? "plan-pill-pro" : "plan-pill-free")}>
                  {account.plan === "pro" ? "Pro" : "Free"}
                </span>
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
