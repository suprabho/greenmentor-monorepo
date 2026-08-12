-- Green Mentor Pro — social layer for published share cards (likes + comments).
-- Run after 0005_feed_social_hardening.sql. Mirrors the article social layer
-- (0003_feed.sql tables, 0004_feed_social.sql views, 0005 hardening — the
-- hardening is baked in from day one here) for the card_* subject, so the
-- feed's share-card items get the same Like / Comment / Share bar as articles.
--
-- Rows are keyed on the STABLE studio card id (community_share_cards.id,
-- exposed as share_cards_public.card_id), not the publication row id —
-- republishing replaces the publication row in place but keeps card_id, so
-- social activity survives an unpublish/republish cycle.
--
-- Deliberately NO foreign key on card_id: community_share_cards belongs to the
-- community-engine migration series, and an FK would couple this file to
-- cross-app migration order. Orphan rows (card deleted in the studio) never
-- render and are harmless.
--
-- Apply to the shared Supabase project via the SQL Editor (privileged role)
-- or psql.

-- ── card_reactions / card_comments: per-user, require auth ──
create table if not exists public.card_reactions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  card_id    uuid not null,
  kind       text not null check (kind in ('like')),
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
-- The PK leads with user_id (serves the like-toggle upsert); this serves the
-- per-card count subqueries in card_social_stats (the 0005 lesson).
create index if not exists card_reactions_card_idx on public.card_reactions (card_id, kind);

create table if not exists public.card_comments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  card_id    uuid not null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists card_comments_card_idx on public.card_comments (card_id);

-- ── RLS ──
alter table public.card_reactions enable row level security;
alter table public.card_comments  enable row level security;

drop policy if exists "card_reactions own" on public.card_reactions;
create policy "card_reactions own" on public.card_reactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No public read on the base comments table (it would expose the commenter's
-- auth user_id — see 0005): everyone reads bodies + public author identity via
-- the card_feed_comments view; own-row SELECT keeps INSERT ... RETURNING
-- working for the comment's author.
drop policy if exists "card_comments insert own" on public.card_comments;
create policy "card_comments insert own" on public.card_comments for insert
  with check (auth.uid() = user_id);
drop policy if exists "card_comments select own" on public.card_comments;
create policy "card_comments select own" on public.card_comments for select
  using (auth.uid() = user_id);
drop policy if exists "card_comments update own" on public.card_comments;
create policy "card_comments update own" on public.card_comments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Definer views (same posture + rationale as 0004_feed_social.sql) ──
-- SECURITY DEFINER (security_invoker = off) on purpose: they run with the
-- owner's privileges so anon can read them, but expose ONLY aggregates /
-- public profile fields — never a user's individual reaction row. Writes
-- still go through the base tables under their own RLS.
--
-- Unlike article_social_stats (which enumerates all articles), this view only
-- has rows for cards with activity — enumerating published cards would drag in
-- a dependency on community_share_card_publications. The client already treats
-- a missing stats row as zeroed counts.
create or replace view public.card_social_stats
with (security_invoker = off) as
select
  card_id,
  coalesce(r.like_count, 0)::bigint    as like_count,
  coalesce(c.comment_count, 0)::bigint as comment_count
from (select card_id, count(*) as like_count
        from public.card_reactions where kind = 'like' group by card_id) r
full outer join
     (select card_id, count(*) as comment_count
        from public.card_comments group by card_id) c using (card_id);

grant select on public.card_social_stats to anon, authenticated;

-- Comments joined with the author's public identity — only display_name +
-- avatar_url are surfaced; no email or other PII.
create or replace view public.card_feed_comments
with (security_invoker = off) as
select
  c.id,
  c.card_id,
  c.body,
  c.created_at,
  p.display_name as author_name,
  p.avatar_url   as author_avatar
from public.card_comments c
left join public.profiles p on p.id = c.user_id;

grant select on public.card_feed_comments to anon, authenticated;
