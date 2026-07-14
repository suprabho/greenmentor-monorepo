# Document 1 — Component-by-component build plan

**Greenmentor ESG Applicability & Readiness Tool**

This document specifies the 7 components needed to make the tool operational end-to-end, the build sequence, effort estimates, costs, and skill requirements. The intent is that this document can be handed to whoever is operationalising the build — internal team, freelancers, or both — and they can execute against it.

---

## What "operational" means

A user can land at `greenmentor.co/esg-readiness`, complete an 18-question assessment, see their results on-screen, submit lead capture details, and receive a personalised 2-page PDF report in their inbox within 10 minutes — without any manual intervention from the Greenmentor team.

---

## The 7 components

| # | Component | Tool | Role |
|---|---|---|---|
| 1 | Form | Tally | Captures 18 questions + lead capture form |
| 2 | Logic engine | Make.com | Computes applicability, readiness score, queries content database, formats output for PDF generation |
| 3 | Content database | Airtable | Stores 1,083 cells of best practices + peer benefits content; manages review workflow |
| 4 | PDF generator | PDFMonkey | Renders the 2-page PDF from JSON payload |
| 5 | Email delivery | Brevo | Sends acknowledgement email + PDF delivery email |
| 6 | Hosting page | Existing greenmentor.co stack | Landing page with form embed + results page |
| 7 | Content authoring | AI-drafted + 2-stage human verification in Airtable | Populates the content database |

---

## Build sequence

**Track 1 — Infrastructure (sequential):**
Form → Logic engine → PDF generator → Email delivery. Must be built in this order because each downstream component depends on the upstream one.

**Track 2 — Content (parallel to Track 1):**
Airtable setup → Wave 1 content authoring. Runs in parallel; need at least minimal content before end-to-end testing.

**Track 3 — Hosting (parallel, blocks nothing until launch):**
Landing page + results page. Built anytime, only blocks final launch.

---

## Component 1 — Tally form

### Build steps
1. Create new Tally form
2. Build intro screen with company name capture (mandatory)
3. Build 18 questions per the questionnaire spec (Document 2)
4. Implement Q2 conditional dropdown logic (subsector options depend on Q1)
5. Add inline help text below Q4, Q6, Q7
6. Build section break / transition screen between Q7 and Q8
7. Enable Tally's built-in progress indicator
8. Configure webhook to fire on submission, pointing at Make.com endpoint
9. Build lead capture as a separate Tally form (5 fields, designation optional) on the results page

### Limitations and pricing
- Tally free tier: 200 submissions/month per workspace, "Powered by Tally" branding visible
- Tally paid (~₹2,500/month): unlimited submissions, custom branding, custom domain support
- Conditional logic and webhooks: available on free tier

### Effort and skill
- **Effort:** 1–2 days
- **Skill:** Form-builder familiarity, no code required
- **Owner:** Internal team member or junior hire

---

## Component 2 — Make.com logic engine

This is the most complex component. The brain of the tool.

### Build steps
1. Create Make.com scenario triggered by Tally webhook
2. Parse form data into named variables (Q1 through Q18, lead capture fields, company name)
3. Build applicability evaluator — 7 frameworks, each with 4–5 rules (per Document 6)
4. Apply Q18 confidence boost logic per Document 6
5. Build readiness scorer — sum scored questions, calculate sub-area scores, find weakest sub-area with proximity tie-breaker
6. Query Airtable for best practices cell (5-attempt graceful degradation)
7. Query Airtable for 3 peer benefits cells (one per category, 3-attempt graceful degradation each)
8. Format JSON payload for PDFMonkey containing all variables
9. POST to PDFMonkey API for PDF rendering
10. Send Brevo acknowledgement email immediately on form submission
11. Send Brevo PDF delivery email when PDFMonkey returns rendered URL
12. Log every submission to Airtable or Google Sheets for analytics + lead tracking

### Costs
- Make.com free tier: 1,000 ops/month (~20 submissions before exhaustion)
- Make.com Core plan: $9/month for 10,000 ops (~200 submissions)
- Make.com Pro plan: $16/month for 20,000 ops (~400 submissions)
- Each submission consumes roughly 30–50 ops

