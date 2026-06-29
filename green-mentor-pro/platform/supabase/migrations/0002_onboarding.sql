-- Green Mentor Pro — onboarding funnel result, stored on the profile row.
-- Run after 0001_profiles.sql in the Supabase SQL editor.

alter table public.profiles
  add column if not exists segment       text,
  add column if not exists goals         text[] not null default '{}',
  add column if not exists plan_id        text,
  add column if not exists billing_cycle  text,
  add column if not exists onboarded      boolean not null default false;
