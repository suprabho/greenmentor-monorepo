-- General (non-engagement) chat for the /ai-hub Chat tab. Mirrors esg_messages
-- (esg-agents/supabase/migrations/0002) but adds a conversation container and
-- scopes conversations per user. References public.esg_organizations /
-- esg_is_member, which the platform already depends on (see lib/tenancy.ts →
-- ensureOrgForUser). All app writes go through the service-role admin client, so
-- RLS below is the defensive layer, not the hot path.

create table if not exists public.chat_conversations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.esg_organizations(id) on delete cascade,
  user_id         uuid not null,                       -- owner (auth.users.id)
  title           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz
);
create index if not exists chat_conversations_owner_idx
  on public.chat_conversations (org_id, user_id, updated_at desc);

create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  org_id          uuid not null references public.esg_organizations(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system')),
  parts           jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists chat_messages_conv_idx
  on public.chat_messages (conversation_id, created_at);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages      enable row level security;

-- Conversations are private to their owner within the org.
drop policy if exists "owner manages chat_conversations" on public.chat_conversations;
create policy "owner manages chat_conversations" on public.chat_conversations for all to authenticated
  using (public.esg_is_member(org_id) and user_id = auth.uid())
  with check (public.esg_is_member(org_id) and user_id = auth.uid());

-- Messages inherit access from their conversation.
drop policy if exists "owner manages chat_messages" on public.chat_messages;
create policy "owner manages chat_messages" on public.chat_messages for all to authenticated
  using (
    public.esg_is_member(org_id)
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    public.esg_is_member(org_id)
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

-- Private bucket for composer attachments. Access via service-role signed URLs
-- (see app/api/ai-hub/chat/conversations/[id]/upload/route.ts).
insert into storage.buckets (id, name, public)
values ('chat-uploads', 'chat-uploads', false)
on conflict (id) do nothing;
