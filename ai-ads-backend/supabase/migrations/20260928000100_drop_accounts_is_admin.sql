-- Apply after the role-based backend is live (see 20260928000000_add_accounts_role.sql).
alter table public.accounts drop column if exists is_admin;
