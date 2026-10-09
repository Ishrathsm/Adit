-- A video template's recipe: the brief it pre-fills (tone, look, shot plan per length, voiceover)
-- and its sample clips (see VideoRecipe in src/lib/templates.ts). Null for poster templates.
alter table public.templates
  add column if not exists recipe jsonb;
