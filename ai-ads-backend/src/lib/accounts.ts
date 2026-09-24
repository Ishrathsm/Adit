import { supabase } from "./supabase";

export type AccountType = "individual" | "organisation";
export type Plan = "free" | "pro";

export interface AccountRow {
  user_id: string;
  account_type: AccountType;
  // Access control (changed only by admins, through the admin API or SQL).
  plan: Plan;
  is_admin: boolean;
  disabled: boolean;
  feature_overrides: Partial<Record<string, boolean>>;
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

export async function listAccounts(): Promise<AccountRow[]> {
  const { data, error } = await supabase.from("accounts").select();
  if (error) throw error;
  return data;
}

export type AccountAdminPatch = Partial<Pick<AccountRow, "account_type" | "plan" | "is_admin" | "disabled" | "feature_overrides">>;

export async function updateAccount(userId: string, patch: AccountAdminPatch): Promise<AccountRow> {
  const { data, error } = await supabase.from("accounts").update(patch).eq("user_id", userId).select().single();
  if (error) throw error;
  return data;
}
