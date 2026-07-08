-- Green Mentor Pro — Bite-Sized Learning Module: seed one demo course.
-- Run after 0008_academy_gamification.sql. Idempotent (safe to re-run) via
-- `on conflict ... do update ... returning id` on each table's natural key.
--
-- Content is adapted from the prototype's ESG Fundamentals mock
-- (green-mentor-pro/prototype/lib/data.ts: fundamentalModules/lesson/quiz) so
-- it reads like real ESG content rather than lorem ipsum. video_object_path /
-- poster_object_path point at objects that scripts/seed-academy-media.ts
-- uploads in a separate step — this migration only writes rows.

do $$
declare
  v_track_id   uuid;
  v_course_id  uuid;
  v_m1_id      uuid;
  v_m2_id      uuid;
  v_m3_id      uuid;
  v_lesson_id  uuid;
  v_assess_id  uuid;
begin
  insert into public.tracks (slug, title)
  values ('esg-foundations', 'ESG Career Foundations')
  on conflict (slug) do update set title = excluded.title
  returning id into v_track_id;

  insert into public.courses (track_id, slug, title, description, level, price_credits, status, position)
  values (
    v_track_id,
    'esg-fundamentals-bites',
    'ESG Fundamentals — Bite-Sized',
    'The free on-ramp: what ESG is, why it pays, and how reporting actually works — in short video lessons with a quick check after every module.',
    'beginner', 0, 'published', 0
  )
  on conflict (slug) do update set
    title = excluded.title, description = excluded.description, status = excluded.status
  returning id into v_course_id;

  -- ── Module 1: What ESG Actually Is ──────────────────────────────────────
  insert into public.modules (course_id, position, title, description)
  values (v_course_id, 0, 'What ESG Actually Is', 'The three pillars, and why ESG performance is now a commercial signal, not just a compliance line item.')
  on conflict (course_id, position) do update set title = excluded.title
  returning id into v_m1_id;

  insert into public.lessons (module_id, position, type, title, objective, key_topics, video_object_path, poster_object_path, duration_seconds, summary_block)
  values (
    v_m1_id, 0, 'video', 'Why ESG pays: from compliance to competitive edge',
    'Understand why investors, lenders and customers now price ESG performance directly.',
    array['ESG basics', 'stakeholder capitalism', 'cost of capital'],
    'esg-fundamentals-bites/m1/l1.mp4', 'esg-fundamentals-bites/m1/l1.jpg', 30,
    'ESG stopped being a side report once lenders and investors started pricing it directly — it now shows up in your cost of capital, your customer contracts, and your talent pipeline.'
  )
  on conflict (module_id, position) do update set title = excluded.title;

  insert into public.lessons (module_id, position, type, title, objective, key_topics, video_object_path, poster_object_path, duration_seconds, summary_block)
  values (
    v_m1_id, 1, 'video', 'The three pillars: Environment, Social, Governance',
    'Map the E/S/G split and see where each pillar shows up in a real disclosure.',
    array['environment', 'social', 'governance'],
    'esg-fundamentals-bites/m1/l2.mp4', 'esg-fundamentals-bites/m1/l2.jpg', 30,
    'Environment covers what a company takes from and returns to the planet; Social covers how it treats people; Governance covers who decides and how they''re held accountable.'
  )
  on conflict (module_id, position) do update set title = excluded.title;

  insert into public.assessments (scope, module_id, title, pass_threshold_pct, xp_award, coin_award)
  values ('module', v_m1_id, 'Module check: What ESG Actually Is', 70, 25, 25)
  on conflict (module_id) where scope = 'module' do update set title = excluded.title
  returning id into v_assess_id;

  insert into public.questions (assessment_id, position, stem, options, correct_key, explanation, topic_tag)
  values
    (v_assess_id, 0, 'ESG performance most directly affects a company''s...',
     '[{"key":"a","text":"Cost of capital and access to financing"},{"key":"b","text":"Office furniture budget"},{"key":"c","text":"Choice of accounting software"},{"key":"d","text":"Public holiday calendar"}]'::jsonb,
     'a', 'Lenders and investors increasingly price ESG risk into loan terms and valuations — it shows up as a real cost-of-capital effect, not just a reputational one.', 'esg-basics'),
    (v_assess_id, 1, 'Which pillar does "board independence and executive pay" fall under?',
     '[{"key":"a","text":"Environment"},{"key":"b","text":"Social"},{"key":"c","text":"Governance"},{"key":"d","text":"None — it''s a legal matter, not ESG"}]'::jsonb,
     'c', 'Governance covers who makes decisions and how they''re held accountable — board composition and executive compensation are classic governance disclosures.', 'esg-basics'),
    (v_assess_id, 2, 'A company reducing its water withdrawal at a factory is primarily addressing which pillar?',
     '[{"key":"a","text":"Environment"},{"key":"b","text":"Social"},{"key":"c","text":"Governance"},{"key":"d","text":"Financial"}]'::jsonb,
     'a', 'Water withdrawal, emissions and waste are Environment-pillar metrics — the physical footprint of operations.', 'esg-basics')
  on conflict (assessment_id, position) do update set stem = excluded.stem;

  -- ── Module 2: The Reporting Landscape ───────────────────────────────────
  insert into public.modules (course_id, position, title, description)
  values (v_course_id, 1, 'The Reporting Landscape: BRSR, GRI, CSRD', 'The three frameworks you''ll actually encounter as an ESG practitioner in India, and how they relate to each other.')
  on conflict (course_id, position) do update set title = excluded.title
  returning id into v_m2_id;

  insert into public.lessons (module_id, position, type, title, objective, key_topics, video_object_path, poster_object_path, duration_seconds, summary_block)
  values (
    v_m2_id, 0, 'video', 'BRSR: India''s Business Responsibility & Sustainability Report',
    'Learn the structure of BRSR — Sections A, B and C — and who has to file it.',
    array['BRSR', 'SEBI', 'disclosure'],
    'esg-fundamentals-bites/m2/l1.mp4', 'esg-fundamentals-bites/m2/l1.jpg', 30,
    'BRSR is SEBI''s mandatory disclosure for the top listed Indian companies: general info (A), management & process (B), and principle-wise performance (C).'
  )
  on conflict (module_id, position) do update set title = excluded.title;

  insert into public.lessons (module_id, position, type, title, objective, key_topics, video_object_path, poster_object_path, duration_seconds, summary_block)
  values (
    v_m2_id, 1, 'video', 'GRI Standards: the global baseline',
    'See how GRI''s topic-based structure differs from BRSR''s principle-based one.',
    array['GRI', 'global reporting', 'topic standards'],
    'esg-fundamentals-bites/m2/l2.mp4', 'esg-fundamentals-bites/m2/l2.jpg', 30,
    'GRI is the most widely used global standard — organized by topic (emissions, labor, anti-corruption) rather than by principle, and voluntary unless a market mandates it.'
  )
  on conflict (module_id, position) do update set title = excluded.title;

  insert into public.lessons (module_id, position, type, title, objective, key_topics, video_object_path, poster_object_path, duration_seconds, summary_block)
  values (
    v_m2_id, 2, 'video', 'CSRD & ESRS: what Indian exporters need to know',
    'Understand when an Indian company gets pulled into the EU''s CSRD net via its value chain.',
    array['CSRD', 'ESRS', 'EU', 'value chain'],
    'esg-fundamentals-bites/m2/l3.mp4', 'esg-fundamentals-bites/m2/l3.jpg', 30,
    'CSRD applies directly to large EU companies, but its value-chain disclosure requirements mean Indian exporters are increasingly asked for ESRS-shaped data by EU customers.'
  )
  on conflict (module_id, position) do update set title = excluded.title;

  insert into public.assessments (scope, module_id, title, pass_threshold_pct, xp_award, coin_award)
  values ('module', v_m2_id, 'Module check: The Reporting Landscape', 70, 25, 25)
  on conflict (module_id) where scope = 'module' do update set title = excluded.title
  returning id into v_assess_id;

  insert into public.questions (assessment_id, position, stem, options, correct_key, explanation, topic_tag)
  values
    (v_assess_id, 0, 'BRSR is mandated by which regulator?',
     '[{"key":"a","text":"SEBI"},{"key":"b","text":"RBI"},{"key":"c","text":"MCA"},{"key":"d","text":"EFRAG"}]'::jsonb,
     'a', 'SEBI mandates BRSR for the top listed entities by market capitalization.', 'brsr'),
    (v_assess_id, 1, 'GRI Standards are organized primarily by...',
     '[{"key":"a","text":"Company size"},{"key":"b","text":"Topic (e.g. emissions, labor, anti-corruption)"},{"key":"c","text":"Country of listing"},{"key":"d","text":"Fiscal year"}]'::jsonb,
     'b', 'GRI takes a topic-based approach, unlike BRSR''s principle-based structure.', 'gri'),
    (v_assess_id, 2, 'An Indian manufacturer exporting to the EU might need CSRD-shaped data because of...',
     '[{"key":"a","text":"Direct CSRD jurisdiction over Indian companies"},{"key":"b","text":"Value-chain disclosure requests from its EU customers"},{"key":"c","text":"A new Indian law copying CSRD"},{"key":"d","text":"WTO trade rules"}]'::jsonb,
     'b', 'CSRD doesn''t apply directly to most Indian companies, but large EU reporters must disclose value-chain data — so they push ESRS-shaped requests down to suppliers.', 'csrd'),
    (v_assess_id, 3, 'Which BRSR section covers principle-wise performance disclosures?',
     '[{"key":"a","text":"Section A"},{"key":"b","text":"Section B"},{"key":"c","text":"Section C"},{"key":"d","text":"There is no such section"}]'::jsonb,
     'c', 'Section A is general company info, Section B is management & process, Section C is the principle-wise performance detail.', 'brsr')
  on conflict (assessment_id, position) do update set stem = excluded.stem;

  -- ── Module 3: Environment — Emissions, Water, Waste ─────────────────────
  insert into public.modules (course_id, position, title, description)
  values (v_course_id, 2, 'Environment: Emissions, Water, Waste', 'Scopes 1, 2 and 3, plus the water and waste metrics that round out an Environment disclosure.')
  on conflict (course_id, position) do update set title = excluded.title
  returning id into v_m3_id;

  insert into public.lessons (module_id, position, type, title, objective, key_topics, video_object_path, poster_object_path, duration_seconds, summary_block)
  values (
    v_m3_id, 0, 'video', 'Scope 1, 2 and 3 — drawing the boundary',
    'Learn the GHG Protocol''s three-scope model and how to classify a given emission source.',
    array['scope 1', 'scope 2', 'scope 3', 'GHG Protocol'],
    'esg-fundamentals-bites/m3/l1.mp4', 'esg-fundamentals-bites/m3/l1.jpg', 30,
    'Scopes are about control and cause: you control Scope 1 (what you burn), you contract Scope 2 (what you buy as energy), and you cause Scope 3 (everything else — usually 70-90% of the total footprint).'
  )
  on conflict (module_id, position) do update set title = excluded.title;

  insert into public.lessons (module_id, position, type, title, objective, key_topics, video_object_path, poster_object_path, duration_seconds, summary_block)
  values (
    v_m3_id, 1, 'video', 'Water stress and waste: beyond carbon',
    'See why water-stress area and waste-diversion rate are now standard Environment KPIs alongside emissions.',
    array['water stress', 'waste diversion', 'circularity'],
    'esg-fundamentals-bites/m3/l2.mp4', 'esg-fundamentals-bites/m3/l2.jpg', 30,
    'Emissions get the headlines, but water withdrawn in a water-stressed basin and the share of waste diverted from landfill are both now standard BRSR/GRI Environment metrics.'
  )
  on conflict (module_id, position) do update set title = excluded.title;

  insert into public.assessments (scope, module_id, title, pass_threshold_pct, xp_award, coin_award)
  values ('module', v_m3_id, 'Module check: Environment', 70, 25, 25)
  on conflict (module_id) where scope = 'module' do update set title = excluded.title
  returning id into v_assess_id;

  insert into public.questions (assessment_id, position, stem, options, correct_key, explanation, topic_tag)
  values
    (v_assess_id, 0, 'Your company leases a fleet of delivery vans and buys electricity for its warehouse. The vans'' fuel emissions and the warehouse electricity fall under…',
     '[{"key":"a","text":"Scope 1 (vans) and Scope 2 (electricity)"},{"key":"b","text":"Scope 2 for both — they''re purchased services"},{"key":"c","text":"Scope 3 for both — leased assets are always indirect"},{"key":"d","text":"Scope 1 for both — they happen at your sites"}]'::jsonb,
     'a', 'Operationally controlled leased vehicles are typically Scope 1; purchased electricity is the classic Scope 2.', 'scope-1-2'),
    (v_assess_id, 1, 'For most companies, which scope makes up 70-90% of total footprint?',
     '[{"key":"a","text":"Scope 1"},{"key":"b","text":"Scope 2"},{"key":"c","text":"Scope 3"},{"key":"d","text":"They''re roughly equal"}]'::jsonb,
     'c', 'Scope 3 (purchased goods, logistics, travel, product use, end-of-life) dominates most footprints — and is where BRSR and CSRD reporting are heading.', 'scope-3'),
    (v_assess_id, 2, '"Water withdrawn in a water-stressed basin" is an example of...',
     '[{"key":"a","text":"A Scope 1 emission"},{"key":"b","text":"A governance KPI"},{"key":"c","text":"An Environment KPI beyond carbon"},{"key":"d","text":"A social KPI"}]'::jsonb,
     'c', 'Water and waste metrics round out an Environment disclosure alongside the three GHG scopes.', 'water-waste')
  on conflict (assessment_id, position) do update set stem = excluded.stem;

end $$;
