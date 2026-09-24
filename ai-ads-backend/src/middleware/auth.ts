import type { NextFunction, Request, Response } from "express";
import { type AccountRow, getAccount } from "../lib/accounts";
import { effectiveFeatures, type FeatureKey } from "../lib/features";
import { supabase } from "../lib/supabase";

export interface AuthedRequest extends Request {
  userId?: string;
  // Null while the user hasn't finished onboarding (no account row yet).
  account?: AccountRow | null;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "missing bearer token" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "invalid or expired token" });
    return;
  }

  req.userId = data.user.id;
  req.account = await getAccount(data.user.id).catch(() => null);
  // Disabled accounts are also banned at the Supabase Auth level, but an already-issued token
  // stays valid until it expires — so block them here too.
  if (req.account?.disabled) {
    res.status(403).json({ error: "this account has been disabled" });
    return;
  }
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.account?.is_admin) {
    res.status(403).json({ error: "admin access required" });
    return;
  }
  next();
}

// Sends a 403 and returns false when the user's plan/overrides don't include the feature.
export function checkFeature(req: AuthedRequest, res: Response, feature: FeatureKey, label?: string): boolean {
  if (effectiveFeatures(req.account ?? null)[feature]) return true;
  res.status(403).json({ error: `${label ?? feature} is not enabled on your account`, feature });
  return false;
}
