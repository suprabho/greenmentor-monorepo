-- Green Mentor Pro — Open Global ESG Feed (footshorts-shaped, reimplemented for ESG).
-- articles + entities + follows + reactions + comments. Run after 0001/0002.
-- Anonymous read on the feed; follows/reactions/comments require a signed-in user.

-- ── entities: the follow-graph nodes (frameworks / topics / regions / companies) ──
create table if not exists public.entities (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  kind       text not null check (kind in ('framework','topic','region','company')),
  created_at timestamptz not null default now()
);

-- ── articles: AI-summarized feed cards ──
create table if not exists public.articles (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  title         text not null,
  url           text not null unique,
  summary       text,              -- ~60-word AI summary
  image_url     text,
  published_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists articles_published_idx on public.articles (published_at desc nulls last);

-- ── article_entities: many-to-many tag links ──
create table if not exists public.article_entities (
  article_id uuid not null references public.articles (id) on delete cascade,
  entity_id  uuid not null references public.entities (id) on delete cascade,
  primary key (article_id, entity_id)
);

-- ── follows / reactions / comments: per-user, require auth ──
create table if not exists public.follows (
  user_id   uuid not null references auth.users (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, entity_id)
);

create table if not exists public.reactions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  kind       text not null check (kind in ('like','dislike')),
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ── RLS ──
alter table public.entities         enable row level security;
alter table public.articles         enable row level security;
alter table public.article_entities enable row level security;
alter table public.follows          enable row level security;
alter table public.reactions        enable row level security;
alter table public.comments         enable row level security;

-- Public (anonymous) read on the feed content.
drop policy if exists "entities public read" on public.entities;
create policy "entities public read" on public.entities for select using (true);
drop policy if exists "articles public read" on public.articles;
create policy "articles public read" on public.articles for select using (true);
drop policy if exists "article_entities public read" on public.article_entities;
create policy "article_entities public read" on public.article_entities for select using (true);
drop policy if exists "comments public read" on public.comments;
create policy "comments public read" on public.comments for select using (true);

-- Per-user writes (own rows only).
drop policy if exists "follows own" on public.follows;
create policy "follows own" on public.follows for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "reactions own" on public.reactions;
create policy "reactions own" on public.reactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "comments insert own" on public.comments;
create policy "comments insert own" on public.comments for insert
  with check (auth.uid() = user_id);
drop policy if exists "comments update own" on public.comments;
create policy "comments update own" on public.comments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Seed entities + a few sample cards so the feed renders before the worker runs.
-- The real ingestion worker (scripts/ingest-feed.ts) upserts live RSS over this.
insert into public.entities (slug, name, kind) values
  ('brsr',          'BRSR',                 'framework'),
  ('csrd',          'CSRD / ESRS',          'framework'),
  ('sec-climate',   'SEC Climate Rule',     'framework'),
  ('ghg-protocol',  'GHG Protocol',         'framework'),
  ('scope-3',       'Scope 3 emissions',    'topic'),
  ('materiality',   'Double materiality',   'topic'),
  ('assurance',     'Assurance',            'topic'),
  ('india',         'India',                'region'),
  ('eu',            'European Union',       'region')
on conflict (slug) do nothing;

with seed(source, title, url, summary, published_at, ents) as (
  values
    ('Sample · SEBI', 'SEBI tightens BRSR Core assurance timelines for top listed entities',
     'https://example.com/esg/brsr-core-assurance',
     'India''s market regulator is phasing in reasonable assurance on BRSR Core KPIs for the largest listed companies, raising the bar on data quality and provenance for emissions and social metrics ahead of FY2025-26 filings.',
     now() - interval '2 hours', array['brsr','assurance','india']),
    ('Sample · EFRAG', 'EFRAG publishes guidance on double materiality under ESRS',
     'https://example.com/esg/esrs-double-materiality',
     'New application guidance clarifies how companies should run impact and financial materiality assessments under the EU''s ESRS, with worked examples for climate (E1) and own-workforce (S1) disclosures.',
     now() - interval '6 hours', array['csrd','materiality','eu']),
    ('Sample · GHG Protocol', 'Scope 3 land-sector guidance moves toward finalization',
     'https://example.com/esg/scope-3-land-sector',
     'The GHG Protocol is converging on updated Scope 3 accounting for land use and removals, a change that will reshape value-chain inventories for food, apparel and consumer-goods reporters.',
     now() - interval '1 day', array['ghg-protocol','scope-3']),
    ('Sample · SEC', 'Companies weigh Scope 1 and 2 readiness as climate disclosure stabilizes',
     'https://example.com/esg/sec-climate-readiness',
     'Filers are building controls for Scope 1 and 2 emissions and climate-risk narratives, prioritizing auditable activity data and emission-factor provenance over one-off estimates.',
     now() - interval '2 days', array['sec-climate','scope-3'])
)
insert into public.articles (source, title, url, summary, published_at)
select source, title, url, summary, published_at from seed
on conflict (url) do nothing;

-- Link the seeded articles to their entities.
insert into public.article_entities (article_id, entity_id)
select a.id, e.id
from (
  values
    ('https://example.com/esg/brsr-core-assurance',      array['brsr','assurance','india']),
    ('https://example.com/esg/esrs-double-materiality',  array['csrd','materiality','eu']),
    ('https://example.com/esg/scope-3-land-sector',       array['ghg-protocol','scope-3']),
    ('https://example.com/esg/sec-climate-readiness',     array['sec-climate','scope-3'])
) as s(url, slugs)
join public.articles a on a.url = s.url
join public.entities e on e.slug = any (s.slugs)
on conflict do nothing;
