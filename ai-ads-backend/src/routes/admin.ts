import { Router } from "express";
import type { User } from "@supabase/supabase-js";
import type { AuthedRequest } from "../middleware/auth";
import { type AccountAdminPatch, type AccountRow, type AccountType, listAccounts, type Plan, updateAccount } from "../lib/accounts";
import { effectiveFeatures, FEATURE_KEYS, FEATURES, type FeatureKey, PLAN_DEFAULTS } from "../lib/features";
import { supabase } from "../lib/supabase";

// Admin console API — mounted behind requireAuth + requireAdmin (see app.ts), so every route here
// is already restricted to admins server-side. Uses the service-role client, which is also why the
// frontend never talks to auth.users directly.
export const adminRouter = Router();

interface Usage {
  projects: number;
  posters: number;
  videos: number;
  storyboards: number;
}

async function listAuthUsers(): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

// Usage counts per user, from projects → jobs / storyboards.
async function usageByUser(): Promise<Map<string, Usage>> {
  const [projects, jobs, storyboards] = await Promise.all([
    supabase.from("projects").select("id, user_id"),
    supabase.from("jobs").select("project_id, output_type"),
    supabase.from("storyboards").select("project_id"),
  ]);
  for (const r of [projects, jobs, storyboards]) if (r.error) throw r.error;
  const owner = new Map((projects.data ?? []).map((p) => [p.id as string, p.user_id as string]));
  const usage = new Map<string, Usage>();
  const bump = (userId: string | undefined, key: keyof Usage) => {
    if (!userId) return;
    const u = usage.get(userId) ?? { projects: 0, posters: 0, videos: 0, storyboards: 0 };
    u[key]++;
    usage.set(userId, u);
  };
  for (const p of projects.data ?? []) bump(p.user_id as string, "projects");
  for (const j of jobs.data ?? []) bump(owner.get(j.project_id as string), j.output_type === "poster" ? "posters" : "videos");
  for (const s of storyboards.data ?? []) bump(owner.get(s.project_id as string), "storyboards");
  return usage;
}

// How the user signs in — Supabase records every linked identity provider.
function providers(user: User): string[] {
  const list = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider as string | undefined];
  return [...new Set(list.filter((p): p is string => Boolean(p)))];
}

function summarize(user: User, account: AccountRow | null, usage: Usage | undefined) {
  return {
    id: user.id,
    email: user.email ?? null,
    providers: providers(user),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    // No account row = signed up but hasn't finished onboarding.
    onboarded: Boolean(account),
    accountType: account?.account_type ?? null,
    plan: account?.plan ?? "free",
    isAdmin: account?.is_admin ?? false,
    disabled: account?.disabled ?? false,
    featureOverrides: account?.feature_overrides ?? {},
    features: effectiveFeatures(account),
    usage: usage ?? { projects: 0, posters: 0, videos: 0, storyboards: 0 },
  };
}

// Feature registry + plan presets, for rendering the switches.
adminRouter.get("/features", (_req, res) => {
  res.json({ features: FEATURE_KEYS.map((key) => ({ key, ...FEATURES[key] })), planDefaults: PLAN_DEFAULTS });
});

