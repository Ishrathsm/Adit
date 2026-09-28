-- Screen-insert shots: a shot that shows the client's real product screen (a software product's
-- UI) instead of AI-generated footage. The worker builds its clip from this image, so the
-- interface is pixel-real and never garbled; null for every normal shot.
alter table public.storyboard_shots add column if not exists screen_url text;
