-- ESG-Agents — core schema: orgs, engagements, phase state machine, agent runs,
-- typed artifacts, validations, the maker-checker review queue, and assumptions log.
-- Conventions copied from community-engine 0001_community_headers.sql:
-- uuid PK gen_random_uuid(), jsonb payloads, created_at/updated_at + touch trigger,
-- RLS, grants to authenticated. Per-customer isolation is by org_id.

-- ============ membership (per-customer isolation backbone) ============
create table if not exists public.esg_organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  config      jsonb not null default '{}'::jsonb,   -- branding, frameworks, channels, confidence_floor, auto_run_ceiling
  deployment  text not null default 'cloud' check (deployment in ('cloud','self_hosted')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.esg_org_members (
  org_id   uuid not null references public.esg_organizations(id) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role     text not null default 'consultant' check (role in ('admin','consultant','reviewer','client_viewer')),
  primary key (org_id, user_id)
);

-- helper: is the caller a member of this org?
create or replace function public.esg_is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.esg_org_members m where m.org_id = p_org and m.user_id = auth.uid());
$$;

-- ============ engagement + state machine ============
create table if not exists public.esg_engagements (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.esg_organizations(id) on delete cascade,
  client_name    text not null,
  financial_year text not null,                     -- mirrors legacy financial_year/quarter scoping
  framework      text[] not null default '{BRSR}',  -- GRI/ISSB/SASB/TCFD/BRSR
  status         text not null default 'active' check (status in ('active','paused','completed','archived')),
  config         jsonb not null default '{}'::jsonb,
  created_by     uuid not null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.esg_engagement_phases (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.esg_organizations(id) on delete cascade,
  engagement_id  uuid not null references public.esg_engagements(id) on delete cascade,
  phase_key      text not null,                      -- kickoff | materiality | data_requirements | ... | publication
  phase_no       int  not null,                      -- 1..8
  status         text not null default 'not_started'
                 check (status in ('not_started','agent_running','awaiting_human_review','changes_requested','approved','complete','failed')),
  agent_family   text not null,
  current_run_id uuid,                               -- -> esg_agent_runs.id
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (engagement_id, phase_key)
);

-- ============ agent runs (resume-safe session state) ============
create table if not exists public.esg_agent_runs (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.esg_organizations(id) on delete cascade,
  engagement_id    uuid not null references public.esg_engagements(id) on delete cascade,
  phase_key        text not null,
  family           text not null,
  agent_key        text not null,                    -- skill.md `name`
  input            jsonb not null,                   -- assembled context
  output           jsonb,                            -- tool_use.input
  status           text not null default 'estimating'
                   check (status in ('estimating','awaiting_run_confirmation','running','succeeded','failed')),
  confidence       numeric,                          -- 0..1, min-of-per-field
  est_cost_credits numeric,
  cost_credits     numeric,
  model            text not null,
  prompt_version   text,
  prompt_variant   text default 'control',
  input_tokens     int,
  output_tokens    int,
  error            jsonb,                            -- Ajv errors on failure (resume-safe)
  requested_by     uuid default auth.uid(),          -- maker
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============ data collection backbone (Phase 3/4) ============
create table if not exists public.esg_data_requests (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.esg_organizations(id) on delete cascade,
  engagement_id   uuid not null references public.esg_engagements(id) on delete cascade,
  material_topic  text not null,
  disclosure_code text,                              -- mirrors brsr_response.disclosure_code
  metric          text not null,
  unit            text,
  source_system   text,
  owner_email     text,
  channel         text not null default 'web_portal' check (channel in ('web_portal','bulk_upload','whatsapp','email')),
  due_date        date,
  status          text not null default 'requested' check (status in ('requested','received','confirmed','overdue')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.esg_data_submissions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.esg_organizations(id) on delete cascade,
  data_request_id uuid not null references public.esg_data_requests(id) on delete cascade,
  channel         text not null default 'web_portal',
  storage_path    text,                              -- Supabase Storage object (evidence/bulk doc)
  extracted       jsonb,                             -- per-field {value,source_snippet,extraction_confidence,extraction_note}
  confidence      numeric,
  submitted_by    uuid default auth.uid(),
  received_at     timestamptz not null default now()
);

-- ============ typed artifacts (draft -> final) ============
create table if not exists public.esg_artifacts (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.esg_organizations(id) on delete cascade,
  engagement_id  uuid not null references public.esg_engagements(id) on delete cascade,
  phase_key      text not null,
  artifact_type  text not null
                 check (artifact_type in ('scope_plan','materiality_matrix','data_request_list','dataset','validation_report','calc_result','disclosure_draft','report_section')),
  payload        jsonb not null,                     -- structured output (per-field confidence shape inside)
  confidence     numeric,
  provenance     jsonb,                              -- { run_id, source_artifact_ids, ref_lookups }
  status         text not null default 'draft' check (status in ('draft','final','superseded')),
  version        int  not null default 1,
  created_by_run uuid references public.esg_agent_runs(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============ validations (Phase 5 issues) ============
create table if not exists public.esg_validations (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.esg_organizations(id) on delete cascade,
  engagement_id  uuid not null references public.esg_engagements(id) on delete cascade,
  artifact_id    uuid references public.esg_artifacts(id) on delete cascade,
  check_type     text not null,                      -- completeness|accuracy|methodology|reconciliation|consistency|yoy|outlier
  severity       text not null default 'warning' check (severity in ('info','warning','error')),
  field_path     text,                               -- jsonpath into the artifact
  message        text not null,
  detected_value jsonb,
  expected_hint  jsonb,
  status         text not null default 'open' check (status in ('open','resolved','accepted')),
  created_at     timestamptz not null default now()
);

-- ============ HUMAN GATE — maker-checker (mirrors approval_request) ============
create table if not exists public.esg_review_queue (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.esg_organizations(id) on delete cascade,
  engagement_id   uuid not null references public.esg_engagements(id) on delete cascade,
  phase_key       text not null,
  run_id          uuid references public.esg_agent_runs(id) on delete cascade,
  subject_type    text not null,                     -- polymorphic: 'artifact'|'field'|'disclosure'|'validation'|'phase_summary'
  subject_id      uuid,
  item            text not null,                     -- human label, e.g. "Scope 2 electricity total (kWh)"
  ai_value        jsonb,
  confidence      numeric,
  review_required boolean not null default false,    -- true if below floor or outlier (sorts to top)
  status          text not null default 'submitted' check (status in ('submitted','approved','rejected')),  -- legacy request_status vocabulary
  feedback        text,                              -- legacy `feedback`
  requested_by    uuid default auth.uid(),           -- maker (agent run trigger)
  reviewed_by     uuid,                              -- checker (legacy modified_by)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============ assumptions / limitations log (carried forward) ============
create table if not exists public.esg_assumptions_log (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.esg_organizations(id) on delete cascade,
  engagement_id  uuid not null references public.esg_engagements(id) on delete cascade,
  phase_key      text not null,
  artifact_id    uuid references public.esg_artifacts(id) on delete set null,
  kind           text not null default 'assumption' check (kind in ('assumption','limitation','methodology')),
  statement      text not null,
  rationale      text,
  source         text,                               -- which agent/field raised it (from extraction_note)
  created_at     timestamptz not null default now()
);

-- ============ org theme (per-customer hosted interface) ============
create table if not exists public.esg_org_theme (
  org_id      uuid primary key references public.esg_organizations(id) on delete cascade,
  theme_ref   text not null,
  config      jsonb not null default '{}'::jsonb,    -- logo, brand colors, accent, locale, custom labels/enums
  updated_at  timestamptz not null default now()
);

-- ============ updated_at touch trigger (reused from community_headers) ============
create or replace function public.esg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  foreach t in array array[
    'esg_organizations','esg_engagements','esg_engagement_phases','esg_agent_runs',
    'esg_data_requests','esg_artifacts','esg_review_queue','esg_org_theme'
  ] loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$s;', t);
    execute format('create trigger %1$s_updated_at before update on public.%1$s for each row execute function public.esg_set_updated_at();', t);
  end loop;
end $$;

-- ============ RLS — per-customer (org) isolation ============
do $$
declare t text;
begin
  foreach t in array array[
    'esg_engagements','esg_engagement_phases','esg_agent_runs','esg_data_requests',
    'esg_data_submissions','esg_artifacts','esg_validations','esg_review_queue','esg_assumptions_log','esg_org_theme'
  ] loop
    execute format('alter table public.%1$s enable row level security;', t);
    execute format('drop policy if exists "members manage %1$s" on public.%1$s;', t);
    -- esg_data_submissions has no direct org_id link in this policy variant; carry org_id denormalized (column present).
    execute format($f$create policy "members manage %1$s" on public.%1$s for all to authenticated
      using (public.esg_is_member(org_id)) with check (public.esg_is_member(org_id));$f$, t);
  end loop;
end $$;

-- org table: members read their org; only admins update config.
alter table public.esg_organizations enable row level security;
drop policy if exists "members read own org" on public.esg_organizations;
create policy "members read own org" on public.esg_organizations for select to authenticated
  using (public.esg_is_member(id));
drop policy if exists "admins update own org" on public.esg_organizations;
create policy "admins update own org" on public.esg_organizations for update to authenticated
  using (exists (select 1 from public.esg_org_members m where m.org_id = id and m.user_id = auth.uid() and m.role = 'admin'))
  with check (true);

alter table public.esg_org_members enable row level security;
drop policy if exists "members read own membership" on public.esg_org_members;
create policy "members read own membership" on public.esg_org_members for select to authenticated
  using (user_id = auth.uid() or public.esg_is_member(org_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated; -- RLS still decides rows
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

-- ============ storage bucket for evidence uploads ============
insert into storage.buckets (id, name, public)
  values ('esg-evidence', 'esg-evidence', false)
  on conflict (id) do nothing;
