-- Green Mentor Pro — Feed social layer (real reactions + comments).
-- Run after 0003_feed.sql. Adds two read-only views so the ANONYMOUS feed can
-- show aggregate reaction counts and comment authors — data that the base-table
-- RLS intentionally hides:
--   • reactions has no public-read policy (only "reactions own"), so nobody can
--     read others' rows → aggregate like/dislike counts are unreadable.
--   • profiles is readable by authenticated users only, so an anonymous viewer
--     can read comment bodies (comments is public-read) but not author names.
--
-- Both views are SECURITY DEFINER (security_invoker = off, the default) on
-- purpose: they run with the owner's privileges so anon can read them, but they
-- expose ONLY aggregates / public profile fields — never a user's individual
-- reaction row. Writes still go through the base tables under their own RLS
-- ("reactions own" / "comments insert own"), so this migration grants no new
-- write access. (Supabase's advisor will flag these as "security definer
-- views"; that is the intended, reviewed behavior for public exposure.)

-- ── Per-article aggregate counts (no user_id exposed) ──
create or replace view public.article_social_stats
with (security_invoker = off) as
select
  a.id as article_id,
  (select count(*) from public.reactions r
     where r.article_id = a.id and r.kind = 'like')    as like_count,
  (select count(*) from public.reactions r
     where r.article_id = a.id and r.kind = 'dislike') as dislike_count,
  (select count(*) from public.comments c
     where c.article_id = a.id)                          as comment_count
from public.articles a;

grant select on public.article_social_stats to anon, authenticated;

-- ── Comments joined with the author's public identity ──
-- Only display_name + avatar_url are surfaced; no email or other PII.
create or replace view public.feed_comments
with (security_invoker = off) as
select
  c.id,
  c.article_id,
  c.body,
  c.created_at,
  p.display_name as author_name,
  p.avatar_url   as author_avatar
from public.comments c
left join public.profiles p on p.id = c.user_id;

grant select on public.feed_comments to anon, authenticated;
