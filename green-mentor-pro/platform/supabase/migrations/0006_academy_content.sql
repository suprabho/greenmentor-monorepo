-- Green Mentor Pro — Bite-Sized Learning Module: authored content.
-- Run in the Supabase SQL editor for project haokazwcljdummkvufcg, after 0005.
-- Content is authored by the seed migration (0009) via the service-role admin
-- client, which bypasses RLS — there is no client-side write policy on any
-- table in this file. The community-engine authoring UI is deferred (see
-- PRD-Bite-Sized-Learning-Module.md §7); this pass is learner-facing only.

create table if not exists public.tracks (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  title      text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id                       uuid primary key default gen_random_uuid(),
  track_id                 uuid not null references public.tracks (id) on delete restrict,
  slug                     text not null unique,
  title                    text not null,
  description              text,
  level                    text not null default 'beginner' check (level in ('beginner', 'intermediate', 'advanced')),
  price_credits            integer not null default 0,
  status                   text not null default 'draft' check (status in ('draft', 'review', 'published')),
  cover_image_object_path  text,
  position                 integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create table if not exists public.modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses (id) on delete cascade,
  position    integer not null,
  title       text not null,
  description text,
  unlock_rule text not null default 'sequential' check (unlock_rule in ('sequential', 'free')),
  created_at  timestamptz not null default now(),
  unique (course_id, position)
);

create table if not exists public.lessons (
  id                       uuid primary key default gen_random_uuid(),
  module_id                uuid not null references public.modules (id) on delete cascade,
  position                 integer not null,
  type                     text not null default 'video' check (type in ('video', 'blocks')),
  title                    text not null,
  objective                text,
  key_topics               text[] not null default '{}',
  video_object_path        text,
  poster_object_path       text,
  duration_seconds         integer,
  completion_threshold_pct smallint not null default 90 check (completion_threshold_pct between 1 and 100),
  transcript               text,
  summary_block            text,
  created_at               timestamptz not null default now(),
  unique (module_id, position),
  check (type <> 'video' or video_object_path is not null)
);

-- scope='module' → module gate (the PRD's Figma quiz); scope='lesson' → an
-- ungraded lesson-level quick check (FR-Q-07, P1 — table shape exists now,
-- unused this pass).
create table if not exists public.assessments (
  id                     uuid primary key default gen_random_uuid(),
  scope                  text not null check (scope in ('module', 'lesson')),
  module_id              uuid references public.modules (id) on delete cascade,
  lesson_id              uuid references public.lessons (id) on delete cascade,
  title                  text not null default 'Module check',
  pass_threshold_pct     smallint not null default 70,
  max_attempts           integer,          -- null = unlimited
  retry_cooldown_seconds integer not null default 0,
  shuffle_options        boolean not null default true,
  xp_award               integer not null default 25,
  coin_award             integer not null default 25,
  created_at             timestamptz not null default now(),
  check (
    (scope = 'module' and module_id is not null and lesson_id is null) or
    (scope = 'lesson' and lesson_id is not null and module_id is null)
  )
);
-- v1: at most one gate assessment per module.
create unique index if not exists assessments_one_gate_per_module
  on public.assessments (module_id) where scope = 'module';

create table if not exists public.questions (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  position      integer not null,
  stem          text not null,
  type          text not null default 'single_select' check (type = 'single_select'), -- v1 only (PRD §5.2)
  options       jsonb not null,   -- [{ "key": "a", "text": "..." }, ...] — four options
  correct_key   text not null,
  explanation   text,
  topic_tag     text,
  unique (assessment_id, position)
);

alter table public.tracks      enable row level security;
alter table public.courses     enable row level security;
alter table public.modules     enable row level security;
alter table public.lessons     enable row level security;
alter table public.assessments enable row level security;
alter table public.questions   enable row level security;

-- Content is readable by signed-in users once published. No anonymous browse
-- this pass (every P0 screen needs progress/enrolment context anyway).
drop policy if exists "tracks readable" on public.tracks;
create policy "tracks readable" on public.tracks for select to authenticated using (true);

drop policy if exists "courses published read" on public.courses;
create policy "courses published read" on public.courses for select to authenticated
  using (status = 'published');

drop policy if exists "modules published read" on public.modules;
create policy "modules published read" on public.modules for select to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.status = 'published'));

drop policy if exists "lessons published read" on public.lessons;
create policy "lessons published read" on public.lessons for select to authenticated
  using (exists (
    select 1 from public.modules m join public.courses c on c.id = m.course_id
    where m.id = module_id and c.status = 'published'
  ));

drop policy if exists "assessments published read" on public.assessments;
create policy "assessments published read" on public.assessments for select to authenticated
  using (
    (module_id is not null and exists (
      select 1 from public.modules m join public.courses c on c.id = m.course_id
      where m.id = module_id and c.status = 'published'
    )) or
    (lesson_id is not null and exists (
      select 1 from public.lessons l join public.modules m on m.id = l.module_id
      join public.courses c on c.id = m.course_id
      where l.id = lesson_id and c.status = 'published'
    ))
  );

-- questions: NO select policy at all for anon/authenticated (default deny).
-- Correctness (correct_key) must never reach the browser. Learner-facing
-- reads go through question_public below; correctness checks go through the
-- service-role admin client in the check-answer/submit route handlers.
-- (Same SECURITY DEFINER masking-view pattern as article_social_stats /
-- feed_comments in 0004_feed_social.sql.)
create or replace view public.question_public
with (security_invoker = off) as
select q.id, q.assessment_id, q.position, q.stem, q.type, q.options, q.topic_tag
from public.questions q
join public.assessments a on a.id = q.assessment_id
where
  (a.module_id is not null and exists (
    select 1 from public.modules m join public.courses c on c.id = m.course_id
    where m.id = a.module_id and c.status = 'published'
  )) or
  (a.lesson_id is not null and exists (
    select 1 from public.lessons l join public.modules m on m.id = l.module_id
    join public.courses c on c.id = m.course_id
    where l.id = a.lesson_id and c.status = 'published'
  ));
grant select on public.question_public to authenticated;

-- Private bucket for lesson video (admin-signed URLs only, same shape as
-- chat-uploads in 0004_chat.sql — no storage.objects policies needed).
-- Public bucket for poster thumbnails (not sensitive; avoids a signing
-- round trip for every lesson-list thumbnail).
insert into storage.buckets (id, name, public) values ('academy-videos', 'academy-videos', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('academy-posters', 'academy-posters', true)
  on conflict (id) do nothing;
