# Document 5 — Complete process workflow

**Greenmentor ESG Applicability & Readiness Tool**

This document maps the complete end-to-end workflow from the moment a user lands on `greenmentor.co/esg-readiness` to the moment they have their PDF report in their inbox — including every automation, every fallback, and every internal handoff.

This is the operational runbook. Use this to brief the Make.com freelancer, validate end-to-end testing, and debug issues post-launch.

---

## High-level flow

```
┌─────────────────┐
│  User lands on  │
│ greenmentor.co/ │
│  esg-readiness  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Intro screen + company │
│       name capture      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│   Section 1 (Q1–Q7)     │
│       Profiling         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Section break screen   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Section 2 (Q8–Q18)     │
│       Readiness         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Tally fires webhook to Make.com                    │
│  (Carries all 18 answers + company name)            │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Make.com computes:                                 │
│  • Applicability for 7 frameworks (Document 6)      │
│  • Q18 boost                                        │
│  • Readiness score + sub-area breakdown             │
│  • Weakest sub-area                                 │
│  • Bands and tags                                   │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Make.com redirects user to results page with       │
│  computed outputs as URL parameters                 │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Results page renders:                              │
│  • Applicability summary (labels only)              │
│  • Readiness score + band                           │
│  • Unlock prompt + lead capture form                │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Decision: User submits lead form?                  │
└─────────┬───────────────────────────┬───────────────┘
          │                           │
       YES│                         NO│
          ▼                           ▼
┌─────────────────────┐    ┌──────────────────────────┐
│ Tally fires second  │    │ Anonymous submission     │
│ webhook to Make.com │    │ logged for analytics     │
│ (lead capture data) │    │ User exits, no follow-up │
└─────────┬───────────┘    └──────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────┐
│  Make.com (post-lead-capture flow):                 │
│  1. Send acknowledgement email via Brevo (instant)  │
│  2. Query Airtable for Best Practices + Peer        │
│     Benefits cells (graceful degradation)           │
│  3. Compose JSON payload for PDFMonkey              │
│  4. POST to PDFMonkey API                           │
│  5. Wait for PDFMonkey to render and return URL     │
│  6. Send PDF delivery email via Brevo with PDF      │
│     attached or linked                              │
│  7. Log complete submission to lead tracking sheet  │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Sales team receives lead alert email at            │
│  sustainability@greenmentor.co                      │
│  Subject: "Lead from [Source] — {Band}, {Top         │
│  Framework}"                                        │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Sales team callbacks within 3 business days        │
└─────────────────────────────────────────────────────┘
```

---

## Stage-by-stage breakdown

### Stage 1 — User arrives at landing page

**URL:** `greenmentor.co/esg-readiness` (or co-branded variant like `/bcci-readiness`)

**Page contents:**
- Page title and 2-sentence intro
- "Begin assessment" button
- Embedded Tally form (intro screen + 18 questions)

**Sources of traffic for v1:**
- Direct outreach emails (BCC&I, association partnerships)
- LinkedIn posts
- Greenmentor website navigation
- Future: Google search, paid search, partner co-branded pages

**Analytics tracking:** Google Analytics or Plausible installed; UTM parameters used to identify source.

---

### Stage 2 — Intro screen, company name capture

**What happens:** Tally displays the intro screen with the company name field. User enters company name and clicks "Begin assessment."

**What's stored:** Company name is held in Tally's form state and will be passed with all 18 question answers when the form submits.

---

### Stage 3 — Section 1 (Q1–Q7) profiling

User answers 7 profiling questions. Q2 has conditional logic — subsector options change based on Q1 selection.

**Inline help text** appears below Q4, Q6, Q7 to clarify ambiguous terms.

---

### Stage 4 — Section break transition screen

Brief screen between Q7 and Q8 telling the user they've completed Section 1. Auto-advances after 3 seconds or on user click.

---

### Stage 5 — Section 2 (Q8–Q18) readiness

User answers 11 scored questions. Q8 and Q17 are multi-select (with mutual-exclusion "None of the above" option).

**Progress indicator** updates throughout — "Question 14 of 18", progress bar at top.

---

### Stage 6 — Tally webhook fires to Make.com

**Trigger:** User submits the final question (Q18).

**Payload sent to Make.com:**

