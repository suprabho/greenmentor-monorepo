-- AI-assisted authoring for Stories: a body to render, and the working state
-- of the sources -> angles -> outline -> draft compose pipeline that fills it.
--
-- Same trust model as 0004: RLS enabled, NO policies — only the service-role
-- client (already gated by requireAdmin()) reads/writes these tables.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

alter table public.community_stories
  add column if not exists body_markdown text,
  add column if not exists compose_state jsonb not null
    default '{"phase":"sources","angles":[],"chosenAngleId":null,"outline":[]}'::jsonb;

create table if not exists public.story_sources (
  id              uuid        primary key default gen_random_uuid(),
  story_id        uuid        not null references public.community_stories (id) on delete cascade,
  kind            text        not null check (kind in ('link', 'text')),
  title           text,
  url             text,
  extracted_text  text,
  status          text        not null default 'pending' check (status in ('pending', 'extracted', 'failed')),
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists story_sources_story_id_idx on public.story_sources (story_id);

alter table public.story_sources enable row level security;
