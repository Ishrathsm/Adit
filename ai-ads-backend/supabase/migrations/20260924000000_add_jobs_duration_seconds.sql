-- Video length in seconds, chosen in the editor's duration picker.
-- Null for poster jobs and older rows; the worker falls back to its default.
-- 4/6/8 matches Veo 3.1's allowed single-generation lengths (validated in routes/jobs.ts).
alter table public.jobs
  add column if not exists duration_seconds integer
  check (duration_seconds is null or duration_seconds in (4, 6, 8));
