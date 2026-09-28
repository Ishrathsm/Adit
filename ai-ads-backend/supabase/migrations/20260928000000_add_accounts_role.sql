-- Roles replace the is_admin flag: one role per account, 'admin' or 'user' (room for more later
-- without another boolean). Backfilled from is_admin; that column is dropped in the next migration,
-- once the backend reading `role` is deployed, so the running deploy never sees it disappear.

alter table public.accounts
  add column if not exists role text not null default 'user' check (role in ('admin', 'user'));

update public.accounts set role = 'admin' where is_admin and role <> 'admin';
