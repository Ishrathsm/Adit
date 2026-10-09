import type { AspectRatio } from "./aspect-ratio";
import type { AdLength, Look, ShotSeconds, Tone } from "./creative-brief";
import { supabase } from "./supabase";

export type TemplateType = "poster" | "video";

// How a video template is made. The storyboard form starts from these settings (the user can
// still change them) and the director follows the template's notes (template_prompt). The sample
// film itself is thumbnail_url.
export interface VideoRecipe {
  tone: Tone;
  look: Look;
  // One shot plan per length offered, e.g. 15s = 2 x 6s and 30s = 4 x 6s, each plus the end card.
  plans: { length: AdLength; shotCount: number; shotSeconds: ShotSeconds }[];
  voiceover: boolean;
  // A short, small, silent loop of the sample played on hover in the gallery.
  hoverUrl: string | null;
  // Length of the sample film, shown in the preview.
  sampleSeconds: number;
  // What the user brings, listed in the preview ("A product photo", "Your offer in one line").
  provide: string[];
}

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
  // Video templates only.
  recipe: VideoRecipe | null;
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
  recipe?: VideoRecipe | null;
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
      ...(input.recipe ? { recipe: input.recipe } : {}),
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
  patch: { thumbnailUrl?: string; templatePrompt?: string; description?: string | null; aspectRatio?: AspectRatio; recipe?: VideoRecipe },
): Promise<void> {
  const { error } = await supabase
    .from("templates")
    .update({
      ...(patch.thumbnailUrl !== undefined ? { thumbnail_url: patch.thumbnailUrl } : {}),
      ...(patch.templatePrompt !== undefined ? { template_prompt: patch.templatePrompt } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.aspectRatio !== undefined ? { aspect_ratio: patch.aspectRatio } : {}),
      ...(patch.recipe !== undefined ? { recipe: patch.recipe } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}
