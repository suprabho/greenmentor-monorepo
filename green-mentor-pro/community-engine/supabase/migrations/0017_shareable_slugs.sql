-- Shareable deeplinks for webinars and jobs.
--
-- The learner platform gets a per-item URL of the form
--
--     /webinars/{slug}-{id_prefix}      e.g. /webinars/ghg-lead-verifier-2-3f8a1c2e9d
--     /jobs/{slug}-{id_prefix}          e.g. /jobs/sustainability-csr-manager-8b21f0ac4e
--
-- `id_prefix` is what actually resolves the row; `slug` is decorative. That
-- split is deliberate: renaming a webinar never 404s a link someone already
-- shared, and the platform can 308 a stale slug to the canonical URL.
--
-- id_prefix is NOT unique-indexed. A unique index on a truncated uuid will
-- eventually reject an insert (birthday collision), and a failed insert is a
-- far worse outcome than an ambiguous lookup — which the platform resolver
-- disambiguates on slug anyway.
--
-- Both helper functions are `create or replace` here and in the platform's
-- 0026_article_slugs.sql, so the two migrations can be applied in either order.
--
-- Apply via the Supabase SQL Editor (runs as the privileged role) or psql.

-- ── Helpers ─────────────────────────────────────────────────────────────────

-- Deliberately ASCII-only: no unaccent, so this stays IMMUTABLE with no
-- extension dependency. lib/share/slug.ts mirrors this rule exactly.
create or replace function public.gm_slugify(input text)
returns text
language sql
immutable
as $$
  select btrim(
    left(
      btrim(regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'), '-'),
      60
    ),
    '-'
  )
$$;

-- Generic BEFORE trigger for any table with (id uuid, title text, slug text,
-- id_prefix text).
--
-- slug is filled only when blank, so editing a title later does NOT churn the
-- URL — existing links keep resolving to the same canonical path. Clear the
-- slug in the admin hub to regenerate it from the current title.
--
-- id_prefix is always recomputed from id, so it can't drift or be tampered
-- with. A plain trigger rather than a GENERATED column because the uuid->text
-- cast is an I/O conversion, whose immutability Postgres treats conservatively.
create or replace function public.gm_set_share_keys()
returns trigger language plpgsql as $$
begin
  if nullif(btrim(coalesce(new.slug, '')), '') is null then
    new.slug := nullif(public.gm_slugify(new.title), '');
  end if;
  new.id_prefix := left(replace(new.id::text, '-', ''), 10);
  return new;
end;
$$;

-- ── community_webinars ──────────────────────────────────────────────────────

alter table public.community_webinars
  add column if not exists slug      text,
  add column if not exists id_prefix text;

create index if not exists community_webinars_id_prefix_idx
  on public.community_webinars (id_prefix);

drop trigger if exists community_webinars_share_keys on public.community_webinars;
create trigger community_webinars_share_keys
  before insert or update on public.community_webinars
  for each row execute function public.gm_set_share_keys();

-- Backfill. The updated_at trigger is suspended so a one-time schema migration
-- doesn't rewrite every row's "last edited" stamp in the admin hub.
alter table public.community_webinars disable trigger community_webinars_updated_at;
update public.community_webinars
set slug      = coalesce(nullif(btrim(coalesce(slug, '')), ''), nullif(public.gm_slugify(title), '')),
    id_prefix = left(replace(id::text, '-', ''), 10)
where slug is null or btrim(slug) = '' or id_prefix is null;
alter table public.community_webinars enable trigger community_webinars_updated_at;

-- ── community_jobs ──────────────────────────────────────────────────────────

alter table public.community_jobs
  add column if not exists slug      text,
  add column if not exists id_prefix text;

create index if not exists community_jobs_id_prefix_idx
  on public.community_jobs (id_prefix);

drop trigger if exists community_jobs_share_keys on public.community_jobs;
create trigger community_jobs_share_keys
  before insert or update on public.community_jobs
  for each row execute function public.gm_set_share_keys();

alter table public.community_jobs disable trigger community_jobs_updated_at;
update public.community_jobs
set slug      = coalesce(nullif(btrim(coalesce(slug, '')), ''), nullif(public.gm_slugify(title), '')),
    id_prefix = left(replace(id::text, '-', ''), 10)
where slug is null or btrim(slug) = '' or id_prefix is null;
alter table public.community_jobs enable trigger community_jobs_updated_at;

-- ── Rebuild the publish views ───────────────────────────────────────────────
-- Column lists change, so these need a drop + create (create or replace can
-- only append). Same pattern as 0009_webinar_instructor_ids.sql. Both stay
-- SECURITY DEFINER (Postgres default; do NOT set security_invoker) so they
-- read past the base tables' RLS, and still expose only the safe columns —
-- never the funnel metrics, creatives_url, notes or the Zoom credentials.

drop view if exists public.webinars_public;
create or replace view public.webinars_public as
  select id, slug, id_prefix, title, hook, instructor_ids, scheduled_at,
         duration_minutes, registration_url, cover_image_url, status
  from public.community_webinars
  where status in ('published', 'completed');

grant select on public.webinars_public to anon, authenticated;

drop view if exists public.jobs_public;
create or replace view public.jobs_public as
  select id, slug, id_prefix, title, company, location, country, employment_type,
         experience, seniority, details, tags, apply_url, apply_email, salary,
         application_deadline, preferred, posted_on, status
  from public.community_jobs
  where status = 'published';

grant select on public.jobs_public to anon, authenticated;
