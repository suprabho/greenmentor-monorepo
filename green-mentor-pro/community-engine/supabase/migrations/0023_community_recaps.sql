-- Weekly ESG recaps: an AI-generated multi-topic digest of the week's ESG
-- developments, grounded in the feed pipeline's articles plus optional
-- admin-curated URLs. Topics seed the Stories compose flow — an admin attaches
-- a recap as a source and picks ONE topic, which steers angles generation.
--
-- Same trust model as 0004/0013: RLS enabled with NO policies — all access
-- goes through the service-role client behind the admin allowlist gate.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

create table if not exists public.community_recaps (
  id            uuid        primary key default gen_random_uuid(),
  title         text        not null,
  period_start  date        not null,
  period_end    date        not null,
  -- Full assembled recap document (deterministic markdown; the model writes
  -- topic analysis, code writes the citation lists).
  markdown      text        not null,
  -- RecapTopic[] — see lib/db/recaps.ts. Source refs are resolved (real
  -- titles/urls), so a topic is attachable to a story without re-derivation.
  topics        jsonb       not null default '[]'::jsonb,
  -- {url, title}[] the admin pasted for this run (empty for worker runs).
  curated_urls  jsonb       not null default '[]'::jsonb,
  -- uuid[] of the feed articles the model actually read, for auditability.
  article_ids   jsonb       not null default '[]'::jsonb,
  model         text,
  status        text        not null default 'complete' check (status in ('complete', 'failed')),
  error         text,
  generated_at  timestamptz not null default now(),
  -- Admin email for on-demand runs; null for the scheduled worker.
  created_by    text,
  created_at    timestamptz not null default now()
);

create index if not exists community_recaps_generated_at_idx
  on public.community_recaps (generated_at desc);

alter table public.community_recaps enable row level security;
