import { supabase } from "./supabase";

export type AccountType = "individual" | "organisation";

export interface AccountRow {
  user_id: string;
  account_type: AccountType;
  created_at: string;
}

export async function getAccount(userId: string): Promise<AccountRow | null> {
  const { data, error } = await supabase.from("accounts").select().eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createAccount(userId: string, accountType: AccountType): Promise<AccountRow> {
  const { data, error } = await supabase
    .from("accounts")
    .insert({ user_id: userId, account_type: accountType })
    .select()
    .single();
  if (error) throw error;
  return data;
}
