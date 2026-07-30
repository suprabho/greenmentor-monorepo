-- course_catalog: bundles.
--
-- A bundle is a SKU like a course — price, URL, level, description, outcome —
-- but it has no framework, no delivery mode, and it *contains* courses. Rather
-- than a parallel table duplicating a dozen columns and a second card pipeline,
-- it goes in course_catalog behind a `kind` discriminator, with membership in
-- the course_bundle_items join table below.
--
-- Written only by scripts/import-course-catalog.ts through the service-role
-- client. Reads go through the *_public views. Run in the Supabase SQL editor
-- for project haokazwcljdummkvufcg, after 0027_course_catalog.sql. Safe to re-run.

alter table public.course_catalog add column if not exists kind text not null default 'course';
alter table public.course_catalog add column if not exists course_count integer;

-- Bundles have neither: the sheet leaves Framework blank, and "how it is taught"
-- is a property of the member courses, not of the bundle.
alter table public.course_catalog alter column framework drop not null;
alter table public.course_catalog alter column delivery drop not null;

-- Idempotent constraint refresh (Postgres has no ADD CONSTRAINT IF NOT EXISTS).
alter table public.course_catalog drop constraint if exists course_catalog_kind_check;
alter table public.course_catalog add constraint course_catalog_kind_check
  check (kind in ('course', 'bundle'));

alter table public.course_catalog drop constraint if exists course_catalog_course_count_check;
alter table public.course_catalog add constraint course_catalog_course_count_check
  check (course_count is null or course_count > 0);

-- Keep the two shapes honest: a course still needs a framework and a delivery
-- mode, a bundle needs a course count and must not claim either.
alter table public.course_catalog drop constraint if exists course_catalog_course_shape;
alter table public.course_catalog add constraint course_catalog_course_shape
  check (kind <> 'course' or (framework is not null and delivery is not null));

alter table public.course_catalog drop constraint if exists course_catalog_bundle_shape;
alter table public.course_catalog add constraint course_catalog_bundle_shape
  check (kind <> 'bundle' or (course_count is not null and delivery is null and framework is null));

comment on column public.course_catalog.kind is
  'course = a single SKU with its own content; bundle = a priced collection of courses, with membership in course_bundle_items.';
comment on column public.course_catalog.course_count is
  'Bundles only: how many courses the bundle advertises. Kept as its own column rather than reusing module_count, which means modules-within-a-course. The importer warns when this disagrees with the number of course_bundle_items rows.';

-- ── Bundle membership ────────────────────────────────────────────────────────
-- Slug-keyed rather than id-keyed: the sheet names courses by slug, so the FK
-- fails loudly on a typo at import time instead of resolving to nothing.
create table if not exists public.course_bundle_items (
  bundle_slug text    not null references public.course_catalog (slug) on update cascade on delete cascade,
  course_slug text    not null references public.course_catalog (slug) on update cascade on delete restrict,
  position    integer not null default 0,
  primary key (bundle_slug, course_slug),
  constraint course_bundle_items_not_self check (bundle_slug <> course_slug)
);

comment on table public.course_bundle_items is
  'Which courses each bundle contains. Populated from the "Bundle Courses" column of the intake sheet; a bundle with no rows here renders as counts only.';

create index if not exists course_bundle_items_bundle_idx
  on public.course_bundle_items (bundle_slug, position);

alter table public.course_bundle_items enable row level security;
-- No policies: reads go through course_bundle_items_public, writes are
-- service-role only. Same shape as course_catalog in 0027.

-- ── Publish surfaces ─────────────────────────────────────────────────────────
-- Recreated (not altered) because the column list changes; CREATE OR REPLACE
-- VIEW cannot add columns in the middle, so drop first.
drop view if exists public.course_catalog_public;
create view public.course_catalog_public as
  select slug, kind, delivery, hosted_on, title, framework, level, description, outcome,
         module_count, lesson_count, course_count, duration_label, price_inr, included_in_plus,
         course_url, next_cohort_at, next_cohort_label, instructors,
         cover_image_url, position
  from public.course_catalog
  where status = 'published';

grant select on public.course_catalog_public to anon, authenticated;

-- Membership, restricted to published rows on both sides so an unpublished
-- course can't leak through a bundle's course list.
create or replace view public.course_bundle_items_public as
  select i.bundle_slug, i.course_slug, i.position
  from public.course_bundle_items i
  join public.course_catalog b on b.slug = i.bundle_slug and b.status = 'published'
  join public.course_catalog c on c.slug = i.course_slug and c.status = 'published';

grant select on public.course_bundle_items_public to anon, authenticated;
