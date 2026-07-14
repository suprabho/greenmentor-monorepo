# Document 3 — On-screen score format

**Greenmentor ESG Applicability & Readiness Tool**

This is the specification for the results screen the user sees **immediately after submitting Q18**, before any lead capture. Free preview. Designed to demonstrate value while keeping enough depth gated behind the lead form to incentivise submission.

---

## Where this screen sits in the flow

```
Q18 submission  →  [THIS SCREEN]  →  Lead capture form  →  Confirmation
                       ↑
                  No form on this screen — pure results display
                  Lead capture appears immediately below results
```

---

## What appears on the screen

The screen has 4 stacked blocks:

1. **Header** — company name + sector + sub-sector
2. **Framework applicability** — 7 frameworks with labels only (no percentages, no reasoning)
3. **Readiness** — total score + band + band tagline
4. **Unlock prompt + lead capture form** — what's in the PDF and the form to receive it

The lead capture form is technically on the same page, immediately below the results. The user doesn't navigate away to fill it.

---

## Visual specification

```
═══════════════════════════════════════════════════════
       YOUR ESG ASSESSMENT — SUMMARY
═══════════════════════════════════════════════════════

  Prepared for: [Company name]
  Sector: [Q1 selection] · [Q2 selection]

───────────────────────────────────────────────────────

  WHICH FRAMEWORKS APPLY TO YOUR BUSINESS

   ●  BRSR (full)                    Likely
   ●  BRSR Core                      Likely
   ○  CCTS                           Doesn't apply
   ○  CBAM                           Doesn't apply
   ◐  GRI                            Possible
   ●  Organizational GHG Footprint   Definite
   ●  Custom / Buyer ESG Reporting   Definite

───────────────────────────────────────────────────────

  YOUR READINESS

         ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░  19 / 44

              FOUNDATION NEEDED

  Basics in place — formalisation required.

───────────────────────────────────────────────────────

  UNLOCK YOUR FULL REPORT

  Your detailed PDF will cover:

   ▸ Why each framework applies, with confidence levels
   ▸ Where you stand across four areas — data,
     people & knowledge, governance, output & pressure
   ▸ Best practices for your sector at your stage
   ▸ How your peers benefit from being ESG-ready
   ▸ Where to start — tailored to your specific gaps

   ┌─────────────────────────────────────────────────┐
   │  Full name        [_________________________]   │
   │  Work email       [_________________________]   │
   │  Phone (+91)      [_________________________]   │
   │  Designation      [_________________________]   │
   │                       (optional)                │
   │  Company name     [Company name auto-filled]    │
   │                                                 │
   │           [ Get my full report → ]              │
   └─────────────────────────────────────────────────┘

   We'll send the report to your email within 10 minutes.
   If you do not receive your report within 24 hours,
   please call us at [Phone] between 0900–2000 hrs,
   Monday to Saturday.

═══════════════════════════════════════════════════════
```

---

## Block-by-block specifications

### Block 1 — Header

**Content:**
- Line 1: `Prepared for: {Company Name}` (from intro screen)
- Line 2: `Sector: {Q1} · {Q2}` (sector and sub-sector echoed verbatim from form)

**Purpose:** Confirms to the user that the tool understood their inputs. Personalises the screen.

---

### Block 2 — Framework applicability

**Order on screen:** Fixed. Always shown in this order regardless of applicability:

1. BRSR (full)
2. BRSR Core
3. CCTS
4. CBAM
5. GRI
6. Organizational GHG Footprint
7. Custom / Buyer ESG Reporting

**Status icons and labels:**

| Label | Icon | Confidence range | Display color |
|---|---|---|---|
| Definite | ● (filled green) | ≥ 90% | Green |
| Likely | ● (filled amber) | 70–89% | Amber |
| Possible | ◐ (half-filled grey) | 50–69% | Grey |
| Doesn't apply currently | ○ (empty grey) | No matching rule | Light grey |

**Important:**
- **No percentages shown on this screen.** Labels only. Percentages stay in the gated PDF.
- **No reasoning shown on this screen.** Why each framework applies is also PDF-only.

---

### Block 3 — Readiness

**Content elements:**

1. **Visual progress bar** — 22 characters wide on text mockup; horizontal bar in actual rendering. Fill proportion = score / 44.
2. **Numeric score** — "X / 44" displayed prominently.
3. **Band name** — large text, color-coded per the band.
4. **Band tagline** — one-line descriptor below the band name.

**Band specifications:**

| Score range | Band name | Tagline | Color |
|---|---|---|---|
| 0–11 | Critical Gap | Significant infrastructure to build. | Red |
| 12–22 | Foundation Needed | Basics in place — formalisation required. | Amber |
| 23–33 | Strengthen & Formalise | Clear direction — depth needed. | Yellow-green |
| 34–44 | Advanced — Optimise & Assure | High maturity — focus on assurance and optimisation. | Green |

