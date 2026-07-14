-- ESG Applicability & Readiness lead-gen tool (lead-gen-amitava/Documents 1–6).
-- A public, anonymous self-serve assessment at /esg-readiness that captures a
-- lead and emails a personalised PDF. Three tables:
--   · esg_assessments        — one row per completed assessment (anonymous first,
--                              lead details filled in on capture)
--   · esg_best_practices     — Page-2 "best practices" content cells (Doc 4)
--   · esg_peer_benefits      — Page-2 "peer benefits" content cells (Doc 4)
--
-- Unlike the rest of the platform there is NO authenticated user here: the
-- browser POSTs to /api/esg-readiness/* route handlers which write through the
-- service-role admin client (lib/supabase/admin.ts), same as the energy module.
-- So RLS is locked down to service-role only (no anon/authenticated policies) —
-- the anon browser never touches Supabase directly. Content tables additionally
-- allow authenticated read for a future review/admin surface.
--
-- Apply to the shared Supabase project via the SQL Editor (privileged role) or
-- psql — both platform and community-engine point at it.

-- reuse the energy_set_updated_at() trigger fn from 0013 for updated_at.

-- ─────────────────────────────────────────────────────────────────────────────
-- esg_assessments — the funnel + lead record.
-- Anonymous rows are logged even when the lead form is abandoned (Doc 3 edge
-- case 5) so we keep engagement analytics without gating on PII.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.esg_assessments (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  source_utm    text,                       -- traffic source (UTM param)
  company_name  text not null,

  -- Raw questionnaire answers (Q1–Q18), stored verbatim as codes (Doc 2).
  answers       jsonb not null,

  -- Computed results (engine output — lib/esg-readiness).
  frameworks         jsonb not null,        -- 7 FrameworkResult objects
  total_score        numeric(4,1) not null, -- 0–44 (half-points possible)
  band               text not null,
  band_color         text not null,
  weakest_subarea    text not null,         -- A | B | C | D
  strongest_subarea  text not null,
  edge_case_flag     text not null default 'none'
                       check (edge_case_flag in ('none','all_doesnt_apply','advanced_band')),

  -- Lead capture (null until the results-page form is submitted).
  lead_name     text,
  work_email    text,
  phone         text,
  designation   text,

  -- Delivery + tracking.
  pdf_url       text,
  status        text not null default 'assessment_only'
                  check (status in ('assessment_only','new','contacted','qualified','disqualified')),
  callback_due  date
);

create index if not exists esg_assessments_created_idx on public.esg_assessments (created_at desc);
create index if not exists esg_assessments_status_idx  on public.esg_assessments (status);
create index if not exists esg_assessments_email_idx   on public.esg_assessments (work_email);

drop trigger if exists esg_assessments_updated on public.esg_assessments;
create trigger esg_assessments_updated before update on public.esg_assessments
  for each row execute function public.energy_set_updated_at();

alter table public.esg_assessments enable row level security;
-- No anon/authenticated policies: only the service-role admin client (which
-- bypasses RLS) reads or writes this table.

-- ─────────────────────────────────────────────────────────────────────────────
-- esg_best_practices — Page-2 bullets, keyed for the 5-attempt graceful-
-- degradation lookup (Doc 4). Specificity descends: sector×band×turnover×subarea
-- → sector×band×turnover → sector×band → sector → 'other' cluster. NULL in a key
-- column means "any" (the fallback tiers). The 'other' sector row always exists.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.esg_best_practices (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  sector      text not null,               -- Q1 sector code, or 'other' fallback
  band        text,                        -- band name, or NULL for any
  turnover    text,                        -- turnover code, or NULL for any
  subarea     text,                        -- A|B|C|D, or NULL for any

  -- Up to 7 authored bullets; the engine picks up to 5 by ranking. Each bullet:
  -- { text, citation, subarea?, frameworks?[] } for the selection ranking.
  bullets     jsonb not null default '[]'::jsonb,

  status      text not null default 'draft'
                check (status in ('draft','review1_ok','review2_ok','published')),

  unique (sector, band, turnover, subarea)
);

create index if not exists esg_best_practices_lookup_idx
  on public.esg_best_practices (sector, band, turnover, subarea);

drop trigger if exists esg_best_practices_updated on public.esg_best_practices;
create trigger esg_best_practices_updated before update on public.esg_best_practices
  for each row execute function public.energy_set_updated_at();

alter table public.esg_best_practices enable row level security;
drop policy if exists "esg_best_practices read" on public.esg_best_practices;
create policy "esg_best_practices read" on public.esg_best_practices
  for select to authenticated using (true);   -- future review/admin surface

-- ─────────────────────────────────────────────────────────────────────────────
-- esg_peer_benefits — Page-2 peer-benefit paragraphs, one per category, keyed
-- for the 3-attempt degradation (Doc 4): sector×turnover×category →
-- sector×category → 'other'×category. The 'other' cluster always exists.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.esg_peer_benefits (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  sector      text not null,               -- Q1 sector code, or 'other' fallback
  turnover    text,                        -- turnover code, or NULL for any
  category    text not null
                check (category in ('investor_banking','customer_market','compliance_risk')),

  body        text not null,               -- 30–50 word paragraph
  citation    text not null,

  status      text not null default 'draft'
                check (status in ('draft','review1_ok','review2_ok','published')),

  unique (sector, turnover, category)
);

create index if not exists esg_peer_benefits_lookup_idx
  on public.esg_peer_benefits (sector, turnover, category);

drop trigger if exists esg_peer_benefits_updated on public.esg_peer_benefits;
create trigger esg_peer_benefits_updated before update on public.esg_peer_benefits
  for each row execute function public.energy_set_updated_at();

alter table public.esg_peer_benefits enable row level security;
drop policy if exists "esg_peer_benefits read" on public.esg_peer_benefits;
create policy "esg_peer_benefits read" on public.esg_peer_benefits
  for select to authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage bucket for rendered report PDFs. Private — the lead API mints a
-- time-limited signed URL for the download link + email (lib/.../lead route).
-- Only the service-role client reads/writes it, so no storage.objects policies
-- are needed.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('esg-reports', 'esg-reports', false)
on conflict (id) do nothing;
