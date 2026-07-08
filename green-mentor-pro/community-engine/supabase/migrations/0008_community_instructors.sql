-- community_instructors — the roster CMS behind webinar instructor selection.
-- Mirrors the platform `Mentor` shape (platform/lib/data/mentors.ts): the fields
-- the "Our Mentors" cards render, now editable in the admin hub and selectable
-- on webinars by id.
--
-- Unlike community_webinars/community_stories (which hide sales metrics behind an
-- RLS-no-policies wall + a view), instructor records carry nothing sensitive —
-- they're public professional profiles. So RLS is enabled with a plain public
-- read policy; writes have no policy, so only the service-role client (behind
-- requireAdmin()) can create/update/delete.

create table if not exists public.community_instructors (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  role         text,                 -- current headline / what they do
  company      text,                 -- primary affiliation
  location     text,
  education    text,                 -- alma mater credential line
  initials     text        not null default '',  -- avatar fallback, e.g. "KK"
  photo        text,                 -- headshot URL/path (falls back to initials)
  tags         text[]      not null default '{}', -- expertise chips
  linkedin_url text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists community_instructors_name_idx on public.community_instructors (lower(name));

create or replace function public.community_instructors_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_instructors_updated_at on public.community_instructors;
create trigger community_instructors_updated_at
  before update on public.community_instructors
  for each row execute function public.community_instructors_set_updated_at();

-- Public read (professional profiles, nothing sensitive); writes are service-role
-- only (no insert/update/delete policy → PostgREST anon/authenticated get denied).
alter table public.community_instructors enable row level security;

drop policy if exists "community_instructors public read" on public.community_instructors;
create policy "community_instructors public read" on public.community_instructors
  for select using (true);

-- Seed from the platform mentor roster so the CMS and webinar picker start with
-- data. Guarded so re-running against a non-empty table inserts nothing.
insert into public.community_instructors (name, role, company, location, education, initials, photo, tags)
select v.name, v.role, v.company, v.location, v.education, v.initials, v.photo, v.tags
from (
  values
    ('Karuna Kalra',   'ESG & Sustainability Professional',          'Independent advisor',              'United Kingdom', 'The Fletcher School, Tufts University',            'KK', '/mentors/karuna.jpeg',  array['ESG Strategy','Sustainability Policy','Climate Risk']),
    ('Shreya Kalra',   'Business Sustainability Professional',        'InCorp India',                     'New Delhi',      'TERI School of Advanced Studies',                  'SK', '/mentors/shreya.jpeg',  array['ESG Reporting','BRSR','Sustainability Strategy']),
    ('Amitava Mandal', 'Consulting, Analytics & Project Management',  'Greenmentor',                      'India',          'TERI School of Advanced Studies',                  'AM', '/mentors/amitava.jpeg', array['ESG Analytics','Consulting','Project Management']),
    ('Sumit Jugran',   'Sustainability Professional',                 'Value Sustainable',                'Gurugram',       'University of Pune',                               'SJ', '/mentors/sumit.jpeg',   array['Sustainability Strategy','ESG Advisory','Stakeholder Engagement']),
    ('Vidya Chavan',   'Sustainability Strategy & ESG Specialist',    'KPIT',                             'Pune',           'University of Petroleum & Energy Studies (UPES)',  'VC', '/mentors/vidya.jpeg',   array['ESG Strategy','Sustainability Reporting','Carbon Management']),
    ('Vishal Pandhare','Global Sustainability Consultant',            'Ecomantra Sustainable Engineering','Pune',           null,                                               'VP', '/mentors/vishal.jpeg',  array['CBAM','GHG Accounting','LCA & EPD']),
    ('Shubhi Goel',    'Carbon Markets Specialist',                   null,                               null,             null,                                               'SG', null,                    array['Carbon Markets']),
    ('Shriya Singh',   'ESG Reporting Specialist',                    null,                               null,             null,                                               'SS', null,                    array['ESG Reporting']),
    ('Sharath Chandra','ESG Capability & AI',                         null,                               null,             null,                                               'SC', null,                    array['ESG Capability','AI'])
) as v(name, role, company, location, education, initials, photo, tags)
where not exists (select 1 from public.community_instructors);