adminRouter.get("/users", async (_req: AuthedRequest, res) => {
  try {
    const [users, accounts, usage] = await Promise.all([listAuthUsers(), listAccounts(), usageByUser()]);
    const accountById = new Map(accounts.map((a) => [a.user_id, a]));
    const rows = users
      .map((u) => summarize(u, accountById.get(u.id) ?? null, usage.get(u.id)))
      .sort((a, b) => (b.lastSignInAt ?? b.createdAt).localeCompare(a.lastSignInAt ?? a.createdAt));
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

adminRouter.get("/users/:id", async (req: AuthedRequest, res) => {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(req.params.id);
    if (error || !data.user) {
      res.status(404).json({ error: "user not found" });
      return;
    }
    const [accounts, usage, audit] = await Promise.all([
      supabase.from("accounts").select().eq("user_id", req.params.id).maybeSingle(),
      usageByUser(),
      supabase.from("admin_audit_log").select().eq("target_user_id", req.params.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (accounts.error) throw accounts.error;
    if (audit.error) throw audit.error;
    res.json({ user: summarize(data.user, accounts.data, usage.get(req.params.id)), audit: audit.data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

const PLANS: Plan[] = ["free", "pro"];
const ACCOUNT_TYPES: AccountType[] = ["individual", "organisation"];

adminRouter.patch("/users/:id", async (req: AuthedRequest, res) => {
  const targetId = req.params.id;
  const { plan, accountType, disabled, isAdmin, featureOverrides } = req.body ?? {};

  const patch: AccountAdminPatch = {};
  if (plan !== undefined) {
    if (!PLANS.includes(plan)) return void res.status(400).json({ error: `plan must be one of ${PLANS.join(", ")}` });
    patch.plan = plan;
  }
  if (accountType !== undefined) {
    if (!ACCOUNT_TYPES.includes(accountType)) return void res.status(400).json({ error: `accountType must be one of ${ACCOUNT_TYPES.join(", ")}` });
    patch.account_type = accountType;
  }
  if (disabled !== undefined) {
    if (typeof disabled !== "boolean") return void res.status(400).json({ error: "disabled must be a boolean" });
    patch.disabled = disabled;
  }
  if (isAdmin !== undefined) {
    if (typeof isAdmin !== "boolean") return void res.status(400).json({ error: "isAdmin must be a boolean" });
    patch.is_admin = isAdmin;
  }
  if (featureOverrides !== undefined) {
    // { key: true | false } sets an override; { key: null } clears it back to the plan default.
    if (typeof featureOverrides !== "object" || featureOverrides === null || Array.isArray(featureOverrides)) {
      return void res.status(400).json({ error: "featureOverrides must be an object" });
    }
    for (const [key, value] of Object.entries(featureOverrides)) {
      if (!FEATURE_KEYS.includes(key as FeatureKey)) return void res.status(400).json({ error: `unknown feature: ${key}` });
      if (value !== null && typeof value !== "boolean") return void res.status(400).json({ error: `featureOverrides.${key} must be true, false, or null` });
    }
  }
  // An admin can't lock themselves out or remove their own admin access.
  if (targetId === req.userId && (patch.disabled === true || patch.is_admin === false)) {
    return void res.status(400).json({ error: "you can't disable yourself or remove your own admin access" });
  }

  try {
    const { data: current, error: currentError } = await supabase.from("accounts").select().eq("user_id", targetId).maybeSingle();
    if (currentError) throw currentError;
    if (!current) return void res.status(409).json({ error: "this user hasn't finished onboarding yet, so there's no account to change" });

    if (featureOverrides !== undefined) {
      const merged: Record<string, boolean> = { ...(current.feature_overrides ?? {}) };
      for (const [key, value] of Object.entries(featureOverrides as Record<string, boolean | null>)) {
        if (value === null) delete merged[key];
        else merged[key] = value;
      }
      patch.feature_overrides = merged;
    }
    if (!Object.keys(patch).length) return void res.status(400).json({ error: "nothing to change" });

    // Disabling also bans the user at the auth level, so they can't sign in (or refresh tokens).
    if (patch.disabled !== undefined && patch.disabled !== current.disabled) {
      const { error } = await supabase.auth.admin.updateUserById(targetId, { ban_duration: patch.disabled ? "876000h" : "none" });
      if (error) throw error;
    }

    const updated = await updateAccount(targetId, patch);

    const details = Object.fromEntries(
      Object.keys(patch).map((field) => [field, { from: (current as Record<string, unknown>)[field], to: (updated as unknown as Record<string, unknown>)[field] }]),
    );
    const { error: auditError } = await supabase
      .from("admin_audit_log")
      .insert({ admin_user_id: req.userId, target_user_id: targetId, action: "update_account", details });
    if (auditError) console.error("[admin] failed to write audit log:", auditError.message);

    res.json({ account: updated, features: effectiveFeatures(updated) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
