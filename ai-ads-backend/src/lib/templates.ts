import { supabase } from "./supabase";

export type TemplateType = "poster" | "video";

export interface TemplateRow {
  id: string;
  type: TemplateType;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  template_prompt: string;
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
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