```json
{
  "submission_id": "tally-uuid-xxx",
  "timestamp": "ISO 8601",
  "source_utm": "string (from URL parameter)",
  "company_name": "string",
  "q1_sector": "string",
  "q2_subsector": "string",
  "q3_turnover": "string",
  "q4_listed_status": "string",
  "q5_exports": "string",
  "q6_listed_buyer_supply": "string",
  "q7_mnc_supply": "string",
  "q8_business_systems": ["array", "of", "selected"],
  "q9_scope12": "string",
  "q10_scope3": "string",
  "q11_esg_owner": "string",
  "q12_esg_training": "string",
  "q13_external_consultants": "string",
  "q14_supplier_esg_data": "string",
  "q15_esg_policy": "string",
  "q16_board_discussion": "string",
  "q17_esg_outputs_completed": ["array"],
  "q18_data_requests_received": "string"
}
```

---

### Stage 7 — Make.com computes results

This is the brain. Make.com runs four sequential modules:

**Module 7.1 — Applicability evaluator**
For each of the 7 frameworks (BRSR, BRSR Core, CCTS, CBAM, GRI, Organizational GHG, Custom ESG), evaluate the rule hierarchy per Document 6 and return:
- Label (Definite / Likely / Possible / Doesn't apply)
- Confidence percentage
- "Why text key" (used later by PDF generator to fetch correct template)

**Module 7.2 — Q18 boost**
For frameworks at Likely or Possible only, apply +5 (Q18 = 3-5) or +10 (Q18 = >5). Cap at 95%. Flip label if threshold crossed.

**Module 7.3 — Readiness scorer**
- Sum scored questions per Document 6
- Calculate sub-area scores
- Identify weakest sub-area with 5pp proximity tie-breaker
- Identify strongest sub-area
- Find lowest-scoring questions within weakest sub-area
- Determine readiness band

**Module 7.4 — Output composer**
Compile all results into a structured object for: (a) results page rendering, (b) downstream PDF generation.

---

### Stage 8 — User redirected to results page

**URL:** `greenmentor.co/esg-readiness/results?session=xxx`

**Variables passed via session state or URL parameters:**
- Company name
- Sector + sub-sector
- 7 framework labels (no percentages on this screen)
- Total readiness score
- Band name + tagline
- Edge case flag (none / all_doesnt_apply / advanced_band)

The user sees the on-screen results format per Document 3.

**Important:** The results page does **not** show confidence percentages, reasoning, sub-area breakdown, best practices, peer benefits, or any recommendation. Those are gated to the PDF.

---

### Stage 9 — Decision point: lead capture

The lead capture form is embedded on the results page immediately below the results blocks. User either fills and submits or leaves the page.

**If user fills and submits:** proceeds to Stage 10.

**If user leaves without submitting:**
- Anonymous record logged to backend (sector, score, applicability flags — no PII)
- No follow-up triggered
- Lead is lost; flow ends here

---

### Stage 10 — Lead capture webhook to Make.com

**Trigger:** User submits lead capture form (5 fields, designation optional).

**Payload to Make.com:**

```json
{
  "lead_submission_id": "tally-uuid-yyy",
  "original_assessment_id": "tally-uuid-xxx",
  "timestamp": "ISO 8601",
  "name": "string",
  "work_email": "string",
  "phone": "string (+91 format)",
  "designation": "string or null",
  "company_name": "string (auto-filled, editable)"
}
```

Make.com matches `original_assessment_id` to retrieve the assessment results already computed in Stage 7.

---

### Stage 11 — Acknowledgement email (immediate)

**Trigger:** Lead capture webhook arrives at Make.com.

**Action:** Make.com triggers Brevo to send the acknowledgement email immediately.

**Email details:**
- From: `sustainability@greenmentor.co`
- To: `{work_email}` from lead form
- Subject: *"We've received your details — your ESG Readiness Analysis is on its way"*
- Body:
  > *"Thanks for completing the Greenmentor ESG Applicability & Readiness Assessment. Your detailed report is being generated and will reach you at this email address within 10 minutes.*
  >
  > *If you do not receive your report within 24 hours, please call us at [Phone number] between 0900 hours and 2000 hours, Monday to Saturday, and we'll resolve it immediately.*
  >
  > *— Team Greenmentor"*

**Purpose:**
- Confirms receipt of submission
- Validates email deliverability (if it bounces, we know immediately)
- Sets the 10-minute expectation
- Provides 24-hour fallback path

---

### Stage 12 — Airtable content lookup

Make.com queries Airtable to fetch content for the PDF.

**Best Practices lookup (5-attempt graceful degradation):**

Loop:
1. Try `Sector × Band × Turnover × Sub-area` → if found, use this cell
2. Try `Sector × Band × Turnover` → if found, use this cell
3. Try `Sector × Band` → if found, use this cell
4. Try `Sector` → if found, use this cell
5. Try `"Other" cluster fallback` → use this cell (always exists)

First match wins. Log which attempt succeeded for analytics.

Engine then selects up to 5 bullets from the matched cell using selection ranking (weakest sub-area → applicable frameworks → sector-general).

**Peer Benefits lookup (3-attempt graceful degradation, per category):**

For each of the 3 benefit categories (Investor/Banking, Customer/Market Access, Compliance/Risk):

1. Try `Sector × Turnover × Category` → if found, use this paragraph
2. Try `Sector × Category` → if found, use this paragraph
3. Try `"Other" × Category` → use this paragraph (always exists)

If a category genuinely has no content at any fallback level, the PDF gracefully omits that category section.

---

### Stage 13 — PDFMonkey rendering

**Action:** Make.com posts the complete JSON payload (assessment results + lead details + Airtable content) to PDFMonkey API.

**PDFMonkey processing:**
- Reads JSON variables
- Selects the right template (standard vs. all-doesnt-apply vs. advanced-band)
- Renders the 2-page PDF
- Returns a URL to the rendered PDF (or the PDF binary directly)

**Typical render time:** 30 seconds to 2 minutes.

---

### Stage 14 — PDF delivery email

**Trigger:** PDFMonkey returns rendered PDF.

**Action:** Make.com triggers Brevo to send the PDF delivery email.

**Email details:**
- From: `sustainability@greenmentor.co`
- To: `{work_email}` from lead form
- Subject: *"Your ESG Readiness Analysis"*
- Body:
  > *"Please find attached your ESG Readiness Analysis, generated based on the responses you provided.*
  >
  > *The report covers which frameworks apply to your business, where you currently stand, what your peers in your sector are doing, and where to start.*
  >
  > *Questions? Reach us at [Phone number] between 0900 hours and 2000 hours, Monday to Saturday, or reply to this email — we'll be in touch within 3 business days either way.*
  >
  > *— Team Greenmentor"*
- Attachment: The rendered PDF, or alternatively a download link in the email body

---

### Stage 15 — Internal lead alert

**Trigger:** Lead capture submission (same trigger as acknowledgement email, runs in parallel).

**Action:** Make.com triggers Brevo to send an internal alert email.

**Email details:**
- From: `sustainability@greenmentor.co` (system address)
- To: `sustainability@greenmentor.co` (lead inbox) and any other internal recipients
- Subject: *"Lead from [Source] — {Readiness Band}, {Top Applicable Framework}"*
- Body: Structured summary of the lead:
  - Name, email, phone, designation, company name
  - Sector + sub-sector + turnover band
  - Listed status, exports, listed buyer / MNC supply
  - Readiness score and band
  - Top 3 applicable frameworks with confidence labels
  - Link to the same PDF that was sent to the user
  - Timestamp of submission

**Purpose:** Sales team has full context before calling. No need to dig through the original form data.

---

### Stage 16 — Logging to lead tracking sheet

**Trigger:** Same lead capture submission.

**Action:** Make.com appends a row to a Google Sheet or Airtable lead-tracking base.

**Columns logged:**
- Timestamp
- Lead name, email, phone, designation
- Company name
- Sector, sub-sector, turnover
- Source (UTM parameter)
- All 18 answers (denormalised for analytics)
- Readiness score + band
- Top 3 applicable frameworks
- PDF URL (for re-sending if requested)
- Status: "New" (set initially; sales team updates as they progress)
- Callback due date (lead submission date + 3 business days)

---

### Stage 17 — Sales callback within 3 business days

**Trigger:** Manual. Sales team works through the lead tracking sheet.

**Process:**
1. Sales team member opens lead tracking sheet, filters by Status = "New"
2. Reviews the internal alert email for context
3. Calls the lead at the provided phone number
4. Updates Status in the sheet: "Called — interested", "Called — not interested", "No answer", "Voicemail left", etc.
5. Logs notes per lead
6. Schedules follow-up if appropriate

**SLA:** All "New" leads must be called within 3 business days of submission. The sheet's "Callback due date" column makes this trackable.

---

## Fallback paths and error handling

### Failure 1 — Tally form abandonment mid-questions

**Behaviour:** User closes browser between Q1 and Q18.

**Outcome:** No data captured. Tally doesn't fire webhook until final submission. Session lost.

**Future improvement:** Multi-step form saving (v2).

---

### Failure 2 — Webhook fails to fire from Tally to Make.com

**Behaviour:** User completes Q18 but the webhook silently fails.

**Detection:** Make.com has built-in webhook execution logs. Set up Slack or email alert for failed runs.

**Recovery:** Tally retains all form submissions; manually re-trigger webhook for failed submissions.

---

### Failure 3 — Make.com computation error

**Behaviour:** Scenario encounters an error mid-computation (e.g., unexpected answer combination triggers a logic bug).

**Detection:** Make.com sends error alerts to `sustainability@greenmentor.co`.

**User-facing recovery:**
- Acknowledgement email may not arrive
- Make.com fallback: if computation fails, send "We've received your submission and our team will reach out to you within 24 hours" instead of normal acknowledgement email
- Manual follow-up: sales team is alerted to the failed run via Slack/email; calls user proactively

---

### Failure 4 — Airtable lookup fails (network error or unavailable cell)

**Behaviour:** Make.com cannot fetch the appropriate Best Practices or Peer Benefits cell.

**Recovery:**
- Best Practices: graceful degradation through 5 attempts; final fallback to "Other" cluster always exists
- Peer Benefits: graceful degradation through 3 attempts; missing categories simply omitted from PDF
- If even the "Other" fallback returns nothing (Airtable down): Make.com sends user the acknowledgement email and queues retry; alerts internal team

---

### Failure 5 — PDFMonkey rendering fails

**Behaviour:** PDFMonkey API returns error or hangs beyond timeout.

**Recovery:**
- Make.com retries up to 3 times with exponential backoff
- If all retries fail: send user a fallback email *"We've received your submission and our team will email your report manually within 24 hours"* and alert internal team to generate the PDF manually

---

### Failure 6 — Brevo email delivery fails

**Behaviour:** Brevo returns delivery error, or email bounces.

**Recovery:**
- Brevo's webhook reports bounce back to Make.com
- Internal alert sent: "Bounce on {email_address} for submission {id}"
- Sales team calls the phone number provided to confirm the correct email address

---

### Failure 7 — User reports PDF not received within 24 hours

**Behaviour:** User calls the phone number listed in the acknowledgement email.

**Recovery:**
- Support team checks lead tracking sheet for the submission
- If PDF was sent but ended up in spam: re-send manually + advise user to whitelist `sustainability@greenmentor.co`
- If PDF was never generated: trigger manual generation via PDFMonkey + email manually

---

## Performance and capacity considerations

### Make.com operations per submission

Each end-to-end submission consumes approximately 30–50 Make.com operations:
- Parse incoming webhook: 1-2 ops
- Applicability evaluator (7 frameworks): 10-14 ops
- Q18 boost: 7 ops (one per framework eligibility check)
- Readiness scoring: 5 ops
- Airtable lookups: 5-8 ops (1 for best practices + 3 for peer benefits + retries for graceful degradation)
- PDFMonkey POST: 1 op
- Wait for PDFMonkey completion: 1 op
- Brevo emails (acknowledgement + PDF delivery + internal alert): 3 ops
- Sheet logging: 1-2 ops

**At free tier (1,000 ops/month):** Roughly 20 submissions before hitting limit.
**At Core plan ($9/month, 10,000 ops):** Roughly 200 submissions.
**At Pro plan ($16/month, 20,000 ops):** Roughly 400 submissions.

### PDF generation throughput

PDFMonkey free tier: 300 PDFs/month. Sufficient for early traffic.

PDFMonkey paid ($19/month): 1,000 PDFs/month.

### Email volume

Brevo free tier: 300 emails/day. Each submission triggers 2 user-facing emails (acknowledgement + PDF delivery) + 1 internal alert = 3 emails. Daily capacity: ~100 submissions/day.

Sufficient for v1 launch and well beyond initial expected volume.

---

## Monitoring and observability

**What to monitor in production:**

1. **Submission count per day** — track in Make.com logs and the lead tracking sheet
2. **Conversion funnel** — landings → form submissions → lead captures → calls scheduled
3. **Make.com run success rate** — should be ≥99%; investigate any errors
4. **Email deliverability** — Brevo dashboard shows open rates and bounces
5. **Lead callback SLA compliance** — % of leads called within 3 business days
6. **Airtable lookup fallback distribution** — how often does the engine fall back to less granular cells? Use this to prioritize content authoring waves

**Tools for monitoring:**
- Make.com scenario logs (built-in)
- Brevo email analytics dashboard
- Google Sheets / Airtable lead tracking sheet
- Optional: Slack channel `#esg-tool-alerts` for real-time error notifications

---

*End of Document 5.*
