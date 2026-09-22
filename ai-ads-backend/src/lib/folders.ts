import { supabase } from "./supabase";

export interface FolderRow {
  id: string;
  user_id: string;
  product_id: string | null;
  name: string;
  created_at: string;
}

export async function listFolders(userId: string, productId: string | null): Promise<FolderRow[]> {
  let query = supabase.from("folders").select().eq("user_id", userId);
  query = productId ? query.eq("product_id", productId) : query.is("product_id", null);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createFolder(userId: string, name: string, productId: string | null): Promise<FolderRow> {
  const { data, error } = await supabase
    .from("folders")
    .insert({ user_id: userId, name, product_id: productId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function renameFolder(userId: string, id: string, name: string): Promise<FolderRow | null> {
  const { data, error } = await supabase
    .from("folders")
    .update({ name })
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteFolder(userId: string, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("folders")
    .delete()
    .eq("user_id", userId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
