-- Shared visual "look sheet" (product, palette, light, lens, sound world) written by the director
-- step when a storyboard is created, and repeated verbatim into every shot's image/video prompt so
-- separately generated shots read as one film. Null for storyboards created before this existed.
alter table public.storyboards
  add column if not exists look_sheet text;
