-- Admin access control: per-account plan label, admin flag, disable switch, and per-user feature
-- overrides, plus an audit log of every admin change. accounts keeps RLS with no client write
-- policies, so only the backend (service role) — i.e. an admin through the admin API, or SQL —
-- can change any of these; users can't grant themselves anything.

alter table public.accounts
  add column if not exists plan text not null default 'free' check (plan in ('free', 'pro')),
  add column if not exists is_admin boolean not null default false,
  add column if not exists disabled boolean not null default false,
  -- { "<feature key>": true | false } — overrides the plan's default for that feature.
  add column if not exists feature_overrides jsonb not null default '{}'::jsonb;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  target_user_id uuid not null,
  action text not null,
  -- { "field": { "from": ..., "to": ... }, ... }
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_user_id, created_at desc);

-- Service role only: no client policies.
alter table public.admin_audit_log enable row level security;