**Important:**
- **No sub-area breakdown shown on this screen.** The 4 sub-area scores (Data Infrastructure, People & Knowledge, Governance, Output & Pressure) appear only in the PDF.
- The score and band give the user enough to feel they've received real value; sub-area breakdown is the unlock incentive.

---

### Block 4 — Unlock prompt + lead capture

**Top of block — 5-bullet unlock prompt:**

> Your detailed PDF will cover:
>
> ▸ Why each framework applies, with confidence levels
> ▸ Where you stand across four areas — data, people & knowledge, governance, output & pressure
> ▸ Best practices for your sector at your stage
> ▸ How your peers benefit from being ESG-ready
> ▸ Where to start — tailored to your specific gaps

These 5 bullets map directly to the 5 content sections of the PDF (Document 4). No surprises.

**Lead capture form (5 fields):**

| Field | Required | Notes |
|---|---|---|
| Full name | Yes | Free text |
| Work email | Yes | Email format validation; soft warning if domain is gmail/yahoo/outlook/hotmail saying "Work email helps us reach you faster" |
| Phone (+91) | Yes | 10 digits, no OTP in v1 |
| Designation | **No (optional)** | Free text, label clearly states "(optional)" |
| Company name | Yes | Auto-filled from intro screen, editable |

**Submit button:** `[ Get my full report → ]`

**Below the button (small print):**

> *"We'll send the report to your email within 10 minutes. If you do not receive your report within 24 hours, please call us at [Phone number] between 0900 hours and 2000 hours, Monday to Saturday."*

---

## Edge case behaviours

### Edge case 1 — All 7 frameworks = "Doesn't apply currently"

Possible for a small unlisted Indian company with no exports, no listed customers, no MNC customers.

**Behaviour:**
- Framework applicability block shows all 7 with ○ icon and "Doesn't apply"
- Readiness block runs normally — score and band computed and displayed
- **Unlock prompt is subtly modified:**
  - Replace bullet 5 from *"Where to start — tailored to your specific gaps"* with *"Whether ESG infrastructure is worth investing in for you yet, and when"*

This signals honesty — we're not selling them readiness work; we're explaining their position.

### Edge case 2 — Score of 0/44

Possible. Band: Critical Gap. Show the full screen as normal. Tagline *"Significant infrastructure to build"* is honest.

### Edge case 3 — Score of 44/44

Also possible. Band: Advanced. Show the full screen as normal. The PDF will handle the sophisticated framing.

### Edge case 4 — Respondent abandons mid-form

Standard form behaviour: progress not saved in v1. Returning to the form starts from Q1. Saved sessions are a v2 feature.

### Edge case 5 — Respondent views results, doesn't submit lead capture

Form data from Q1–Q18 is **logged anonymously** to the backend regardless of lead capture (sector, score, applicable frameworks). This enables tool engagement analytics without forcing lead capture as a hard gate.

---

## What this screen does NOT show (deliberately)

- **Confidence percentages** — PDF only
- **Sub-area readiness breakdown** — PDF only
- **Framework-by-framework reasoning** — PDF only
- **Greenmentor product/service recommendations** — PDF only
- **Best practices for the sector** — PDF only
- **Peer benefits** — PDF only
- **Any pricing of any kind** — never anywhere
- **CTA to book a call** — lives in the PDF only

---

## Visual hierarchy guidance (for the designer)

The screen has competing elements — the designer should prioritise visual weight as follows:

1. **Most prominent:** Framework applicability block + Readiness band + score
2. **Secondary:** Header (company + sector)
3. **Tertiary:** Unlock prompt (5 bullets) and form labels

The form itself should be **clear but not visually heavy** — the goal is for the eye to land on results first, scroll naturally to the form. Don't make the form scream for attention; the results are the hook.

---

## Mobile responsiveness

Most respondents will fill this on mobile. Recommendations:
- Single column on mobile, no horizontal layouts
- Framework block as a vertical list (already is)
- Form fields full-width with large tap targets
- Submit button fixed at bottom of viewport when form is partially scrolled

---

## Technical notes for the builder

- This page is the post-submission landing for the Tally form. Build at `greenmentor.co/esg-readiness/results`.
- Variables (company name, sector, sub-sector, framework labels, score, band, band tagline) are passed via URL parameters or session state from the Tally form submission webhook.
- The lead capture form is a separate Tally form embedded on this page. On submission, it triggers the second webhook to Make.com which initiates PDF generation.
- The "soft warning on personal email" can be implemented as a client-side JavaScript check on the email field; if domain is in a deny list (gmail.com, yahoo.com, outlook.com, hotmail.com, rediffmail.com), show a non-blocking message: *"Work email helps us reach you faster."*

---

*End of Document 3.*
