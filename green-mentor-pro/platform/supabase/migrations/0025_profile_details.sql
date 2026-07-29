-- Green Mentor Pro — profile detail fields captured by the onboarding wizard
-- and editable afterwards from /profile.
-- Run after 0002_onboarding.sql in the Supabase SQL editor.
--
-- The name lives on the existing profiles.display_name (set by handle_new_user
-- on signup); email stays on auth.users. Only the phone pair is new.

alter table public.profiles
  add column if not exists phone         text,
  add column if not exists phone_country text,
  add column if not exists updated_at    timestamptz not null default now();

-- `phone` is stored E.164-joined ("+919876543210"); `phone_country` keeps the
-- ISO-3166 alpha-2 that produced the dial code so the picker can re-hydrate.
comment on column public.profiles.phone is 'E.164 phone, dial code + national number';
comment on column public.profiles.phone_country is 'ISO-3166 alpha-2 backing the dial code';

-- segment / billing_cycle were added as free text in 0002. The client models
-- them as unions — make the database agree. Existing rows are null or already
-- valid, so these validate without a backfill.
alter table public.profiles drop constraint if exists profiles_segment_check;
alter table public.profiles add constraint profiles_segment_check
  check (segment is null or segment in ('student', 'mid-career', 'business-leader'));

alter table public.profiles drop constraint if exists profiles_billing_cycle_check;
alter table public.profiles add constraint profiles_billing_cycle_check
  check (billing_cycle is null or billing_cycle in ('monthly', 'annual'));

-- Keep updated_at honest — the profile is now written from two places
-- (onboarding steps and the profile editor), both via PATCH /api/profile.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
