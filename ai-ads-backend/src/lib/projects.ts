import { supabase } from "./supabase";

export type ProjectType = "poster" | "video";

export interface ProjectRow {
  id: string;
  user_id: string;
  product_id: string | null;
  folder_id: string | null;
  name: string;
  type: ProjectType;
  created_at: string;
}

export interface ListProjectsOptions {
  productId?: string | null;
  // undefined = no folder filter (all projects), "uncategorized" = folder_id is null,
  // any other string = that specific folder's projects.
  folderId?: string;
}

export async function listProjects(userId: string, options: ListProjectsOptions = {}): Promise<ProjectRow[]> {
  let query = supabase.from("projects").select().eq("user_id", userId);
  if (options.productId) query = query.eq("product_id", options.productId);
  if (options.folderId === "uncategorized") {
    query = query.is("folder_id", null);
  } else if (options.folderId) {
    query = query.eq("folder_id", options.folderId);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProject(userId: string, id: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from("projects")
    .select()
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Unscoped lookup for internal use (worker), which has no authenticated user context.
export async function getProjectById(id: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase.from("projects").select().eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProject(
  userId: string,
  name: string,
  type: ProjectType,
  productId: string | null,
): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, name, type, product_id: productId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface UpdateProjectOptions {
  name?: string;
  // null explicitly un-files the project (moves it to Uncategorized).
  folderId?: string | null;
}

export async function updateProject(
  userId: string,
  id: string,
  options: UpdateProjectOptions,
): Promise<ProjectRow | null> {
  const patch: Record<string, unknown> = {};
  if (options.name !== undefined) patch.name = options.name;
  if (options.folderId !== undefined) patch.folder_id = options.folderId;

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteProject(userId: string, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export type PreviewOutputType = "poster" | "video";

export interface ProjectPreview {
  url: string;
  type: PreviewOutputType;
}

// A project's "latest output" can come from either the direct job flow or the storyboard
// flow — both write into separate tables with their own project_id, so this checks both
// and keeps whichever is more recent per project.
export async function getProjectPreviews(projectIds: string[]): Promise<Map<string, ProjectPreview>> {
  const previews = new Map<string, { url: string; type: PreviewOutputType; updatedAt: string }>();
  if (projectIds.length === 0) return previews;

  const [{ data: jobs, error: jobsError }, { data: storyboards, error: storyboardsError }] = await Promise.all([
    supabase
      .from("jobs")
      .select("project_id, output_url, output_type, updated_at")
      .in("project_id", projectIds)
      .eq("status", "completed")
      .order("updated_at", { ascending: false }),
    supabase
      .from("storyboards")
      .select("project_id, output_url, updated_at")
      .in("project_id", projectIds)
      .eq("status", "completed")
      .order("updated_at", { ascending: false }),
  ]);
  if (jobsError) throw jobsError;
  if (storyboardsError) throw storyboardsError;

  const consider = (projectId: string, url: string | null, type: PreviewOutputType, updatedAt: string) => {
    if (!url) return;
    const existing = previews.get(projectId);
    if (!existing || updatedAt > existing.updatedAt) {
      previews.set(projectId, { url, type, updatedAt });
    }
  };

  for (const job of jobs ?? []) {
    consider(job.project_id, job.output_url, job.output_type === "poster" ? "poster" : "video", job.updated_at);
  }
  for (const storyboard of storyboards ?? []) {
    consider(storyboard.project_id, storyboard.output_url, "video", storyboard.updated_at);
  }

  return new Map(Array.from(previews, ([id, { url, type }]) => [id, { url, type }]));
}
