-- sasb_* — the SASB Materiality Finder taxonomy (IFRS Foundation / SASB Standards),
-- scraped from the public navigator.sasb.ifrs.org API by scripts/scrape-sasb.ts.
--
-- Four pieces are stored:
--   • the SICS taxonomy            → sasb_industries (77 industries across 11 sectors)
--   • the General Issue Categories → sasb_issue_categories (26, across 5 dimensions)
--   • the materiality *matrix*     → sasb_industry_issue_category (which GICs are
--                                    material to each industry — the value of the map)
--   • the disclosure *topics*      → sasb_disclosure_topics (industry-specific topics
--                                    under each material industry×GIC, ~448)
--
-- A third authoritative materiality taxonomy alongside the BRSR controlled
-- vocabulary (brsr_topic_canon) and the Sustainalytics MEIs (sustainalytics_*).
-- Written only by the scrape script through the service-role client; RLS is enabled
-- with no policies, and reads go through the *_public views below. Same conventions
-- as 0019_sustainalytics_mei.sql.
--
-- Apply to the shared Supabase project via the SQL Editor (privileged role) or psql.
-- (Next free prefix after 0020_sustainalytics_nic_crosswalk.sql.)

-- ── the SICS industries (11 sectors → 77 industries) ─────────────────────────
create table if not exists public.sasb_industries (
  code        text        primary key,           -- SICS code, e.g. "CG-AA" (join key)
  name        text        not null,              -- "Apparel, Accessories & Footwear"
  sector      text        not null,              -- parent SICS sector, e.g. "Consumer Goods"
  description text,                              -- industry description paragraph
  scraped_at  timestamptz not null default now()
);

create index if not exists sasb_industries_sector_idx on public.sasb_industries (sector);

-- ── the 26 General Issue Categories (the materiality-map columns) ─────────────
create table if not exists public.sasb_issue_categories (
  code        text        primary key,           -- e.g. "110" (industryTopics join key)
  name        text        not null,              -- "GHG Emissions"
  dimension   text        not null,              -- one of the 5 SASB dimensions
  description text,                              -- category description paragraph
  sort_ord    int,                               -- canonical dimension→category order
  scraped_at  timestamptz not null default now()
);

-- ── the materiality matrix (one row per material industry×GIC pair) ──────────
-- Fully refreshed each run: delete-all + reinsert, so no updated_at.
create table if not exists public.sasb_industry_issue_category (
  industry_code       text not null references public.sasb_industries (code) on delete cascade,
  issue_category_code text not null references public.sasb_issue_categories (code) on delete cascade,
  primary key (industry_code, issue_category_code)
);

create index if not exists sasb_iic_issue_idx
  on public.sasb_industry_issue_category (issue_category_code);

-- ── the industry-specific disclosure topics ──────────────────────────────────
-- Each topic hangs off a material pair — the composite FK guarantees a topic can
-- only exist where its GIC is actually material to its industry. Fully refreshed.
create table if not exists public.sasb_disclosure_topics (
  topic_code          text        primary key,   -- e.g. "CG-AA-250a" (industry + GIC + letter)
  industry_code       text        not null,
  issue_category_code text        not null,
  name                text        not null,      -- "Management of Chemicals in Products"
  description         text,
  scraped_at          timestamptz not null default now(),
  foreign key (industry_code, issue_category_code)
    references public.sasb_industry_issue_category (industry_code, issue_category_code)
    on delete cascade
);

create index if not exists sasb_topics_industry_idx on public.sasb_disclosure_topics (industry_code);
create index if not exists sasb_topics_issue_idx    on public.sasb_disclosure_topics (issue_category_code);

-- ── Row-Level Security — enabled, no policies: service-role only ─────────────
alter table public.sasb_industries              enable row level security;
alter table public.sasb_issue_categories        enable row level security;
alter table public.sasb_industry_issue_category enable row level security;
alter table public.sasb_disclosure_topics       enable row level security;

-- ── Publish surfaces — SECURITY DEFINER views (Postgres default; do NOT set
-- security_invoker), granted to anon + authenticated. All columns are public
-- reference data, so the views are straight projections/joins. ───────────────
create or replace view public.sasb_industries_public as
  select code, name, sector, description
  from public.sasb_industries;

create or replace view public.sasb_issue_categories_public as
  select code, name, dimension, description, sort_ord
  from public.sasb_issue_categories;

-- Flat materiality matrix — the Materiality-Finder grid (~421 rows).
create or replace view public.sasb_materiality_public as
  select i.code      as industry_code,
         i.name      as industry_name,
         i.sector    as sector,
         c.code      as issue_category_code,
         c.name      as issue_category_name,
         c.dimension as dimension,
         c.sort_ord  as issue_category_sort_ord
  from public.sasb_industry_issue_category x
  join public.sasb_industries       i on i.code = x.industry_code
  join public.sasb_issue_categories c on c.code = x.issue_category_code;

-- Flat disclosure-topic drill-down (~448 rows).
create or replace view public.sasb_disclosure_topics_public as
  select t.topic_code   as topic_code,
         t.name         as topic_name,
         t.description  as topic_description,
         i.code         as industry_code,
         i.name         as industry_name,
         i.sector       as sector,
         c.code         as issue_category_code,
         c.name         as issue_category_name,
         c.dimension    as dimension
  from public.sasb_disclosure_topics t
  join public.sasb_industries       i on i.code = t.industry_code
  join public.sasb_issue_categories c on c.code = t.issue_category_code;

grant select on public.sasb_industries_public        to anon, authenticated;
grant select on public.sasb_issue_categories_public  to anon, authenticated;
grant select on public.sasb_materiality_public       to anon, authenticated;
grant select on public.sasb_disclosure_topics_public to anon, authenticated;
