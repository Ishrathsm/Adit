import { supabase } from "./supabase";

export type ProjectType = "poster" | "video";

export interface ProjectRow {
  id: string;
  user_id: string;
  product_id: string | null;
  name: string;
  type: ProjectType;
  created_at: string;
}

export async function listProjects(userId: string): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from("projects")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
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
