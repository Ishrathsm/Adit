-- The aspect ratio the template's own image was designed at (e.g. a landscape billboard vs a
-- portrait poster), computed from the template's real dimensions at import time. Remixing a
-- template preselects this ratio instead of a single hardcoded default for every template.
alter table public.templates
  add column if not exists aspect_ratio text not null default '1:1'
  check (aspect_ratio in ('1:1', '3:4', '4:3', '9:16', '16:9'));