### Effort and skill
- **Effort:** 5–10 days
- **Skill:** Significant Make.com proficiency required; ~100 conditional branches to wire up correctly
- **Owner recommended:** Hire a Make.com freelancer; brief them with Documents 1, 2, 6 and the JSON payload schema. Cost: ₹15,000–25,000 one-time.

---

## Component 3 — Airtable content database

### Build steps
1. Create two Airtable bases:
   - Base 1: Best Practices Library (912 cells at full depth)
   - Base 2: Peer Benefits Library (171 cells at full depth)
2. Configure field schema per the structure in `5.1` of the locked spec
3. Create 5 saved views per base for reviewer workflow:
   - My Review Queue — Stage 1
   - My Review Queue — Stage 2
   - Rejected — needs redraft
   - Published
   - Audit sample
4. Configure button fields for one-click accept/reject status updates
5. Generate empty cell skeletons via CSV import — a Python script generates the 912 + 171 rows with Lookup Keys pre-populated
6. Set up Airtable Personal Access Token for Make.com API access

### Costs
- Airtable free tier: 1,000 records per base, unlimited bases, 5 editors
- Splits the libraries across two bases (Best Practices = 912, Peer Benefits = 171, both fit within 1,000-record free limit)
- Total: Free for v1

### Effort and skill
- **Effort:** 1 day for setup + skeleton generation
- **Skill:** Light Airtable familiarity; Python script for skeleton generation can be written using ChatGPT or by a junior team member in ~2 hours
- **Owner:** Internal team member

---

## Component 4 — PDFMonkey template

### Build steps
1. Create PDFMonkey account
2. Design 2-page HTML/CSS template per Document 4 (PDF report format)
3. Define all template variables matching Make.com's JSON output
4. Implement section-level conditional rendering (e.g., when all 7 frameworks "Doesn't apply", swap the standard recommendation block for the soft "When ESG becomes relevant for you" block)
5. Test with 3–5 sample JSON payloads representing different respondent profiles
6. Tune visual density to fit up to 5 best practices bullets in the available space on Page 2

### Costs
- PDFMonkey free tier: 300 PDFs/month
- PDFMonkey paid: $19/month for 1,000 PDFs

### Effort and skill
- **Effort:** 3–5 days
- **Skill:** HTML/CSS plus design eye
- **Owner options:** Internal team member with design sense, or hire a freelance designer for ₹10,000–20,000

---

## Component 5 — Brevo email delivery

### Build steps
1. Sign up for Brevo
2. Verify the sending domain (sustainability@greenmentor.co) via DNS records
3. Configure SPF, DKIM, and DMARC records at greenmentor.co DNS
4. Create two email templates with personalisation variables:
   - Acknowledgement email (sent immediately on form submission)
   - PDF delivery email (sent when PDFMonkey returns rendered PDF)
5. Test deliverability across Gmail, Outlook, Yahoo, and 2–3 corporate domains
6. Configure Make.com to send via Brevo API

### Email templates

**Acknowledgement email:**
- Subject: *"We've received your details — your ESG Readiness Analysis is on its way"*
- Body: Confirms receipt, sets 10-minute delivery expectation, provides 24-hour fallback support number and hours

**PDF delivery email:**
- Subject: *"Your ESG Readiness Analysis"*
- Body: Short message, PDF attached or linked, mentions support number for follow-up

### Costs
- Brevo free tier: 300 emails/day (well above expected volume for v1)
- Sufficient for full operational launch

### Effort and skill
- **Effort:** 2–3 days (mostly DNS propagation wait time)
- **Skill:** Basic domain/DNS familiarity
- **Owner:** Whoever manages greenmentor.co DNS

---

## Component 6 — Hosting page

### Build steps
1. Build landing page at `greenmentor.co/esg-readiness`:
   - Title + 2-sentence intro per Document 2
   - "Begin assessment" button leading to embedded Tally form
2. Embed Tally form via iframe (Tally provides embed code)
3. Build post-submission results page at `greenmentor.co/esg-readiness/results`:
   - Displays applicability + readiness band per Document 3
   - Embedded lead capture Tally form
4. Configure routing: form completion → results page → lead capture → confirmation page

