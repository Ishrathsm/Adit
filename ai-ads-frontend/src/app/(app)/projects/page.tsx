"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Download,
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  Image as ImageIcon,
  LayoutTemplate,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  Video,
  Wand2,
} from "lucide-react";
import { AnimatedFolder } from "@/components/ui/3d-folder";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { BackLink } from "@/components/back-link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CreateHero } from "@/components/create-hero";
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
  renameFolder,
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

const DRAFT_FRESHNESS_MS = 5 * 60_000;

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
  // Position is captured at click time (not just an id) because the menu is portaled to
  // document.body — it has to be positioned in fixed viewport coordinates to escape the
  // project card's `.rgb-border` stacking context (`isolation: isolate` traps any z-index
  // set inside it, so a normal absolute/z-20 dropdown renders behind sibling cards).
  const [menuOpenFor, setMenuOpenFor] = useState<{ id: string; top: number; right: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [folderMenuOpenFor, setFolderMenuOpenFor] = useState<{ id: string; top: number; right: number } | null>(
    null,
  );
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [previewSelection, setPreviewSelection] = useState<{ index: number; sourceRect: DOMRect } | null>(null);
  const previewCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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
  //
  // Org accounts wait in sessionStorage until a `?product=` is picked, and that can be
  // several navigations later than the draft itself — so a stale draft (left over from an
  // earlier visit, or the tab just sitting open) must not resurrect and hijack an unrelated
  // later click into an existing product. Only honor a draft typed in the last few minutes.
  useEffect(() => {
    if (!accountChecked || draftHandledRef.current) return;
    const draft = peekDraftPrompt();
    if (!draft || !account) return;
    if (Date.now() - draft.ts > DRAFT_FRESHNESS_MS) {
      clearDraftPrompt();
      return;
    }
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

  // Only meaningful at the top level, where `projects` holds every project regardless of
  // folder — inside a folder the list is already filtered, so counts wouldn't be global.
  const folderCounts = new Map<string, number>();
  const folderPreviews = new Map<string, Project[]>();
  if (!activeFolder) {
    for (const project of projects ?? []) {
      if (!project.folder_id) continue;
      folderCounts.set(project.folder_id, (folderCounts.get(project.folder_id) ?? 0) + 1);
      const previews = folderPreviews.get(project.folder_id) ?? [];
      if (previews.length < 4) previews.push(project);
      folderPreviews.set(project.folder_id, previews);
    }
  }

  const previewableProjects = (projects ?? [])
    .filter((p) => p.preview_url)
    .map((p) => ({ id: p.id, image: p.preview_url as string, title: p.name, mediaType: p.preview_type }));

  function openPreview(project: Project) {
    const index = previewableProjects.findIndex((p) => p.id === project.id);
    const cardEl = previewCardRefs.current[project.id];
    if (index === -1 || !cardEl) {
      router.push(`/projects/${project.id}`);
      return;
    }
    setPreviewSelection({ index, sourceRect: cardEl.getBoundingClientRect() });
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

  async function handleRenameFolderSubmit(folder: Folder) {
    const name = renameFolderValue.trim();
    setRenamingFolderId(null);
    if (!name || name === folder.name) return;
    try {
      const { folder: updated } = await renameFolder(folder.id, name);
      setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
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
    <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-10 sm:px-10">
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

      {activeFolder && (
        <BackLink href={`/projects${productId ? `?product=${productId}` : ""}`} label="All projects" />
      )}

      {activeProduct && (
        <div className="mt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1 text-xs text-muted">
            <Building2 size={12} />
            {activeProduct.name}
          </span>
        </div>
      )}

      {activeFolder && <h1 className="mt-6 text-xl font-semibold tracking-tight">{activeFolder.name}</h1>}

      {!activeFolder && (
        <div className="mt-8 flex flex-col items-center gap-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">What will you create today?</h1>
          {creating ? (
            <p className="text-sm text-muted">Setting up your project…</p>
          ) : (
            <CreateHero account={account} productId={productId} />
          )}
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {!activeFolder && (folders.length > 0 || creatingFolder) && (
        <div className="mt-6">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Folders</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {folders.map((folder) => {
              const count = folderCounts.get(folder.id) ?? 0;
              const previewItems = (folderPreviews.get(folder.id) ?? []).filter((p) => p.preview_url);
              const isRenaming = renamingFolderId === folder.id;
              return (
                <div key={folder.id} className="relative">
                  <AnimatedFolder
                    title={folder.name}
                    totalCount={count}
                    className="w-full"
                    onOpen={() =>
                      router.push(`/projects?folder=${folder.id}${productId ? `&product=${productId}` : ""}`)
                    }
                    projects={previewItems.map((p) => ({
                      id: p.id,
                      image: p.preview_url as string,
                      title: p.name,
                      mediaType: p.preview_type,
                    }))}
                    renaming={isRenaming}
                    renameValue={renameFolderValue}
                    onRenameChange={setRenameFolderValue}
                    onRenameSubmit={() => handleRenameFolderSubmit(folder)}
                    onRenameCancel={() => setRenamingFolderId(null)}
                  />

                  <div className="absolute top-3 right-3 z-20">
                    <button
                      onClick={(e) => {
                        if (folderMenuOpenFor?.id === folder.id) {
                          setFolderMenuOpenFor(null);
                          return;
                        }
                        const rect = e.currentTarget.getBoundingClientRect();
                        setFolderMenuOpenFor({
                          id: folder.id,
                          top: rect.bottom + 4,
                          right: window.innerWidth - rect.right,
                        });
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface/80 text-muted backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-foreground"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {folderMenuOpenFor?.id === folder.id &&
                      createPortal(
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setFolderMenuOpenFor(null)} />
                          <div
                            style={{ top: folderMenuOpenFor.top, right: folderMenuOpenFor.right }}
                            className="fixed z-50 w-44 rounded-2xl border border-border-strong bg-surface p-1.5 shadow-lg"
                          >
                            <button
                              onClick={() => {
                                setRenamingFolderId(folder.id);
                                setRenameFolderValue(folder.name);
                                setFolderMenuOpenFor(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                            >
                              <Pencil size={12} /> Rename
                            </button>
                            <div className="mt-1 border-t border-border-subtle pt-1">
                              <button
                                onClick={() => {
                                  setDeleteTarget({ kind: "folder", id: folder.id, name: folder.name });
                                  setFolderMenuOpenFor(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-red-400 transition-colors hover:bg-red-500/10"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          </div>
                        </>,
                        document.body,
                      )}
                  </div>
                </div>
              );
            })}

            {creatingFolder ? (
              <div className="rgb-border flex flex-col gap-3 p-3">
                <div className="flex aspect-[2/1] w-full items-center justify-center rounded-xl bg-surface">
                  <FolderIcon size={40} className="text-muted" strokeWidth={1.5} />
                </div>
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
                  className="w-full rounded-lg border border-border-strong bg-background px-2.5 py-1.5 text-sm outline-none"
                />
              </div>
            ) : (
              <button
                onClick={() => setCreatingFolder(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong p-3 text-muted transition-colors hover:text-foreground"
              >
                <div className="flex aspect-[2/1] w-full items-center justify-center">
                  <FolderPlus size={32} strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium">New folder</p>
              </button>
            )}
          </div>
        </div>
      )}

      {projects && projects.length > 0 ? (
        <div className="mt-6">
          {!activeFolder && folders.length > 0 && (
            <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Projects</p>
          )}
          <div className="grid gap-4 pb-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
            <div key={project.id} className="rgb-border flex flex-col gap-3 p-3">
              <button
                ref={(el) => {
                  previewCardRefs.current[project.id] = el;
                }}
                onClick={() => openPreview(project)}
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
                    onClick={(e) => {
                      if (menuOpenFor?.id === project.id) {
                        setMenuOpenFor(null);
                        return;
                      }
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMenuOpenFor({ id: project.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {menuOpenFor?.id === project.id &&
                    createPortal(
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpenFor(null)} />
                        <div
                          style={{ top: menuOpenFor.top, right: menuOpenFor.right }}
                          className="fixed z-50 w-44 rounded-2xl border border-border-strong bg-surface p-1.5 shadow-lg"
                        >
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
                      </>,
                      document.body,
                    )}
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      ) : !activeFolder && folders.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 py-10 text-center">
          <h2 className="text-sm font-medium text-muted">How it works</h2>
          <div className="mt-2 grid w-full max-w-2xl gap-4 sm:grid-cols-3">
            {[
              { icon: MessageSquare, title: "1. Describe", body: "Type what the ad is for in the box above." },
              { icon: Wand2, title: "2. Generate", body: "Pick Poster or Video and hit Create." },
              { icon: Download, title: "3. Download", body: "Review the result and export it when it's ready." },
            ].map((step) => (
              <div key={step.title} className="rgb-border flex flex-col items-center gap-2 p-5 text-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-muted">
                  <step.icon size={16} />
                </div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rgb-border flex h-16 w-16 items-center justify-center">
            <FolderPlus size={22} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{emptyStateTitle}</h1>
          <p className="mx-auto max-w-sm text-sm text-muted">
            Describe your first ad above and we&apos;ll take it from there.
          </p>
        </div>
      )}

      {!activeFolder && (
        <div id="templates" className="mt-14 scroll-mt-6 pb-10">
          <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Templates</p>
          <div className="rgb-border flex flex-col items-center gap-2 p-8 text-center opacity-70">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-strong">
              <LayoutTemplate size={18} />
            </div>
            <p className="text-sm font-medium">Templates are coming soon</p>
            <p className="max-w-sm text-xs text-muted">
              Ready-made starting points for common ad formats — on the way.
            </p>
          </div>
        </div>
      )}

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

      <ImageLightbox
        projects={previewableProjects}
        currentIndex={previewSelection?.index ?? 0}
        isOpen={previewSelection !== null}
        sourceRect={previewSelection?.sourceRect ?? null}
        onClose={() => setPreviewSelection(null)}
        onCloseComplete={() => setPreviewSelection(null)}
        onNavigate={(index) => setPreviewSelection((prev) => (prev ? { ...prev, index } : prev))}
      />
    </main>
  );
}
