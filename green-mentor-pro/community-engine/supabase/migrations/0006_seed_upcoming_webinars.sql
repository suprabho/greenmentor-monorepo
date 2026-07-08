-- Seed the upcoming July-2026 webinars from the Academy "Webinar Tracker"
-- sheet (week 2–5 schedule). Historical rows and their metrics were
-- intentionally not imported. Times default to 19:00 IST (13:30 UTC) —
-- placeholders for admins to correct, along with hooks/instructors that the
-- sheet hadn't filled in yet.
--
-- Seeded as 'published' so the learner platform lists them immediately;
-- guarded so re-running against a non-empty table inserts nothing.

insert into public.community_webinars (title, hook, instructors, scheduled_at, status)
select v.title, v.hook, v.instructors, v.scheduled_at, 'published'
from (
  values
    ('Carbon Market #1',  'Build a Career in Carbon Markets',                              array['Shubhi Goel'],     timestamptz '2026-07-08 13:30:00+00'),
    ('LongSight #2',      'ESG & BRSR Core for MSMEs and Suppliers',                       array['Amitava Mondal'],  timestamptz '2026-07-09 13:30:00+00'),
    ('GHG Lead #1',       'Become an In-Demand, Certified ISO 14064 GHG Lead Verifier',    array['Shreya Kalra'],    timestamptz '2026-07-11 13:30:00+00'),
    ('LCA #1',            'Become a Life Cycle Assessment Expert — Here''s How',           array['Vishal Pandhare'], timestamptz '2026-07-12 13:30:00+00'),
    ('ESG Reporting #1',  null,                                                            array['Shriya Singh'],    timestamptz '2026-07-15 13:30:00+00'),
    ('GHG Accounting #2', null,                                                            array[]::text[],          timestamptz '2026-07-16 13:30:00+00'),
    ('PGC #2',            'How to Build Practical ESG Capability in the Age of AI',        array['Sharath Chandra'], timestamptz '2026-07-18 13:30:00+00'),
    ('Carbon Market #2',  null,                                                            array['Shubhi Goel'],     timestamptz '2026-07-19 13:30:00+00'),
    ('ESG Career #2',     null,                                                            array[]::text[],          timestamptz '2026-07-22 13:30:00+00'),
    ('EFFAS',             null,                                                            array[]::text[],          timestamptz '2026-07-23 13:30:00+00'),
    ('PGC #3',            'How to Build Practical ESG Capability in the Age of AI',        array['Sharath Chandra'], timestamptz '2026-07-25 13:30:00+00'),
    ('LongSight #3',      null,                                                            array[]::text[],          timestamptz '2026-07-26 13:30:00+00'),
    ('ESG Reporting #2',  null,                                                            array[]::text[],          timestamptz '2026-07-29 13:30:00+00'),
    ('CSO discussion',    null,                                                            array[]::text[],          timestamptz '2026-07-30 13:30:00+00')
) as v(title, hook, instructors, scheduled_at)
where not exists (select 1 from public.community_webinars);
