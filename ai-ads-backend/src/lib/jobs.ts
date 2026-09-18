import { supabase } from "./supabase";

export type JobStatus = "queued" | "processing" | "completed" | "failed";
export type OutputType = "video" | "poster" | "gif";

export interface JobRow {
  id: string;
  project_id: string;
  status: JobStatus;
  prompt: string;
  output_type: OutputType;
  aspect_ratio: string;
  tagline: string | null;
  template_id: string | null;
  output_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJobOptions {
  outputType: OutputType;
  aspectRatio?: string;
  tagline?: string;
  templateId?: string;
}

export async function createJob(projectId: string, prompt: string, options: CreateJobOptions): Promise<JobRow> {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      project_id: projectId,
      prompt,
      output_type: options.outputType,
      ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
      tagline: options.tagline ?? null,
      template_id: options.templateId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getJob(id: string): Promise<JobRow | null> {
  const { data, error } = await supabase.from("jobs").select().eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateJobStatus(
  id: string,
  patch: Partial<Pick<JobRow, "status" | "output_url" | "error">>,
): Promise<void> {
  const { error } = await supabase
    .from("jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
