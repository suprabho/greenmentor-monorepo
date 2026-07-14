-- Wave-0 seed for the ESG readiness content library: the guaranteed "other"
-- cluster fallback (Doc 4). These sector-agnostic cells are the final tier of
-- the graceful-degradation lookup, so every respondent gets a complete PDF from
-- day one even before sector-specific Wave-1 content is authored. Sector cells
-- (esg_best_practices / esg_peer_benefits with a real sector code) are added by
-- the content-authoring track and supersede these via the lookup order.
--
-- Idempotent: keyed on the (sector, band, turnover, subarea) / (sector, turnover,
-- category) unique constraints with on-conflict upserts.

-- ── Best Practices — "other" cluster (band/turnover/subarea = NULL = any) ─────
insert into public.esg_best_practices (sector, band, turnover, subarea, status, bullets)
values (
  'other', null, null, null, 'published',
  '[
    {"text": "Start with a Scope 1 and Scope 2 GHG inventory using the GHG Protocol Corporate Standard — it is the foundation every buyer, lender and framework builds on.", "citation": "GHG Protocol Corporate Standard, 2015", "subarea": "A", "frameworks": ["ghg"]},
    {"text": "Digitise fuel, electricity and water consumption into a single tracked system rather than scattered spreadsheets, so data is complete and audit-ready.", "citation": "GHG Protocol Scope 2 Guidance, 2015", "subarea": "A"},
    {"text": "Name a single accountable ESG owner and give them a clear mandate — most stalled ESG programmes lack one point of ownership.", "citation": "WBCSD, ESG Governance Guidance, 2023", "subarea": "B"},
    {"text": "Put a short, Board-approved ESG policy in place with two or three time-bound targets rather than a generic statement of intent.", "citation": "SEBI BRSR Framework, 2023", "subarea": "C"},
    {"text": "Add basic ESG attributes (emissions, certifications, code of conduct) to your vendor master for your top suppliers by spend.", "citation": "CDP Supply Chain Report, 2023", "subarea": "C"},
    {"text": "Respond to at least one buyer ESG questionnaire proactively — it surfaces the exact data gaps your customers care about.", "citation": "EcoVadis Business Sustainability Ratings, 2023", "subarea": "D", "frameworks": ["custom_esg"]},
    {"text": "Train two or three people on GHG accounting and BRSR fundamentals so ESG knowledge is not concentrated in a single person.", "citation": "GRI Certified Training, 2023", "subarea": "B"}
  ]'::jsonb
)
on conflict (sector, band, turnover, subarea)
do update set bullets = excluded.bullets, status = excluded.status;

-- ── Peer Benefits — "other" cluster, one per category (turnover = NULL = any) ─
insert into public.esg_peer_benefits (sector, turnover, category, status, body, citation)
values
  (
    'other', null, 'investor_banking', 'published',
    'Companies with a credible GHG inventory and a clear ESG policy access sustainability-linked loans and green financing at better terms, and answer lender ESG due-diligence without scrambling — increasingly a condition of credit for mid-market borrowers.',
    'RBI Framework for Green Deposits, 2023'
  ),
  (
    'other', null, 'customer_market', 'published',
    'Being able to answer a buyer ESG questionnaire quickly and completely protects existing contracts and wins new ones — large listed and MNC buyers now screen suppliers on ESG data as part of procurement.',
    'CDP Supply Chain Report, 2023'
  ),
  (
    'other', null, 'compliance_risk', 'published',
    'Early ESG-ready peers avoid the last-minute cost and disruption of reacting to BRSR value-chain requests or CBAM reporting deadlines, and reduce the risk of losing business when a buyer''s disclosure obligation cascades down to them.',
    'SEBI BRSR Core Circular, 2023'
  )
on conflict (sector, turnover, category)
do update set body = excluded.body, citation = excluded.citation, status = excluded.status;
