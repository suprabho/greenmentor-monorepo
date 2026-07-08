-- Green Mentor Pro — Bite-Sized Learning Module: gamification + the shared
-- credits ledger. Run after 0007_academy_progress.sql.
--
-- credit_transactions is the FIRST credit ledger anywhere in this repo.
-- "Coins" in the learner UI and "credits" everywhere else in the product are
-- this one balance (PRD §8.1) — there is no second currency. Balance is
-- computed on read (sum(amount)); no cached column, since the ledger is tiny
-- at this stage (see lib/academy/repo.ts fetchHeaderStats).
--
-- Same owner-read-only / admin-write-only shape as 0007_academy_progress.sql,
-- for the same anti-gaming reason: XP/coin awards must only ever be produced
-- by the server-side gamification helpers, never by a client write.

create table if not exists public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  event_type text not null,   -- lesson_completed | module_gate_passed | course_completed | streak_milestone | perfect_assessment
  event_ref  text not null,   -- e.g. 'lesson:<id>', 'assessment:<id>', 'course:<id>', 'streak:7:<date>'
  xp         integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, event_ref)
);
create index if not exists xp_events_user_idx on public.xp_events (user_id, created_at desc);

create table if not exists public.credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('earn', 'topup', 'spend', 'adjustment')),
  amount      integer not null,  -- signed: earn/topup positive, spend negative
  ref         text,              -- idempotency key; shared with xp_events.event_ref for gamification earns
  description text,
  created_at  timestamptz not null default now(),
  unique (user_id, ref)
);
create index if not exists credit_transactions_user_idx on public.credit_transactions (user_id, created_at desc);

create table if not exists public.streaks (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  current_len       integer not null default 0,
  longest_len       integer not null default 0,
  last_active_date  date,
  freezes_held      integer not null default 0,   -- P1: never consumed this pass (pricing/grant rules unset — PRD §14)
  updated_at        timestamptz not null default now()
);

create table if not exists public.badges_awarded (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  badge_key  text not null,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

alter table public.xp_events           enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.streaks             enable row level security;
alter table public.badges_awarded      enable row level security;

drop policy if exists "xp_events own read" on public.xp_events;
create policy "xp_events own read" on public.xp_events for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "credit_transactions own read" on public.credit_transactions;
create policy "credit_transactions own read" on public.credit_transactions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "streaks own read" on public.streaks;
create policy "streaks own read" on public.streaks for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "badges_awarded own read" on public.badges_awarded;
create policy "badges_awarded own read" on public.badges_awarded for select to authenticated
  using (auth.uid() = user_id);
