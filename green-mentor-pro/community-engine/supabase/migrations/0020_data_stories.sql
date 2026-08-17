-- 0020_data_stories.sql
--
-- Vismay-format scrollytelling stories inside community_stories.
--
-- `body_format` discriminates the two authoring engines that share the table:
--   * 'blocks'  — the legacy flat markdown body with ```story:* fenced JSON
--                 directives (rendered by StoryBody, exported to Substack).
--   * 'vismay'  — the scrollytelling engine. `body_markdown` holds a FULL
--                 vismay story document (YAML frontmatter + markdown body
--                 whose headings are section anchors), and `config_json`
--                 holds the story config ({defaults, sections[]}) as JSON
--                 TEXT — text, not jsonb, because the engine's section
--                 surgery helpers (appendStorySection / jsonSections) are
--                 line-based string splicing and must round-trip the exact
--                 document, key order and all.
--
-- `content_type` is untouched: it stays the EDITORIAL type (newsletter, post,
-- …) and is orthogonal to the storage format.
--
-- Drafts mint no slug — slugs belong to the publication snapshot (0021).
--
-- Charts live in their own table rather than a jsonb column on the story row
-- ON PURPOSE: community_stories.updated_at is the CAS token for concurrent
-- per-section compose writes (see casUpdateStoryFiles), and a chart write
-- bumping the story row's trigger would spuriously invalidate section CAS.
--
-- RLS: enabled with no policies, like every community-engine table — all
-- access goes through the service-role client behind requireAdmin().

alter table public.community_stories
  add column if not exists body_format text not null default 'blocks'
    check (body_format in ('blocks', 'vismay')),
  add column if not exists config_json text;

create table if not exists public.community_story_charts (
  story_id uuid not null references public.community_stories (id) on delete cascade,
  chart_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (story_id, chart_id)
);

alter table public.community_story_charts enable row level security;

drop trigger if exists community_story_charts_touch on public.community_story_charts;
create trigger community_story_charts_touch
  before update on public.community_story_charts
  for each row execute function public.community_stories_set_updated_at();
