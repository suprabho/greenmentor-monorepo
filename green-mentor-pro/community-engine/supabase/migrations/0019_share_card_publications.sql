-- community_share_card_publications — share cards published into the learner
-- platform's News feed (/feed on pro.greenmentor.co), interleaved with
-- articles.
--
-- Publishing snapshots the rendered output, not the live config: the
-- admin-gated publish route (app/api/share-cards/[id]/publish) renders the
-- SAVED card config to PNG, uploads it to the public `share-cards` bucket, and
-- upserts one row here per card. Re-publishing replaces the image + metadata;
-- unpublishing deletes the row. The learner platform reads only the
-- share_cards_public view below.
--
-- Like community_webinars / community_jobs, this is service-role-only data:
-- RLS is enabled with no policies, so the anon/authenticated roles get zero
-- rows from the table itself. That keeps publishing an admin-only boundary —
-- the base community_share_cards table stays owner-managed under its own RLS
-- (any signed-in teammate can save cards, only allowlisted admins publish).
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

create table if not exists public.community_share_card_publications (
  id           uuid        primary key default gen_random_uuid(),
  -- One live publication per card; republishing updates the row in place.
  -- Deleting the card from the library unpublishes it.
  card_id      uuid        not null unique
                 references public.community_share_cards (id) on delete cascade,
  title        text        not null,
  caption      text,
  -- Output aspect ratio ("1:1" | "4:5" | "9:16" | "16:9") — the platform
  -- gallery uses it to reserve the right box before the image loads.
  ratio        text        not null default '1:1',
  -- Public URL of the rendered PNG in the share-cards bucket.
  image_url    text        not null,
  published_by uuid        references auth.users (id) on delete set null,
  published_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Touch updated_at on every update.
create or replace function public.community_share_card_publications_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_share_card_publications_updated_at
  on public.community_share_card_publications;
create trigger community_share_card_publications_updated_at
  before update on public.community_share_card_publications
  for each row execute function public.community_share_card_publications_set_updated_at();

-- Row-Level Security — enabled, no policies: only the service-role client
-- (the publish route, behind isAdmin) can read or write the table.
alter table public.community_share_card_publications enable row level security;

-- The learner platform reads published cards through this view. SECURITY
-- DEFINER (Postgres default; do NOT set security_invoker) so it reads past
-- the base table's RLS — same pattern as webinars_public / jobs_public
-- (0017_shareable_slugs.sql). Exposes only learner-safe columns; never
-- published_by.
create or replace view public.share_cards_public as
  select id, card_id, title, caption, ratio, image_url, published_at
  from public.community_share_card_publications;

grant select on public.share_cards_public to anon, authenticated;

-- share-cards — public bucket for the published PNGs. Durable, unlike the
-- 5-minute community_share_card_exports handoff table (0003): the platform
-- hotlinks these URLs for as long as the card stays published. Writes go
-- through the service-role client in the publish route (same shape as
-- webinar-headers, 0007), so no storage.objects policies are needed.
insert into storage.buckets (id, name, public) values ('share-cards', 'share-cards', true)
  on conflict (id) do nothing;
