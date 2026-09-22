"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  Image as ImageIcon,
  MoreVertical,
  Pencil,
  Trash2,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { clearDraftPrompt, peekDraftPrompt, savePrefillForProject } from "@/lib/draft-prompt";
import {
  createFolder,
  createProject,
  deleteFolder,
  deleteProject,
  getAccount,
  getProduct,
  listFolders,
  listProjects,
  updateProject,
  type Account,
  type Folder,
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

function relativeDate(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

type DeleteTarget = { kind: "project" | "folder"; id: string; name: string };

function ProjectsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("product");
  const folderId = searchParams.get("folder");

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [accountChecked, setAccountChecked] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draftHandledRef = useRef(false);

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  function refreshProjects() {
    listProjects({ productId: productId ?? undefined, folderId: folderId ?? undefined })
      .then(({ projects }) => setProjects(projects))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(() => {
    refreshProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads productId/folderId directly, re-runs whenever either changes
  }, [productId, folderId]);

  useEffect(() => {
    listFolders(productId ?? undefined)
      .then(({ folders }) => setFolders(folders))
      .catch(() => {
        /* folders are an organizational enhancement — a load failure shouldn't block the page */
      });
  }, [productId]);

  useEffect(() => {
    getAccount()
      .then(({ account }) => setAccount(account))
      .catch(() => {
        /* non-fatal — only used to gate Organisation project creation */
      })
      .finally(() => setAccountChecked(true));
  }, []);

  // Hero hand-off: if the visitor typed a prompt on the landing page before signing up,
  // spin up their first project from it automatically (no credits spent — this only
  // creates the project shell; generating still requires an explicit click).
  useEffect(() => {
    if (!accountChecked || draftHandledRef.current) return;
    const draft = peekDraftPrompt();
    if (!draft || !account) return;
    if (account.account_type === "organisation" && !productId) return; // wait for product context

    draftHandledRef.current = true;
    clearDraftPrompt();

    const apiType: ProjectType = draft.projectType;
    const name = apiType === "video" ? "Untitled Video Ad" : "Untitled Poster Ad";
    const useStoryboard = draft.projectType === "video" && draft.storyboard;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreating(true);
    createProject(name, apiType, productId ?? undefined)
      .then(({ project }) => {
        savePrefillForProject(project.id, draft.prompt);
        router.push(useStoryboard ? `/projects/${project.id}/storyboard` : `/projects/${project.id}`);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setCreating(false);
      });
  }, [accountChecked, account, productId, router]);

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

  const activeFolder = folderId ? (folders.find((f) => f.id === folderId) ?? null) : null;

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

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    setCreatingFolder(false);
    setNewFolderName("");
    if (!name) return;
    try {
      const { folder } = await createFolder(name, productId ?? undefined);
      setFolders((prev) => [...prev, folder]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRenameSubmit(project: Project) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === project.name) return;
    try {
      const { project: updated } = await updateProject(project.id, { name });
      setProjects((prev) => prev?.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)) ?? prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleMove(project: Project, targetFolderId: string | null) {
    setMenuOpenFor(null);
    try {
      await updateProject(project.id, { folderId: targetFolderId });
      refreshProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === "project") {
        await deleteProject(deleteTarget.id);
        setProjects((prev) => prev?.filter((p) => p.id !== deleteTarget.id) ?? prev);
      } else {
        await deleteFolder(deleteTarget.id);
        setFolders((prev) => prev.filter((f) => f.id !== deleteTarget.id));
        if (folderId === deleteTarget.id) router.push("/projects");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleteTarget(null);
    }
  }

  const emptyStateTitle = activeFolder ? `No projects in ${activeFolder.name} yet` : "No projects yet";

  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
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

      <AppHeader
        back={
          activeFolder
            ? { href: `/projects${productId ? `?product=${productId}` : ""}`, label: "All projects" }
            : undefined
        }
      />

      {activeProduct && (
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1 text-xs text-muted">
            <Building2 size={12} />
            {activeProduct.name}
          </span>
        </div>
      )}

      {activeFolder && <h1 className="mt-6 text-xl font-semibold tracking-tight">{activeFolder.name}</h1>}

      {error && (
        <p className="mt-6 rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {!activeFolder && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {folders.map((folder) => (
            <div key={folder.id} className="group relative">
              <button
                onClick={() =>
                  router.push(`/projects?folder=${folder.id}${productId ? `&product=${productId}` : ""}`)
                }
                className="inline-flex items-center gap-2 rounded-full border border-border-strong px-4 py-2 text-sm transition-colors hover:bg-white/5"
              >
                <FolderIcon size={14} />
                {folder.name}
              </button>
              <button
                onClick={() => setDeleteTarget({ kind: "folder", id: folder.id, name: folder.name })}
                aria-label={`Delete ${folder.name}`}
                className="absolute -top-1.5 -right-1.5 hidden h-5 w-5 items-center justify-center rounded-full border border-border-strong bg-background text-muted transition-colors hover:text-red-400 group-hover:flex"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
          {creatingFolder ? (
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") {
                  setCreatingFolder(false);
                  setNewFolderName("");
                }
              }}
              onBlur={handleCreateFolder}
              placeholder="Folder name"
              className="w-36 rounded-full border border-border-subtle bg-background px-4 py-2 text-sm outline-none focus:border-border-strong"
            />
          ) : (
            <button
              onClick={() => setCreatingFolder(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-strong px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              <FolderPlus size={14} />
              New folder
            </button>
          )}
        </div>
      )}

      {projects && projects.length > 0 ? (
        <div className="mt-6 grid gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="rgb-border flex flex-col gap-3 p-3">
              <button
                onClick={() => router.push(`/projects/${project.id}`)}
                className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface"
              >
                {project.preview_url ? (
                  project.preview_type === "video" ? (
                    <video
                      src={project.preview_url}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- remote, dynamically-generated image
                    <img src={project.preview_url} alt={project.name} className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted">
                    {project.type === "video" ? <Video size={24} /> : <ImageIcon size={24} />}
                  </div>
                )}
              </button>

              <div className="flex items-start justify-between gap-2">
                <div
                  onClick={() => renamingId !== project.id && router.push(`/projects/${project.id}`)}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  {renamingId === project.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSubmit(project);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      onBlur={() => handleRenameSubmit(project)}
                      className="w-full rounded-lg border border-border-strong bg-background px-2 py-1 text-sm outline-none"
                    />
                  ) : (
                    <h2 className="truncate text-sm font-medium">{project.name}</h2>
                  )}
                  <p className="text-xs text-muted">
                    {project.type} · {relativeDate(project.created_at)}
                  </p>
                </div>

                <div className="relative shrink-0">
                  <button
                    onClick={() => setMenuOpenFor(menuOpenFor === project.id ? null : project.id)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {menuOpenFor === project.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpenFor(null)} />
                      <div className="absolute top-8 right-0 z-20 w-44 rounded-2xl border border-border-strong bg-surface p-1.5 shadow-lg">
                        <button
                          onClick={() => {
                            setRenamingId(project.id);
                            setRenameValue(project.name);
                            setMenuOpenFor(null);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                        >
                          <Pencil size={12} /> Rename
                        </button>
                        {folders.length > 0 && (
                          <div className="my-1 border-t border-border-subtle pt-1">
                            <p className="px-3 pb-1 text-[10px] font-medium tracking-wide text-muted uppercase">
                              Move to
                            </p>
                            {folders
                              .filter((f) => f.id !== project.folder_id)
                              .map((f) => (
                                <button
                                  key={f.id}
                                  onClick={() => handleMove(project, f.id)}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                                >
                                  <FolderIcon size={12} /> {f.name}
                                </button>
                              ))}
                            {project.folder_id && (
                              <button
                                onClick={() => handleMove(project, null)}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                              >
                                <FolderInput size={12} /> Uncategorized
                              </button>
                            )}
                          </div>
                        )}
                        <div className="mt-1 border-t border-border-subtle pt-1">
                          <button
                            onClick={() => {
                              setDeleteTarget({ kind: "project", id: project.id, name: project.name });
                              setMenuOpenFor(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
          <div className="rgb-border flex h-16 w-16 items-center justify-center">
            <FolderPlus size={22} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{emptyStateTitle}</h1>
            <p className="mx-auto max-w-sm text-sm text-muted">
              Every ad you make lives in a project. Start your first one below.
            </p>
          </div>
          <Button onClick={() => startProject("video")} disabled={creating}>
            {creating ? "Creating…" : "New Project"}
          </Button>
        </div>
      )}

      <div className="mt-6 grid gap-4 pb-10 sm:grid-cols-2">
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete "${deleteTarget?.name}"?`}
        description={
          deleteTarget?.kind === "folder"
            ? "Its projects won't be deleted — they'll move back to Uncategorized."
            : "This permanently deletes the project and everything generated in it."
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
