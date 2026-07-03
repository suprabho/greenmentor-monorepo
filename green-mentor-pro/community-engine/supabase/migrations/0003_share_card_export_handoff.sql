-- community_share_card_exports — the share-card export handoff.
--
-- The export API parks { snapshot, resolved data } here so the cookie-less
-- headless browser can read it back at /share-cards/render?id=<uuid>. Rows are
-- ephemeral: the reader rejects anything older than 5 minutes and every write
-- sweeps expired rows (see lib/share-cards/handoff.ts). Security model:
--   • rows are addressed only by an unguessable v4 UUID
--   • anon may SELECT (the headless browser has no session) — acceptable
--     because the payload is an admin-authored card config over already-public
--     article rows, alive for ≤5 minutes
--   • only signed-in users may create rows; any signed-in user may delete
--     (cleanup sweeps other users' expired rows)
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

create table if not exists public.community_share_card_exports (
  id          uuid        primary key default gen_random_uuid(),
  payload     jsonb       not null,
  created_at  timestamptz not null default now()
);

create index if not exists community_share_card_exports_created_idx
  on public.community_share_card_exports (created_at);

alter table public.community_share_card_exports enable row level security;

drop policy if exists "authenticated create handoffs" on public.community_share_card_exports;
create policy "authenticated create handoffs"
  on public.community_share_card_exports
  for insert
  to authenticated
  with check (true);

drop policy if exists "authenticated delete handoffs" on public.community_share_card_exports;
create policy "authenticated delete handoffs"
  on public.community_share_card_exports
  for delete
  to authenticated
  using (true);

drop policy if exists "read handoffs by id" on public.community_share_card_exports;
create policy "read handoffs by id"
  on public.community_share_card_exports
  for select
  to anon, authenticated
  using (true);

-- API role grants (RLS still applies).
grant usage on schema public to anon, authenticated;
grant select on public.community_share_card_exports to anon;
grant select, insert, delete on public.community_share_card_exports to authenticated;
