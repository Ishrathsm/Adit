import { supabase } from "./supabase";

export interface ProductRow {
  id: string;
  user_id: string;
  name: string;
  questionnaire_completed: boolean;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  font: string | null;
  tagline: string | null;
  brand_rules: string | null;
  created_at: string;
}

export interface BrandKitInput {
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  font: string;
  tagline?: string | null;
  brandRules: string;
}

export async function listProducts(userId: string): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getProduct(userId: string, id: string): Promise<ProductRow | null> {
  const { data, error } = await supabase.from("products").select().eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// Unscoped lookup for internal use (worker), which has no authenticated user context.
export async function getProductById(id: string): Promise<ProductRow | null> {
  const { data, error } = await supabase.from("products").select().eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProduct(userId: string, name: string): Promise<ProductRow> {
  const { data, error } = await supabase.from("products").insert({ user_id: userId, name }).select().single();
  if (error) throw error;
  return data;
}

// Individual accounts have exactly one implicit brand kit — this resolves it, creating it on
// first use, so projects can be linked to it without the user ever seeing a product picker.
export async function getOrCreateDefaultProduct(userId: string): Promise<ProductRow> {
  const existing = await listProducts(userId);
  if (existing[0]) return existing[0];
  return createProduct(userId, "My brand");
}

export async function completeQuestionnaire(userId: string, id: string, brand: BrandKitInput): Promise<ProductRow> {
  const { data, error } = await supabase
    .from("products")
    .update({
      questionnaire_completed: true,
      logo_url: brand.logoUrl ?? null,
      primary_color: brand.primaryColor ?? null,
      secondary_color: brand.secondaryColor ?? null,
      font: brand.font,
      tagline: brand.tagline ?? null,
      brand_rules: brand.brandRules,
    })
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
