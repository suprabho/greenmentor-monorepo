-- community_stories — the individual content pieces (webinars, newsletters,
-- posts, social) the community team tracks from draft through publish.
--
-- Unlike community_headers/community_share_cards (personal maker-tool data,
-- open to any signed-in teammate via RLS), Stories is admin-hub data: the
-- `/stories` page and its API routes are gated by requireAdmin() and read
-- exclusively through the service-role client (lib/supabase/admin.ts) — the
-- same pattern the Pipeline tab uses to curate `entities`. RLS is enabled
-- with no policies, so the anon/authenticated roles get zero rows and every
-- access path runs through the app-level admin allowlist rather than a
-- second, SQL-encoded one.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

create table if not exists public.community_stories (
  id                   uuid        primary key default gen_random_uuid(),
  title                text        not null,
  content_type         text        not null check (content_type in ('webinar', 'newsletter', 'post', 'social')),
  status               text        not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  owner_id             uuid        references auth.users (id) on delete set null,
  target_publish_date  date,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists community_stories_status_idx on public.community_stories (status);

-- Touch updated_at on every update.
create or replace function public.community_stories_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_stories_updated_at on public.community_stories;
create trigger community_stories_updated_at
  before update on public.community_stories
  for each row execute function public.community_stories_set_updated_at();

-- Row-Level Security — enabled, no policies: only the service-role client
-- (already gated by requireAdmin() at the call site) can read or write.
alter table public.community_stories enable row level security;
