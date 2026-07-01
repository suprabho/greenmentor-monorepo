-- Green Mentor Pro — Feed social layer hardening (perf + comment PII).
-- Run after 0004_feed_social.sql. Two changes from the code review:
--
-- 1) Indexes for the article_social_stats view's per-article count subqueries.
--    reactions' primary key is (user_id, article_id) — user_id LEADING — so it
--    can't serve an article_id-only lookup, and comments had no article_id
--    index at all. Without these, every feed load sequentially scans the whole
--    reactions and comments tables (once per article shown).
--
-- 2) Stop the base comments table exposing the commenter's auth user_id to
--    anonymous callers. Reads already go exclusively through the feed_comments
--    view (which omits user_id); the base table only needs own-row SELECT so
--    that INSERT ... RETURNING keeps working for the comment's author.

-- ── 1) Indexes ──
create index if not exists reactions_article_idx on public.reactions (article_id, kind);
create index if not exists comments_article_idx  on public.comments (article_id);

-- ── 2) Tighten comments read access ──
-- Drop the blanket public-read policy (it let anon select comments.user_id).
drop policy if exists "comments public read" on public.comments;
-- Own-row read keeps the insert's RETURNING working for the author; everyone
-- else reads comment bodies + public author identity via the feed_comments view.
drop policy if exists "comments select own" on public.comments;
create policy "comments select own" on public.comments for select
  using (auth.uid() = user_id);
