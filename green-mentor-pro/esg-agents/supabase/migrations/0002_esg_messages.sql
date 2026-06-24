-- Conversation history for the engagement-scoped report copilot (Workstream D).
-- One row per chat message; `parts` holds the AI SDK UIMessage parts (text + tool
-- invocations). Scoped per org for tenant isolation, mirroring 0001 conventions.

create table if not exists public.esg_messages (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.esg_organizations(id) on delete cascade,
  engagement_id uuid not null references public.esg_engagements(id) on delete cascade,
  role          text not null check (role in ('user','assistant','system')),
  parts         jsonb not null default '[]'::jsonb,
  created_by    uuid,
  created_at    timestamptz not null default now()
);

create index if not exists esg_messages_engagement_idx
  on public.esg_messages (engagement_id, created_at);

alter table public.esg_messages enable row level security;
drop policy if exists "members manage esg_messages" on public.esg_messages;
create policy "members manage esg_messages" on public.esg_messages for all to authenticated
  using (public.esg_is_member(org_id)) with check (public.esg_is_member(org_id));
