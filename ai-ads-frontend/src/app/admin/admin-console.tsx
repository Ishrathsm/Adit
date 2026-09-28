"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import {
  adminGetUser,
  adminListFeatures,
  adminListUsers,
  adminSendPasswordReset,
  adminUpdateUser,
  type AccountType,
  type AdminAuditEntry,
  type AdminFeatureInfo,
  type AdminUser,
  type AdminUserPatch,
  type FeatureKey,
  type Features,
  type Plan,
  ROLES,
  type Role,
} from "@/lib/api";

// Admin console: who's on which plan/account type, how they sign in, what they've made, roles, and
// per-user feature switches. Every call is admin-checked server-side; this page only renders.

const ROLE_LABELS: Record<Role, string> = { admin: "Admin", user: "User" };

type StatusFilter = "all" | "active" | "disabled" | "not_onboarded" | "admins";

function pillClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
    active ? "border-transparent bg-button-bg text-button-fg" : "border-border-strong text-foreground hover:bg-white/5"
  }`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function providerLabel(provider: string) {
  return provider === "google" ? "Google" : provider === "email" ? "Email" : provider;
}

export function AdminConsole() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [features, setFeatures] = useState<AdminFeatureInfo[]>([]);
  const [planDefaults, setPlanDefaults] = useState<Record<Plan, Features> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | Plan>("all");
  const [loginFilter, setLoginFilter] = useState<"all" | "google" | "email">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function load() {
    Promise.all([adminListUsers(), adminListFeatures()])
      .then(([{ users }, { features, planDefaults }]) => {
        setUsers(users);
        setFeatures(features);
        setPlanDefaults(planDefaults);
      })
      .catch((err: Error) => {
        if (/admin access required|403/i.test(err.message)) setForbidden(true);
        else setError(err.message);
      });
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !(u.email ?? "").toLowerCase().includes(q)) return false;
      if (planFilter !== "all" && u.plan !== planFilter) return false;
      if (loginFilter !== "all" && !u.providers.includes(loginFilter)) return false;
      if (statusFilter === "active" && (u.disabled || !u.onboarded)) return false;
      if (statusFilter === "disabled" && !u.disabled) return false;
      if (statusFilter === "not_onboarded" && u.onboarded) return false;
      if (statusFilter === "admins" && u.role !== "admin") return false;
      return true;
    });
  }, [users, search, planFilter, loginFilter, statusFilter]);

  const stats = useMemo(() => {
    const list = users ?? [];
    return [
      { label: "Users", value: list.length },
      { label: "Pro", value: list.filter((u) => u.plan === "pro").length },
      { label: "Google sign-in", value: list.filter((u) => u.providers.includes("google")).length },
      { label: "Email sign-in", value: list.filter((u) => u.providers.includes("email")).length },
      { label: "Not onboarded", value: list.filter((u) => !u.onboarded).length },
      { label: "Disabled", value: list.filter((u) => u.disabled).length },
    ];
  }, [users]);

  if (forbidden) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col px-6 py-10 sm:px-10">
        <p className="text-sm text-muted">
          This page is only available to admins.{" "}
          <Link href="/projects" className="text-foreground underline underline-offset-4">
            Back to the app
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex max-w-6xl flex-col px-6 py-10 sm:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Users &amp; access</h1>
      </div>

      {error && <p className="mt-6 rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm text-red-400">{error}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rgb-border flex flex-col gap-1 p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="text-xl font-semibold">{users ? s.value : "—"}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-background px-4 py-2">
          <Search size={14} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Plan</span>
          {(["all", "free", "pro"] as const).map((p) => (
            <button key={p} onClick={() => setPlanFilter(p)} className={pillClass(planFilter === p)}>
              {p === "all" ? "All" : p === "free" ? "Free" : "Pro"}
            </button>
          ))}
          <span className="ml-3 text-muted">Sign-in</span>
          {(["all", "google", "email"] as const).map((p) => (
            <button key={p} onClick={() => setLoginFilter(p)} className={pillClass(loginFilter === p)}>
              {p === "all" ? "All" : providerLabel(p)}
            </button>
          ))}
          <span className="ml-3 text-muted">Status</span>
          {(
            [
              ["all", "All"],
              ["active", "Active"],
              ["not_onboarded", "Not onboarded"],
              ["disabled", "Disabled"],
              ["admins", "Admins"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} onClick={() => setStatusFilter(value)} className={pillClass(statusFilter === value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rgb-border mt-4 overflow-x-auto">
        {!users ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Loading users…
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-border-subtle">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Sign-in</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Made</th>
                <th className="px-4 py-3 font-medium">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className={`cursor-pointer border-b border-border-subtle transition-colors last:border-0 hover:bg-white/5 ${selectedId === u.id ? "bg-white/5" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{u.email ?? u.id}</span>
                      {u.role === "admin" && <ShieldCheck size={13} className="shrink-0 text-muted" aria-label="Admin" />}
                      {u.disabled && <span className="rounded-full border border-red-400/50 px-2 py-0.5 text-[10px] text-red-400">Disabled</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{u.providers.map(providerLabel).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {u.onboarded ? (u.accountType === "organisation" ? "Organisation" : "Individual") : "Not onboarded"}
                  </td>
                  <td className="px-4 py-3">{u.plan === "pro" ? "Pro" : "Free"}</td>
                  <td className="px-4 py-3 text-muted">
                    {u.usage.posters} posters · {u.usage.videos + u.usage.storyboards} videos
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(u.lastSignInAt)}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                    No users match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && planDefaults && (
        <UserPanel
          key={selectedId}
          userId={selectedId}
          features={features}
          planDefaults={planDefaults}
          onClose={() => setSelectedId(null)}
          onChanged={(updated) => setUsers((list) => list?.map((u) => (u.id === updated.id ? updated : u)) ?? null)}
        />
      )}
    </main>
  );
}

