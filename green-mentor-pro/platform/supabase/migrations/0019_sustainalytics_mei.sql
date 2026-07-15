-- sustainalytics_* — the Sustainalytics Material ESG Issues (MEI) taxonomy,
-- scraped from the public MEI Resource Center by scripts/scrape-sustainalytics.ts.
--
-- Two pieces of the resource center are stored:
--   • the MEI *catalog*      → sustainalytics_material_issues (22 issues, name + description)
--   • the subindustry *matrix* → sustainalytics_subindustries (~138) +
--                                sustainalytics_subindustry_mei (which MEIs are
--                                material for each subindustry — the value of the page)
-- The "Definitions of MEIs" PDF is archived to the private `sustainalytics` bucket.
--
-- This is a second, authoritative materiality taxonomy alongside the BRSR
-- controlled vocabulary (brsr_topic_canon). Written only by the scrape script
-- through the service-role client; RLS is enabled with no policies, and reads go
-- through the *_public views below. Same conventions as 0012_brsr_material_topics.sql.
--
-- Apply to the shared Supabase project via the SQL Editor (privileged role) or psql.
-- (0017 is doubled — brsr_company_profile + esg_readiness — so 0019 is the next
-- free prefix after 0018.)

-- ── the MEI catalog ─────────────────────────────────────────────────────────
create table if not exists public.sustainalytics_material_issues (
  code        text        primary key,           -- e.g. "Carbon-OwnOperations" (matrix join key)
  name        text        not null,              -- "Carbon – Own Operations"
  description text        not null,              -- one-line card description
  pillar      text        check (pillar in ('environment', 'social', 'governance', 'cross_cutting')),
  sort_ord    int,                               -- order on the resource-center page
  scraped_at  timestamptz not null default now()
);

-- ── the ~138 subindustries ──────────────────────────────────────────────────
create table if not exists public.sustainalytics_subindustries (
  slug        text        primary key,           -- JSON key, e.g. "AerospaceandDefence"
  name        text        not null,              -- "Aerospace and Defence"
  scraped_at  timestamptz not null default now()
);

-- ── the applicability matrix (one row per applicable subindustry×MEI pair) ───
-- Fully refreshed each scrape run: delete-all + reinsert, so no updated_at.
create table if not exists public.sustainalytics_subindustry_mei (
  subindustry_slug text not null references public.sustainalytics_subindustries (slug) on delete cascade,
  mei_code         text not null references public.sustainalytics_material_issues (code) on delete cascade,
  primary key (subindustry_slug, mei_code)
);

create index if not exists sustainalytics_subindustry_mei_code_idx
  on public.sustainalytics_subindustry_mei (mei_code);

-- ── Row-Level Security — enabled, no policies: service-role only ─────────────
alter table public.sustainalytics_material_issues  enable row level security;
alter table public.sustainalytics_subindustries    enable row level security;
alter table public.sustainalytics_subindustry_mei  enable row level security;

-- ── Publish surfaces — SECURITY DEFINER views (Postgres default; do NOT set
-- security_invoker), granted to anon + authenticated. All columns are public
-- reference data, so the views are straight projections/joins. ───────────────
create or replace view public.sustainalytics_material_issues_public as
  select code, name, description, pillar, sort_ord
  from public.sustainalytics_material_issues;

create or replace view public.sustainalytics_subindustries_public as
  select slug, name
  from public.sustainalytics_subindustries;

-- Flat subindustry↔MEI join — the shape a dashboard reads (~1.3k rows).
create or replace view public.sustainalytics_subindustry_mei_public as
  select s.slug        as subindustry_slug,
         s.name        as subindustry_name,
         m.code        as mei_code,
         m.name        as mei_name,
         m.pillar      as mei_pillar,
         m.sort_ord    as mei_sort_ord
  from public.sustainalytics_subindustry_mei x
  join public.sustainalytics_subindustries   s on s.slug = x.subindustry_slug
  join public.sustainalytics_material_issues m on m.code = x.mei_code;

grant select on public.sustainalytics_material_issues_public  to anon, authenticated;
grant select on public.sustainalytics_subindustries_public    to anon, authenticated;
grant select on public.sustainalytics_subindustry_mei_public  to anon, authenticated;

-- ── Private Storage bucket for the archived Definitions PDF ──────────────────
-- Same pattern as the brsr-filings bucket in 0011. Not public; served via the
-- service role / signed URLs only.
insert into storage.buckets (id, name, public)
values ('sustainalytics', 'sustainalytics', false)
on conflict (id) do nothing;