### Effort and skill
- **Effort:** 3–5 days for WordPress with page builder; 1–2 days if custom React with developer
- **Skill:** Whoever manages greenmentor.co
- **Owner:** Internal web team or freelance web developer

### Notes
For v1, a WordPress page with embedded Tally form is sufficient. The results page can also be a Tally-managed page with variable interpolation showing computed results. Polish later.

---

## Component 7 — Content authoring (Wave 1)

### Wave 1 scope
- Best Practices Library — 19 sector-level cells + 19 "Other" cluster baseline cells = 38 cells
- Peer Benefits Library — 19 sectors × 3 categories = 57 cells
- **Total Wave 1: 95 cells**

### Workflow
1. AI generates draft content in batches of 20–30 cells, delivered as structured CSV/JSON
2. Bulk-import drafts into Airtable, landing at Status = Draft
3. Reviewer 1 reads each cell for accuracy and voice; per-bullet accept/reject in Airtable
4. Rejected bullets return to AI for redraft with rejection reason
5. Accepted bullets move to Status = Review1-OK
6. Reviewer 2 opens each cited URL, verifies the source claim, per-bullet accept/reject
7. Accepted bullets reach Status = Review2-OK
8. Cell marked Published when all bullets reach Review2-OK
9. Amitava samples 10% of Published cells weekly; flagged cells return to Draft for rework

### Effort
- AI drafting: ~30 minutes per batch of 20–30 cells (minimal human time)
- Reviewer 1: 5–10 minutes per cell → 8–16 hours for 95 cells
- Reviewer 2: 10–15 minutes per cell (citation verification is slow) → 16–24 hours for 95 cells
- Redraft cycles: 20–30% of cells need at least one cycle, adding 1–2 days each iteration
- Amitava sample audits: 1–2 hours weekly throughout

### Timeline
**Total Wave 1: 3–4 weeks elapsed time** assuming part-time reviewer engagement.

### Resources required
- 2 named reviewers (at least one with ESG domain expertise)
- Amitava for audit sampling
- Airtable workspace already set up (Component 3)

---

## End-to-end timeline (realistic)

| Week | Track 1 (Infrastructure) | Track 2 (Content) | Track 3 (Hosting) |
|---|---|---|---|
| 1 | Tally form built; Airtable bases configured; Make.com freelancer briefed and scoped | AI drafts first batches; Reviewer 1 begins Stage 1 | Landing page wireframe |
| 2 | Make.com scenario in flight; PDFMonkey signed up | Reviewer 2 begins Stage 2 verification | Landing page built, Tally embedded |
| 3 | PDFMonkey template designed; first sample payloads tested | Redraft loops in flight | Results page configured |
| 4 | Brevo templates configured; domain authentication complete | Wave 1 cells reaching Published status | End-to-end testing begins |
| 5 | Edge case testing; bug fixes | Wave 1 fully published | Soft launch with internal test users |
| 6 | Performance tuning; public launch readiness | Wave 2 content authoring begins | Public launch |

**Realistic launch window: 5–6 weeks from start.**

---

## Cost summary

| Item | Cost |
|---|---|
| Tally (free tier sufficient for launch) | ₹0 – ₹2,500/month |
| Make.com (free for month 1, paid thereafter) | ₹750 – ₹1,400/month after month 1 |
| Airtable (free tier sufficient for v1) | ₹0 |
| PDFMonkey (free tier sufficient for launch) | ₹0 – ₹1,600/month |
| Brevo (free tier sufficient) | ₹0 |
| **Recurring monthly cost (post-launch)** | **₹2,500 – ₹5,500/month** |
| Make.com freelancer (one-time build) | ₹15,000 – ₹25,000 |
| PDFMonkey designer (one-time build, optional) | ₹10,000 – ₹20,000 |
| **One-time build cost** | **₹25,000 – ₹45,000** |

---

## Decisions required before build starts

1. **Make.com freelancer** — hire or build in-house? Recommend hire.
2. **PDFMonkey designer** — hire or use internal? Recommend hire if no design-capable team member is available.
3. **Two named content reviewers** — assign now so they can be onboarded to Airtable in Week 1.
4. **Hosting page owner** — internal team or freelance? Confirm before Week 2.

---

*End of Document 1.*
