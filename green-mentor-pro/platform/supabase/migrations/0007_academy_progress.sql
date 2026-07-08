-- Green Mentor Pro — Bite-Sized Learning Module: enrolment + per-learner progress.
-- Run after 0006_academy_content.sql.
--
-- Anti-cheat / anti-gaming boundary (PRD §6.2 FR-V-04, §9, §14 risk #1): a
-- learner's browser must never be able to write its own completion state.
-- lesson_progress / module_progress / assessment_attempts get owner-only
-- SELECT and NO insert/update/delete policy for `authenticated` at all — every
-- write goes through the service-role admin client inside the academy API
-- routes (lib/academy/repo.ts, gamification.ts), which validates server-side
-- watched-ranges and recomputes assessment scoring itself. RLS here is the
-- primary defense, not a defensive backstop (contrast with 0004_chat.sql,
-- where RLS is a backstop behind app-level checks). `enrolments` is the one
-- exception — enrolling in a free course isn't a gameable action, so it gets
-- plain owner-scoped RLS like `follows`/`reactions` in 0003_feed.sql.

create table if not exists public.enrolments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  entitlement text not null default 'free' check (entitlement in ('free', 'paid')),
  cohort_id   uuid,
  enrolled_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.lesson_progress (
  user_id             uuid not null references auth.users (id) on delete cascade,
  lesson_id           uuid not null references public.lessons (id) on delete cascade,
  watched_seconds     integer not null default 0,
  furthest_position_s numeric not null default 0,
  watched_ranges      jsonb not null default '[]'::jsonb,  -- [[start,end], ...] merged union, seconds
  pct_watched         smallint not null default 0,
  completed_at        timestamptz,
  last_event_at       timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.module_progress (
  user_id        uuid not null references auth.users (id) on delete cascade,
  module_id      uuid not null references public.modules (id) on delete cascade,
  lessons_done   integer not null default 0,
  gate_passed_at timestamptz,
  completed_at   timestamptz,
  primary key (user_id, module_id)
);

create table if not exists public.assessment_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  attempt_no    integer not null,
  answers       jsonb not null,   -- [{question_id, selected_key, correct}]
  score_pct     numeric not null,
  passed        boolean not null,
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  unique (user_id, assessment_id, attempt_no)
);
create index if not exists assessment_attempts_lookup
  on public.assessment_attempts (user_id, assessment_id, attempt_no desc);

alter table public.enrolments          enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.module_progress     enable row level security;
alter table public.assessment_attempts enable row level security;

drop policy if exists "enrolments own" on public.enrolments;
create policy "enrolments own" on public.enrolments for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "lesson_progress own read" on public.lesson_progress;
create policy "lesson_progress own read" on public.lesson_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "module_progress own read" on public.module_progress;
create policy "module_progress own read" on public.module_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "assessment_attempts own read" on public.assessment_attempts;
create policy "assessment_attempts own read" on public.assessment_attempts for select to authenticated
  using (auth.uid() = user_id);
