-- Reference assets for video ads (future Pro features — tiers/pricing not decided yet, so not
-- gated): uploaded product / person / location photos and generated character sheets.

-- Reference assets for a storyboard: uploaded by the user, or generated (character sheet).
-- Every keyframe that features an asset gets its image as a reference.
create table if not exists public.storyboard_assets (
  id uuid primary key default gen_random_uuid(),
  storyboard_id uuid not null references public.storyboards (id) on delete cascade,
  kind text not null check (kind in ('character', 'product', 'location')),
  name text not null,
  description text,
  image_url text,
  source text not null check (source in ('uploaded', 'generated')),
  status text not null default 'ready' check (status in ('pending', 'ready', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists storyboard_assets_storyboard_id_idx on public.storyboard_assets (storyboard_id);

alter table public.storyboard_assets enable row level security;
create policy "storyboard_assets are viewable by owner" on public.storyboard_assets
  for select using (
    exists (
      select 1 from public.storyboards
      join public.projects on projects.id = storyboards.project_id
      where storyboards.id = storyboard_assets.storyboard_id and projects.user_id = auth.uid()
    )
  );

-- Which assets appear in each shot (by name), chosen by the director step.
alter table public.storyboard_shots
  add column if not exists asset_names text[] not null default '{}';

-- New storyboard stage: character sheet generated and waiting for the user's approval before any
-- shot is generated.
alter table public.storyboards drop constraint if exists storyboards_status_check;
alter table public.storyboards
  add constraint storyboards_status_check
  check (status in ('casting', 'drafting', 'generating_video', 'completed', 'failed'));
