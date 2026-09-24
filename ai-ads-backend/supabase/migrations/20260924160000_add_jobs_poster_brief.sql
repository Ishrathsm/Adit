-- The user's poster brief: structured copy (headline, supporting line, offer, call to action,
-- contact line), tone/look, audience / must-show / avoid guidance, and reference asset photos.
-- Null for video jobs and for posters created before the brief existed (those use `tagline`).
alter table public.jobs
  add column if not exists poster_brief jsonb;
