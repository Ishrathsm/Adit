import type { CreativeBrief } from "./creative-brief";
import { supabase } from "./supabase";

export const SHOT_CHOICE_COUNT = 2;

export type StoryboardStatus = "drafting" | "generating_video" | "completed" | "failed";
export type ShotStatus = "pending" | "choices_ready" | "video_ready" | "failed";

export type ReferenceImageRole = "subject" | "style";

export interface StoryboardRow {
  id: string;
  project_id: string;
  concept: string;
  shot_count: number;
  shot_duration_seconds: number;
  aspect_ratio: string;
  reference_image_url: string | null;
  reference_image_role: ReferenceImageRole | null;
  look_sheet: string | null;
  creative_brief: CreativeBrief | null;
  status: StoryboardStatus;
  output_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryboardShotRow {
  id: string;
  storyboard_id: string;
  shot_index: number;
  description: string;
  choice_urls: string[] | null;
  selected_choice: number | null;
  video_url: string | null;
  status: ShotStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStoryboardOptions {
  aspectRatio: string;
  referenceImageUrl?: string | null;
  referenceImageRole?: ReferenceImageRole | null;
  lookSheet?: string | null;
  creativeBrief?: CreativeBrief | null;
}

export async function createStoryboard(
  projectId: string,
  concept: string,
  shotCount: number,
  shotDurationSeconds: number,
  options: CreateStoryboardOptions,
): Promise<StoryboardRow> {
  const { data, error } = await supabase
    .from("storyboards")
    .insert({
      project_id: projectId,
      concept,
      shot_count: shotCount,
      shot_duration_seconds: shotDurationSeconds,
      aspect_ratio: options.aspectRatio,
      reference_image_url: options.referenceImageUrl ?? null,
      reference_image_role: options.referenceImageRole ?? null,
      look_sheet: options.lookSheet ?? null,
      creative_brief: options.creativeBrief ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createShots(storyboardId: string, descriptions: string[]): Promise<StoryboardShotRow[]> {
  const rows = descriptions.map((description, shot_index) => ({
    storyboard_id: storyboardId,
    shot_index,
    description,
  }));
  const { data, error } = await supabase.from("storyboard_shots").insert(rows).select();
  if (error) throw error;
  return data;
}

export async function getStoryboard(userId: string, id: string): Promise<StoryboardRow | null> {
  const { data, error } = await supabase
    .from("storyboards")
    .select("*, projects!inner(user_id)")
    .eq("id", id)
    .eq("projects.user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { projects: _projects, ...storyboard } = data as StoryboardRow & { projects: unknown };
  return storyboard;
}

// Unscoped lookup for internal use (worker), which has no authenticated user context.
export async function getStoryboardById(id: string): Promise<StoryboardRow | null> {
  const { data, error } = await supabase.from("storyboards").select().eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listShots(storyboardId: string): Promise<StoryboardShotRow[]> {
  const { data, error } = await supabase
    .from("storyboard_shots")
    .select()
    .eq("storyboard_id", storyboardId)
    .order("shot_index", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getShot(id: string): Promise<StoryboardShotRow | null> {
  const { data, error } = await supabase.from("storyboard_shots").select().eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateShot(id: string, patch: Partial<StoryboardShotRow>): Promise<void> {
  const { error } = await supabase
    .from("storyboard_shots")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function selectShotChoice(id: string, choiceIndex: number): Promise<StoryboardShotRow> {
  // Picking a new choice invalidates any previously generated video for this shot.
  const { data, error } = await supabase
    .from("storyboard_shots")
    .update({ selected_choice: choiceIndex, video_url: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStoryboardStatus(
  id: string,
  patch: Partial<Pick<StoryboardRow, "status" | "output_url" | "error">>,
): Promise<void> {
  const { error } = await supabase
    .from("storyboards")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
