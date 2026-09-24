-- The user's creative brief for a video ad (length, tone, look, pacing, audience, key message,
-- must-show details). Drives the director script, shot count/cut length, color grade, and end
-- card line, so the ad adapts to each brand instead of one house style. Null for older storyboards.
alter table public.storyboards
  add column if not exists creative_brief jsonb;
