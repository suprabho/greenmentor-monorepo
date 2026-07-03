-- community_share_cards — saved Share Cards Studio configs.
--
-- A 1:1 mirror of community_headers (0001): lives in the shared GreenMentor
-- Supabase project, namespaced in `public` (table name prefixed) so it works
-- with supabase-js out of the box. All access is enforced by RLS:
--   • owners can do anything with their own rows
--   • any signed-in user can read rows marked `shared`
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

create table if not exists public.community_share_cards (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  title       text        not null,
  config      jsonb       not null,
  visibility  text        not null default 'personal' check (visibility in ('personal', 'shared')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists community_share_cards_user_id_idx
  on public.community_share_cards (user_id);
create index if not exists community_share_cards_shared_idx
  on public.community_share_cards (visibility) where visibility = 'shared';

-- Touch updated_at on every update.
create or replace function public.community_share_cards_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_share_cards_updated_at on public.community_share_cards;
create trigger community_share_cards_updated_at
  before update on public.community_share_cards
  for each row execute function public.community_share_cards_set_updated_at();

-- Row-Level Security.
alter table public.community_share_cards enable row level security;

drop policy if exists "owners manage own share cards" on public.community_share_cards;
create policy "owners manage own share cards"
  on public.community_share_cards
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "authenticated read shared share cards" on public.community_share_cards;
create policy "authenticated read shared share cards"
  on public.community_share_cards
  for select
  to authenticated
  using (visibility = 'shared');

-- API role grants (RLS still decides which rows are visible/writable).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.community_share_cards to authenticated;
