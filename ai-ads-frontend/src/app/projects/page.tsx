"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, FolderPlus, Image as ImageIcon, LogOut, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import {
  createProject,
  getAccount,
  getProduct,
  listProjects,
  type Account,
  type Product,
  type Project,
  type ProjectType,
} from "@/lib/api";

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsPageInner />
    </Suspense>
  );
}

function ProjectsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("product");

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then(({ projects }) => setProjects(projects))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    getAccount()
      .then(({ account }) => setAccount(account))
      .catch(() => {
        /* non-fatal — only used to gate Organisation project creation */
      });
  }, []);

  useEffect(() => {
    if (!productId) {
      // Resetting derived state when the ?product= URL param is removed, not an external read.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveProduct(null);
      return;
    }
    getProduct(productId)
      .then(({ product }) => setActiveProduct(product))
      .catch(() => setActiveProduct(null));
  }, [productId]);

  async function startProject(type: ProjectType) {
    if (account?.account_type === "organisation" && !productId) {
      router.push("/onboarding/organisation");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const name = type === "video" ? "Untitled Video Ad" : "Untitled Poster Ad";
      const { project } = await createProject(name, type, productId ?? undefined);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

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
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-muted">Projects</p>
          {activeProduct && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1 text-xs text-muted">
              <Building2 size={12} />
              {activeProduct.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-muted transition-colors hover:text-foreground"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {projects && projects.length > 0 ? (
        <div className="flex flex-col gap-3 py-10">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => router.push(`/projects/${project.id}`)}
              className="rgb-border flex items-center justify-between gap-3 p-5 text-left transition-opacity hover:opacity-90"
            >
              <div>
                <h2 className="text-sm font-medium">{project.name}</h2>
                <p className="text-xs text-muted">
                  {project.type} · {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
              {project.type === "video" ? <Video size={16} /> : <ImageIcon size={16} />}
            </button>
          ))}
        </div>
      ) : (
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
          <Button onClick={() => startProject("video")} disabled={creating}>
            {creating ? "Creating…" : "New Project"}
          </Button>
        </div>
      )}

      <div className="grid gap-4 pb-10 sm:grid-cols-2">
        <button
          onClick={() => startProject("poster")}
          disabled={creating}
          className="rgb-border flex items-start gap-3 p-5 text-left transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong">
            <ImageIcon size={16} />
          </div>
          <div>
            <h2 className="mb-1 text-sm font-medium">Poster</h2>
            <p className="text-xs leading-relaxed text-muted">
              Describe the ad, pick an aspect ratio, generate with Imagen.
            </p>
          </div>
        </button>
        <button
          onClick={() => startProject("video")}
          disabled={creating}
          className="rgb-border flex items-start gap-3 p-5 text-left transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong">
            <Video size={16} />
          </div>
          <div>
            <h2 className="mb-1 text-sm font-medium">Video</h2>
            <p className="text-xs leading-relaxed text-muted">
              Describe the ad in a prompt, generate with Veo.
            </p>
          </div>
        </button>
      </div>
    </main>
  );
}
