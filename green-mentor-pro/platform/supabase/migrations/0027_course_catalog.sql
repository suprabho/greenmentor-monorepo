-- course_catalog — the merchandising record for every course we sell, whether it
-- runs in the in-app player or on Learnyst. Written only by
-- scripts/import-course-catalog.ts through the service-role client from
-- scripts/data/course-catalog.csv; RLS is enabled with no policies and reads go
-- through the course_catalog_public view below. Same conventions as
-- 0021_sasb_materiality.sql.
--
-- Why a new table rather than columns on public.courses: `courses` is the
-- authored content behind the in-app player — modules, lessons, assessments,
-- enrolments and both progress tables FK to it, and track_id is NOT NULL. Only
-- one of the twelve catalog entries (esg-fundamentals) has any of that; the
-- other eleven live on Learnyst with no track/module/lesson rows here. Folding
-- them in would need a placeholder "external" track plus a discriminator that
-- every existing player query has to remember to filter on — miss one and
-- /academy/<slug> renders a player with no content.
--
-- Split of authority: public.courses owns structure + progress, course_catalog
-- owns price, positioning and links. course_catalog.course_id ties the two
-- together for hosted_on='in_app' rows. public.courses is not touched here.
--
-- Apply to the shared Supabase project via the SQL Editor (privileged role) or
-- psql. Safe to re-run. (Next free prefix after 0026_article_slugs.sql.)

create or replace function public.course_catalog_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.course_catalog (
  id                uuid        primary key default gen_random_uuid(),
  slug              text        not null unique,

  -- How it is taught, and where it runs. Together these decide which card the
  -- UI renders and whether the link leaves the app.
  delivery          text        not null check (delivery in ('self_paced', 'live')),
  hosted_on         text        not null check (hosted_on in ('in_app', 'learnyst')),
  course_id         uuid        references public.courses (id) on delete restrict,

  title             text        not null,
  framework         text        not null,
  level             text        not null check (level in ('beginner', 'foundation', 'intermediate', 'advanced')),
  description       text        not null default '',
  outcome           text        not null default '',

  module_count      integer     check (module_count is null or module_count >= 0),
  lesson_count      integer     check (lesson_count  is null or lesson_count  >= 0),
  duration_label    text,

  price_inr         integer     check (price_inr is null or price_inr >= 0),
  included_in_plus  boolean     not null default true,

  course_url        text        not null,

  next_cohort_at    date,
  next_cohort_label text,

  instructors       text[]      not null default '{}',
  cover_image_url   text,

  status            text        not null default 'draft' check (status in ('draft', 'published', 'archived')),
  position          integer     not null default 0,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- An in-app card must resolve to a real player course AND to an internal
  -- path, or it renders a link into a player with nothing behind it.
  constraint course_catalog_in_app_linked
    check (hosted_on <> 'in_app' or (course_id is not null and course_url like '/%')),
  constraint course_catalog_external_url
    check (hosted_on <> 'learnyst' or course_url like 'http%')
);

comment on table public.course_catalog is
  'Merchandising record for every course we sell. public.courses is the authored content for the subset that has an in-app player.';
comment on column public.course_catalog.framework is
  'Marketing taxonomy label. Deliberately free text, not a check constraint — a constraint here needs a hand-applied migration every time marketing renames a label.';
comment on column public.course_catalog.duration_label is
  'Verbatim display string ("~67 min", "9.5 hours", "4 days"). Not normalised to seconds: the source mixes units and the value is display-only.';
comment on column public.course_catalog.price_inr is
  'Standalone INR list price. 0 = free, null = not sold standalone. Distinct from courses.price_credits, which is in-app credits.';
comment on column public.course_catalog.included_in_plus is
  'True = bundled into Plus Essential. Product decision 2026-07-29: ALL courses are included, including the four live programmes whose source CSV says "No". scripts/import-course-catalog.ts applies that override explicitly and records it per row in notes.';
comment on column public.course_catalog.course_url is
  'Absolute Learnyst URL when hosted_on=learnyst; in-app path (/academy/<slug>) when hosted_on=in_app. Stored rather than composed from lib/learnyst/config.ts, so the row is a faithful copy of the source sheet.';
comment on column public.course_catalog.next_cohort_at is
  'Date-only on purpose: the source has no time and no timezone. A timestamptz would render a day early for anyone west of IST.';
comment on column public.course_catalog.notes is
  'Internal ops text, including the audit line for any applied override. Never exposed by course_catalog_public.';

create index if not exists course_catalog_published_idx
  on public.course_catalog (position) where status = 'published';

drop trigger if exists course_catalog_updated_at on public.course_catalog;
create trigger course_catalog_updated_at
  before update on public.course_catalog
  for each row execute function public.course_catalog_set_updated_at();

-- RLS on with no policies: anon and authenticated get zero rows from the table
-- directly. Reads go through the view below; writes are service-role only.
alter table public.course_catalog enable row level security;

-- ── Publish surface — a SECURITY DEFINER view (Postgres default; do NOT set
-- security_invoker), granted to anon + authenticated. The landing page renders
-- this logged-out. Withholds notes/status/id/course_id and the timestamps;
-- every column it does expose is already public on the marketing site. ───────
create or replace view public.course_catalog_public as
  select slug, delivery, hosted_on, title, framework, level, description, outcome,
         module_count, lesson_count, duration_label, price_inr, included_in_plus,
         course_url, next_cohort_at, next_cohort_label, instructors,
         cover_image_url, position
  from public.course_catalog
  where status = 'published';

grant select on public.course_catalog_public to anon, authenticated;
