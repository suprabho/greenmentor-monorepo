-- community_story_publications — scrollytelling stories published onto the
-- learner platform (/stories/{slug}-{id_prefix} on pro.greenmentor.co).
--
-- Publishing snapshots the story DOCUMENT for live render — the markdown +
-- config text pair plus a charts snapshot — unlike share cards (0019), which
-- snapshot a rendered PNG. The platform re-renders the story through the
-- same engine (parse → resolveUnits → StoryShell + gm:* modules), so what
-- readers see is exactly what the CE preview showed at publish time; later
-- draft edits change nothing until republish.
--
-- Slug scheme is 0017's: `{slug}-{id_prefix}` where id_prefix resolves the
-- row and slug is decorative; gm_set_share_keys() fills slug only when blank
-- so republishing after a rename never 404s a shared link.
--
-- RLS enabled with no policies (service-role-only writes behind isAdmin);
-- the platform reads only the stories_public view.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.
-- Requires 0017 (gm_slugify / gm_set_share_keys) and 0020 (data stories).

create table if not exists public.community_story_publications (
  id            uuid        primary key default gen_random_uuid(),
  -- One live publication per story; republishing updates the row in place.
  -- Deleting the draft unpublishes it.
  story_id      uuid        not null unique
                  references public.community_stories (id) on delete cascade,
  slug          text,
  id_prefix     text,
  -- Denormalized from the document frontmatter so the platform index and OG
  -- tags never parse markdown.
  title         text        not null,
  subtitle      text,
  byline        text,
  format        text        not null default 'deck' check (format in ('map', 'deck')),
  cover_image_url text,
  -- The story document snapshot: full frontmatter+markdown, and the config
  -- as JSON TEXT (same round-trip-exact representation as the draft).
  markdown      text        not null,
  config_json   text        not null,
  config_format text        not null default 'json' check (config_format in ('yaml', 'json')),
  -- {chart_id: <GenericChart steps payload or bare option>} snapshot of
  -- community_story_charts, frozen per publish.
  charts        jsonb       not null default '{}'::jsonb,
  published_by  uuid        references auth.users (id) on delete set null,
  published_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Touch updated_at on every update.
drop trigger if exists community_story_publications_updated_at
  on public.community_story_publications;
create trigger community_story_publications_updated_at
  before update on public.community_story_publications
  for each row execute function public.community_stories_set_updated_at();

-- Share keys: slug from title (only when blank), id_prefix always recomputed.
create index if not exists community_story_publications_id_prefix_idx
  on public.community_story_publications (id_prefix);

drop trigger if exists community_story_publications_share_keys
  on public.community_story_publications;
create trigger community_story_publications_share_keys
  before insert or update of title on public.community_story_publications
  for each row execute function public.gm_set_share_keys();

alter table public.community_story_publications enable row level security;

-- The learner platform reads published stories through this view. SECURITY
-- DEFINER (Postgres default; do NOT set security_invoker) so it reads past
-- the base table's RLS — same pattern as webinars_public / jobs_public /
-- share_cards_public. Never exposes published_by.
create or replace view public.stories_public as
  select id, story_id, slug, id_prefix, title, subtitle, byline, format,
         cover_image_url, markdown, config_json, config_format, charts,
         published_at, updated_at
  from public.community_story_publications;

grant select on public.stories_public to anon, authenticated;
