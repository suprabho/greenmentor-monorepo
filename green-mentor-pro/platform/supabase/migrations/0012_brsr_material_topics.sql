-- brsr_material_topics + brsr_topic_canon — the "material responsible business
-- conduct issues" each company discloses in BRSR Section A, extracted from the
-- archived XBRL by scrape-brsr.ts stage `topics` (deterministic), and the LLM
-- canonicalization cache written by stage `canon` (messy free-text topic names
-- → a controlled vocabulary of canonical topics + E/S/G pillar, mapped once
-- per distinct phrasing by Claude Haiku; see lib/brsr/topic-canon.ts).
--
-- Written only by the scrape worker through the service-role client. RLS is
-- enabled with no policies; the long free texts (rationale / approach /
-- financial implications) never leave the service role. Publishing happens
-- through the *_public views below — including SQL-side rollups so dashboard
-- reads stay flat instead of paging ~50k mention rows.
--
-- Apply to the shared Supabase project via the SQL Editor (runs as the
-- privileged role) or psql — after 0011_brsr_filings.sql.

-- stage `topics` state, alongside the xbrl_/parse_ columns from 0011
alter table public.brsr_filings
  add column if not exists topics_status text not null default 'pending'
    check (topics_status in ('pending', 'extracted', 'failed')),
  add column if not exists topics_error text,
  add column if not exists topics_extracted_at timestamptz,
  add column if not exists topic_count int;

create index if not exists brsr_filings_topics_status_idx on public.brsr_filings (topics_status);

-- One row per material-issue table row (an XBRL typed-dimension context).
-- Delete-then-insert per filing on (re)extraction, so no updated_at machinery.
create table if not exists public.brsr_material_topics (
  id                     uuid        primary key default gen_random_uuid(),
  filing_id              uuid        not null references public.brsr_filings (id) on delete cascade,
  context_ref            text        not null,   -- XBRL context id of the issue row
  row_ord                int,                    -- typed-member row number; null when unparseable
  topic_raw              text        not null,   -- verbatim MaterialIssueIdentified, entity-decoded, <=600 chars
  topic_norm             text        not null,   -- lowercased/whitespace-squeezed join key into brsr_topic_canon
  risk_opportunity       text        check (risk_opportunity in ('R', 'O', 'RO')),  -- null = absent/unparseable
  rationale              text,                   -- <=2000 chars, service-role-only
  approach               text,                   -- InCaseOfRiskApproachToAdaptOrMitigate, <=2000
  financial_implications text,                   -- <=2000
  created_at             timestamptz not null default now(),
  unique (filing_id, context_ref)
);

create index if not exists brsr_material_topics_filing_idx on public.brsr_material_topics (filing_id);
create index if not exists brsr_material_topics_norm_idx on public.brsr_material_topics (topic_norm);

-- The canonicalization cache: one row per distinct raw phrasing. PK on
-- topic_norm means re-runs of stage `canon` only ever map NEW strings; fixing
-- a bad mapping = update the row (or delete it to force a remap next run).
create table if not exists public.brsr_topic_canon (
  topic_norm      text        primary key,
  canonical_topic text        not null,
  pillar          text        not null
    check (pillar in ('environment', 'social', 'governance', 'cross_cutting')),
  confidence      numeric,                      -- model-reported, 0..1
  model           text        not null,         -- e.g. "claude-haiku-4-5"
  created_at      timestamptz not null default now()
);

create index if not exists brsr_topic_canon_topic_idx on public.brsr_topic_canon (canonical_topic);

-- Row-Level Security — enabled, no policies: service-role only.
alter table public.brsr_material_topics enable row level security;
alter table public.brsr_topic_canon enable row level security;

-- Canon worker helper: distinct topic_norms with no canon row yet, most
-- mentioned first (so the head of the distribution is mapped against the pure
-- seed vocabulary before any model-proposed topics exist). SECURITY DEFINER
-- for the same reason as the views; PostgREST alone can't express this
-- distinct anti-join. Called by the worker via the service role.
create or replace function public.brsr_unmapped_topic_norms(batch_size int default 1000)
returns table (topic_norm text, mentions bigint)
language sql stable security definer as $$
  select t.topic_norm, count(*) as mentions
  from public.brsr_material_topics t
  left join public.brsr_topic_canon c on c.topic_norm = t.topic_norm
  where c.topic_norm is null
  group by t.topic_norm
  order by mentions desc
  limit batch_size
$$;

-- Publish surfaces — SECURITY DEFINER views (Postgres default; do NOT set
-- security_invoker), same mechanism as brsr_filings_public. Safe columns only:
-- the topic name and R/O flag are public disclosures; the long narrative
-- fields stay behind the service role.
create or replace view public.brsr_material_topics_public as
  select f.symbol, f.company_name, f.fy_from, f.fy_to,
         t.topic_raw, t.topic_norm, t.risk_opportunity, t.row_ord,
         c.canonical_topic, c.pillar, c.confidence
  from public.brsr_material_topics t
  join public.brsr_filings f on f.id = t.filing_id
  left join public.brsr_topic_canon c on c.topic_norm = t.topic_norm
  where f.topics_status = 'extracted';

-- Per-canonical-topic rollup: mention + distinct-company counts and the
-- Risk/Opportunity split. The dashboard reads this (~tens of rows).
create or replace view public.brsr_topic_rollup_public as
  select c.canonical_topic, c.pillar,
         count(*)                                          as mentions,
         count(distinct f.symbol)                          as companies,
         count(*) filter (where t.risk_opportunity = 'R')  as risk_n,
         count(*) filter (where t.risk_opportunity = 'O')  as opportunity_n,
         count(*) filter (where t.risk_opportunity = 'RO') as risk_and_opp_n
  from public.brsr_material_topics t
  join public.brsr_filings f on f.id = t.filing_id and f.topics_status = 'extracted'
  join public.brsr_topic_canon c on c.topic_norm = t.topic_norm
  group by c.canonical_topic, c.pillar;

-- Raw-variant rollup under each canonical topic (which phrasings map where).
create or replace view public.brsr_topic_variants_public as
  select c.canonical_topic, t.topic_norm,
         min(t.topic_raw)         as sample_raw,
         count(*)                 as mentions,
         count(distinct f.symbol) as companies
  from public.brsr_material_topics t
  join public.brsr_filings f on f.id = t.filing_id and f.topics_status = 'extracted'
  join public.brsr_topic_canon c on c.topic_norm = t.topic_norm
  group by c.canonical_topic, t.topic_norm;

grant select on public.brsr_material_topics_public to anon, authenticated;
grant select on public.brsr_topic_rollup_public to anon, authenticated;
grant select on public.brsr_topic_variants_public to anon, authenticated;