function UserPanel({
  userId,
  features,
  planDefaults,
  onClose,
  onChanged,
}: {
  userId: string;
  features: AdminFeatureInfo[];
  planDefaults: Record<Plan, Features>;
  onClose: () => void;
  onChanged: (user: AdminUser) => void;
}) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Two-step confirm for disabling instead of a browser dialog.
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  async function sendReset() {
    setSaving(true);
    setError(null);
    setResetStatus(null);
    try {
      const { email } = await adminSendPasswordReset(userId);
      setResetStatus(`Password reset email sent to ${email}.`);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function refresh() {
    adminGetUser(userId)
      .then(({ user, audit }) => {
        setUser(user);
        setAudit(audit);
        onChanged(user);
      })
      .catch((err: Error) => setError(err.message));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per selected user (keyed by userId)
  useEffect(refresh, [userId]);

  async function save(patch: AdminUserPatch) {
    setSaving(true);
    setError(null);
    try {
      await adminUpdateUser(userId, patch);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
      setConfirmDisable(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-border-subtle bg-background p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.email ?? "Loading…"}</p>
            {user && (
              <p className="text-xs text-muted">
                {user.providers.map(providerLabel).join(", ")} · joined {formatDate(user.createdAt)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {error && <p className="rounded-xl border border-border-strong px-3 py-2 text-xs text-red-400">{error}</p>}

        {user && !user.onboarded && (
          <p className="text-xs text-muted">This user signed up but hasn&apos;t finished onboarding, so there&apos;s no account to manage yet.</p>
        )}

        {user && user.onboarded && (
          <>
            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted uppercase">Usage</p>
              <p className="text-sm">
                {user.usage.projects} projects · {user.usage.posters} posters · {user.usage.videos} quick videos · {user.usage.storyboards} storyboards
              </p>
              <p className="text-xs text-muted">Last sign-in {formatDate(user.lastSignInAt)}</p>
            </section>

            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted uppercase">Plan</p>
              <div className="flex gap-2">
                {(["free", "pro"] as const).map((plan) => (
                  <button key={plan} disabled={saving} onClick={() => save({ plan })} className={pillClass(user.plan === plan)}>
                    {plan === "free" ? "Free" : "Pro"}
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted uppercase">Account type</p>
              <div className="flex gap-2">
                {(["individual", "organisation"] as AccountType[]).map((type) => (
                  <button key={type} disabled={saving} onClick={() => save({ accountType: type })} className={pillClass(user.accountType === type)}>
                    {type === "individual" ? "Individual" : "Organisation"}
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted uppercase">Features</p>
              <p className="text-xs text-muted">Default follows the plan; On/Off overrides it for this user only.</p>
              {features.map((f) => {
                const override = user.featureOverrides[f.key as FeatureKey];
                const planDefault = planDefaults[user.plan][f.key as FeatureKey];
                return (
                  <div key={f.key} className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm">
                        {f.label}{" "}
                        <span className={`text-xs ${user.features[f.key as FeatureKey] ? "text-emerald-400" : "text-red-400"}`}>
                          {user.features[f.key as FeatureKey] ? "on" : "off"}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted">{f.description}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        disabled={saving}
                        onClick={() => save({ featureOverrides: { [f.key]: null } })}
                        className={pillClass(override === undefined)}
                        title={`Plan default (${planDefault ? "on" : "off"})`}
                      >
                        Default
                      </button>
                      <button disabled={saving} onClick={() => save({ featureOverrides: { [f.key]: true } })} className={pillClass(override === true)}>
                        On
                      </button>
                      <button disabled={saving} onClick={() => save({ featureOverrides: { [f.key]: false } })} className={pillClass(override === false)}>
                        Off
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted uppercase">Role</p>
              <p className="text-xs text-muted">Admins can open this console and change any user&apos;s plan, features, and access.</p>
              <div className="flex gap-2">
                {ROLES.map((role) => (
                  <button key={role} disabled={saving} onClick={() => save({ role })} className={pillClass(user.role === role)}>
                    {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted uppercase">Access</p>
              <div className="flex flex-wrap gap-2">
                {user.disabled ? (
                  <button disabled={saving} onClick={() => save({ disabled: false })} className={pillClass(false)}>
                    Re-enable account
                  </button>
                ) : confirmDisable ? (
                  <button disabled={saving} onClick={() => save({ disabled: true })} className="rounded-full border border-red-400 px-3 py-1.5 text-xs text-red-400">
                    Click again to disable — they&apos;ll be signed out
                  </button>
                ) : (
                  <button disabled={saving} onClick={() => setConfirmDisable(true)} className={pillClass(false)}>
                    Disable account
                  </button>
                )}
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted uppercase">Password</p>
              {user.providers.includes("email") ? (
                <>
                  <p className="text-xs text-muted">Passwords are stored encrypted and can&apos;t be viewed. Send a secure link so they can set a new one.</p>
                  <button disabled={saving} onClick={sendReset} className={`self-start ${pillClass(false)}`}>
                    Send password reset email
                  </button>
                  {resetStatus && <p className="text-xs text-emerald-400">{resetStatus}</p>}
                </>
              ) : (
                <p className="text-xs text-muted">Signs in with Google only — no password to reset.</p>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted uppercase">History</p>
              {audit.length === 0 ? (
                <p className="text-xs text-muted">No admin changes yet.</p>
              ) : (
                audit.map((entry) => (
                  <div key={entry.id} className="text-xs">
                    <span className="text-muted">{formatDate(entry.created_at)}</span>{" "}
                    {entry.action === "send_password_reset"
                      ? "Password reset email sent"
                      : Object.entries(entry.details)
                          .map(([field, change]) => `${field}: ${JSON.stringify(change.from)} → ${JSON.stringify(change.to)}`)
                          .join("; ")}
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
