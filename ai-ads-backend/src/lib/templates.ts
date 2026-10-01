import type { AspectRatio } from "./aspect-ratio";
import { supabase } from "./supabase";

export type TemplateType = "poster" | "video";

export interface TemplateRow {
  id: string;
  type: TemplateType;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  template_prompt: string;
  // The ratio the template's own image was designed at — preselected on remix instead of a
  // single default, and never silently overridden once a job picks it up.
  aspect_ratio: AspectRatio;
  created_at: string;
}

export async function listTemplates(type?: TemplateType): Promise<TemplateRow[]> {
  let query = supabase.from("templates").select().order("created_at", { ascending: false });
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getTemplateById(id: string): Promise<TemplateRow | null> {
  const { data, error } = await supabase.from("templates").select().eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export interface CreateTemplateInput {
  type: TemplateType;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  templatePrompt: string;
  // Required, not defaulted: callers compute this from the template's own image (see
  // scripts/import-templates.ts) rather than relying on one ratio for every template.
  aspectRatio: AspectRatio;
}

export async function createTemplate(input: CreateTemplateInput): Promise<TemplateRow> {
  const { data, error } = await supabase
    .from("templates")
    .insert({
      type: input.type,
      name: input.name,
      description: input.description ?? null,
      thumbnail_url: input.thumbnailUrl ?? null,
      template_prompt: input.templatePrompt,
      aspect_ratio: input.aspectRatio,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Updates an existing template's synced fields (image/prompt/description/ratio may change
// locally after creation) — never touches name or type, which identify the row.
export async function updateTemplateSync(
  id: string,
  patch: { thumbnailUrl?: string; templatePrompt?: string; description?: string | null; aspectRatio?: AspectRatio },
): Promise<void> {
  const { error } = await supabase
    .from("templates")
    .update({
      ...(patch.thumbnailUrl !== undefined ? { thumbnail_url: patch.thumbnailUrl } : {}),
      ...(patch.templatePrompt !== undefined ? { template_prompt: patch.templatePrompt } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.aspectRatio !== undefined ? { aspect_ratio: patch.aspectRatio } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}
