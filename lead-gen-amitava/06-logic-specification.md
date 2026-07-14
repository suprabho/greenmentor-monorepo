# Document 6 — Logic specification

**Greenmentor ESG Applicability & Readiness Tool**

This document specifies the complete logic that Make.com (or any equivalent rules engine) must implement. Three sections:

1. **Applicability logic** — rules for each of the 7 frameworks
2. **Readiness scoring** — computation of scored questions and overall band
3. **Weakest sub-area identification** — which area to focus recommendations on

Hand this to the Make.com freelancer along with Documents 1, 2, and 4.

---

## PART 1 — Framework applicability logic

### 1.0 Overview

For each respondent, the engine evaluates 7 frameworks independently and returns, per framework:
- **Label** (Definite / Likely / Possible / Doesn't apply currently)
- **Confidence percentage** (50–95)
- **Why text key** (used to fetch the matched-rule template for PDF rendering)
- **Q18 boost applied flag** (true/false)

### 1.1 Confidence label thresholds

| Underlying confidence % | Display label |
|---|---|
| ≥ 90% | Definite |
| 70–89% | Likely |
| 50–69% | Possible |
| No matching "applies" rule | Doesn't apply currently |

### 1.2 Order of operations

1. Run rules A1 through A7 in sequence. For each framework, walk through its rule hierarchy top-to-bottom. First match wins. Record the resulting confidence % and rule ID.
2. After all 7 framework evaluations, apply A8 — the Q18 confidence boost — to eligible frameworks.

### 1.3 Variable references

The rules below reference the question identifiers from Document 2:

- `Q1` — sector
- `Q3` — turnover band
- `Q4` — listed status
- `Q5` — exports
- `Q6` — supply to listed Indian companies
- `Q7` — supply to global MNCs
- `Q18` — ESG data requests received in last 12 months

---

### A1 — BRSR (full)

| Rule | Condition | Result | Confidence | Why text key |
|---|---|---|---|---|
| 1 | `Q4 = "top 250"` OR `Q4 = "251–1,000"` | Applies — mandatory | 95% | BRSR-1 |
| 2 | `Q4 = "beyond top 1,000"` | Applies — voluntary, recommended | 85% | BRSR-2 |
| 3 | `Q4 = "unlisted"` AND `Q6 = "major share to top 250 listed"` | Likely applies — your listed buyer will request BRSR-aligned data | 75% | BRSR-3 |
| 4 | `Q4 = "unlisted"` AND `Q3 ≥ ₹250 Cr` AND (`Q5 ≠ "no exports"` OR `Q7 = "major MNC supply"`) | Possible — recommended as best practice for international credibility | 60% | BRSR-4 |
| 5 | Everything else (default) | Doesn't apply currently | 90% | BRSR-5 |

---

### A2 — BRSR Core

| Rule | Condition | Result | Confidence | Why text key |
|---|---|---|---|---|
| 1 | `Q4 = "top 250"` | Applies — direct mandatory | 95% | BRSRC-1 |
| 2 | `Q4 = "251–1,000"` AND `Q6 = "major share to top 250 listed"` | Applies — direct + value-chain expectations from listed customers | 90% | BRSRC-2 |
| 3 | (`Q4 = "unlisted"` OR `Q4 = "beyond 1,000"`) AND `Q6 = "major share to top 250 listed"` | Likely applies — as a value-chain partner of a top 250 listed buyer | 80% | BRSRC-3 |
| 4 | `Q4 = "unlisted"` AND `Q6 = "minor share to top 250 listed"` AND `Q3 ≥ ₹50 Cr` | Possible — depends on the listed buyer's 2% procurement threshold | 60% | BRSRC-4 |
| 5 | Everything else (default) | Doesn't apply currently | 85% | BRSRC-5 |

**Note:** Rule 4 has a ₹50 Cr turnover floor added (from pressure test patch). Sub-₹50 Cr respondents matching the rest fall through to rule 5.

---

### A3 — CCTS (Carbon Credit Trading Scheme)

**CCTS sectors** (referenced in rules below): Steel, Aluminium, Cement, Fertilizers, Chemicals & petrochemicals, Oil & gas, Power generation, Paper pulp & packaging.

| Rule | Condition | Result | Confidence | Why text key |
|---|---|---|---|---|
| 1 | `Q1 ∈ CCTS sectors` AND `Q3 ≥ ₹1,000 Cr` | Likely — your sector and scale typically fall within BEE's obligated entity criteria | 80% | CCTS-1 |
| 2 | `Q1 ∈ CCTS sectors` AND `Q3 = ₹500–1,000 Cr` | Possible — depends on BEE's specific notifications for your sub-sector and installed capacity | 60% | CCTS-2 |
| 3 | `Q1 ∈ CCTS sectors` AND `Q3 < ₹500 Cr` | Doesn't apply currently — below typical thresholds, monitor as scheme expands | 75% | CCTS-3 |
| 4 | `Q1 ∉ CCTS sectors` (default) | Doesn't apply currently | 90% | CCTS-4 |

**Honesty caveat:** When CCTS = Likely or Possible, append this sentence to the why text:

> *"CCTS applicability is determined by BEE's specific notifications, which depend on installed capacity and specific energy consumption thresholds for your sub-sector. Our assessment uses sector and turnover proxies — confirm with our team or refer to the latest BEE notification."*

---

### A4 — CBAM

**CBAM sectors** (referenced in rules below): Steel, Aluminium, Cement, Fertilizers, Power generation.

| Rule | Condition | Result | Confidence | Why text key |
|---|---|---|---|---|
| 1 | (`Q5 = "to the EU"` OR `Q5 = "both EU and other"`) AND `Q1 ∈ CBAM sectors` | Applies — mandatory CBAM reporting in transitional phase, levies from 2026 | 95% | CBAM-1 |
| 2 | (`Q5 = "to the EU"` OR `Q5 = "both EU and other"`) AND `Q1 ∉ CBAM sectors` AND `Q7 = "major MNC supply"` | Possible — CBAM scope may expand; MNC customers may pass through CBAM costs | 55% | CBAM-2 |
| 3 | (`Q5 = "to the EU"` OR `Q5 = "both EU and other"`) AND `Q1 ∉ CBAM sectors` | Doesn't apply currently — monitor as scope expands | 80% | CBAM-3 |
| 4 | `Q5 = "non-EU only"` OR `Q5 = "no exports"` (default) | Doesn't apply currently | 95% | CBAM-4 |

**Softening note:** When CBAM = Definite (rule 1 matched), append this sentence to the why text:

> *"CBAM applies specifically to steel, aluminium, cement, fertilizers, electricity, and hydrogen-related products. If your EU exports are in a different product category within your sector, this framework may not apply — happy to clarify on a call."*

---

### A5 — GRI

| Rule | Condition | Result | Confidence | Why text key |
|---|---|---|---|---|
| 1 | (`Q4 = "top 250"` OR `Q4 = "251–1,000"` OR `Q4 = "beyond 1,000"`) AND (`Q5 ≠ "no exports"` OR `Q7 = "major MNC supply"`) | Likely — international investors and buyers expect GRI-aligned disclosure | 80% | GRI-1 |
| 2 | `Q4 = "unlisted"` AND `Q3 ≥ ₹250 Cr` AND (`Q5 ≠ "no exports"` OR `Q7 ∈ {"major MNC supply", "minor MNC supply"}`) | Possible — recommended for international credibility, not legally required | 60% | GRI-2 |
| 3 | `Q3 < ₹250 Cr` AND `Q5 = "no exports"` AND `Q7 ∈ {"no", "not sure"}` | Doesn't apply — voluntary framework, not relevant at your current scale | 85% | GRI-3 |
| 4 | Everything else (default) | Doesn't apply — voluntary framework, decide based on stakeholder expectations | 85% | GRI-4 |

---

### A6 — Organizational GHG Footprint (GHG Protocol Corporate Standard)

| Rule | Condition | Result | Confidence | Why text key |
|---|---|---|---|---|
| 1 | `Q4 ≠ "unlisted"` OR (`Q5 ≠ "no exports"` AND `Q3 ≥ ₹50 Cr`) OR `Q7 = "major MNC supply"` OR `Q6 = "major share to top 250 listed"` | Applies — required as the foundation for any ESG reporting and stakeholder data request | 95% | GHG-1 |
| 2 | `Q3 ≥ ₹250 Cr` AND none of rule 1 triggers | Likely — recommended baseline for any company at your scale | 75% | GHG-2 |
| 3 | `Q3 < ₹250 Cr` AND no listed/export/MNC/listed-buyer exposure | Possible — voluntary baseline, useful if you anticipate growth into listed supply chains or exports | 55% | GHG-3 |

**Note:** Rule 1 has a ₹50 Cr turnover floor on the export-only path (from pressure test patch). Sub-₹50 Cr companies with only export exposure (no listed status, no MNC customers, no listed-buyer supply) fall through to rule 2.

---

### A7 — Generic / Custom ESG Reporting

| Rule | Condition | Result | Confidence | Why text key |
|---|---|---|---|---|
| 1 | `Q7 = "major MNC supply"` | Applies — your buyers are already asking; custom response capability is critical | 90% | CUSTOM-1 |
| 2 | `Q7 = "minor MNC supply"` | Likely — buyer-specific questionnaires are part of your reality | 75% | CUSTOM-2 |
| 3 | `Q5 ≠ "no exports"` AND `Q7 ∈ {"no", "not sure"}` AND `Q3 ≥ ₹250 Cr` | Possible — international customers may begin requesting | 60% | CUSTOM-3 |
| 4 | Everything else (default) | Doesn't apply currently | 80% | CUSTOM-4 |

**Note:** Rule 3 has a ₹250 Cr turnover floor (from pressure test patch). Smaller exporters fall through to rule 4.

---

### A8 — Q18 confidence boost

Applied after rules A1 through A7 produce a structural confidence per framework.

**Eligibility for boost:**
A framework is eligible if its current label is **Likely** (70–89%) or **Possible** (50–69%) after A1–A7.

Frameworks at **Definite** (≥90%) are NOT eligible — already at max certainty.
Frameworks at **Doesn't apply currently** are NOT eligible — Q18 cannot resurrect structural mismatch.

**Boost amounts:**

| Q18 answer | Boost (percentage points) |
|---|---|
| None | 0 |
| 1–2 requests | 0 |
| 3–5 requests | +5 |
| More than 5 requests | +10 |

**Hard cap:** Post-boost confidence cannot exceed 95%. Example: 88% + 10 = 95% (capped, not 98%).

**Label flip:** If post-boost confidence crosses the 70% or 90% threshold, the label flips. Examples:
- 65% Possible + 5 = 70% → flips to **Likely**
- 85% Likely + 10 = 95% → flips to **Definite**
- 88% Likely + 10 = 95% (capped) → flips to **Definite**
- 60% Possible + 5 = 65% → stays Possible

**Why text update:** When a framework receives a Q18 boost (even if label doesn't flip), append this sentence to its why text in the PDF:

> *"The active ESG data requests your team has reported suggest this is becoming a practical expectation, not just a theoretical one."*

---

### Pseudocode for the applicability engine

```pseudo
function evaluate_applicability(answers):
  results = {}
  
  for each framework in [BRSR, BRSR_Core, CCTS, CBAM, GRI, GHG, Custom_ESG]:
    rules = get_rules_for_framework(framework)
    for each rule in rules:
      if matches(rule.condition, answers):
        results[framework] = {
          label: rule.label,
          confidence: rule.confidence,
          why_text_key: rule.why_text_key,
          q18_boost_applied: false
        }
        break  // first match wins
  
  // Apply Q18 boost
  q18_boost = get_boost_amount(answers.q18)
  if q18_boost > 0:
    for each framework in results:
      if results[framework].label in [Likely, Possible]:
        new_confidence = min(results[framework].confidence + q18_boost, 95)
        results[framework].confidence = new_confidence
        results[framework].label = compute_label(new_confidence)
        results[framework].q18_boost_applied = true
  
  return results
```

---

## PART 2 — Readiness scoring

### 2.0 Overview

The readiness scoring system produces:
- A total score (0–44)
- A band label (Critical Gap / Foundation Needed / Strengthen & Formalise / Advanced)
- A band tagline
- 4 sub-area scores (with max points)

### 2.1 Per-question scoring

**Single-select scored questions (Q9, Q10, Q11, Q12, Q13, Q14, Q15, Q16, Q18):**
Each option maps to one of {0, 1.5, 3, 4} points as specified in Document 2.

**Multi-select scored questions (Q8, Q17):**

For both:
- Award 1 point per option selected
- Cap at 4 points maximum
- "None of the above" forces score = 0 regardless of other selections (mutually exclusive in UI; if somehow both are submitted, treat "None" as overriding)

### 2.2 Sub-area aggregation

| Sub-area | Questions | Max points |
|---|---|---|
| A — Data infrastructure | Q8 + Q9 + Q10 | 12 |
| B — People & knowledge | Q11 + Q12 + Q13 | 12 |
| C — Governance | Q14 + Q15 + Q16 | 12 |
| D — Output & pressure | Q17 + Q18 | 8 |
| **Total** | **Q8 through Q18** | **44** |

### 2.3 Overall band

| Total score | Band | Tagline |
|---|---|---|
| 0–11 | Critical Gap | Significant infrastructure to build. |
| 12–22 | Foundation Needed | Basics in place — formalisation required. |
| 23–33 | Strengthen & Formalise | Clear direction — depth needed. |
| 34–44 | Advanced — Optimise & Assure | High maturity — focus on assurance and optimisation. |

### 2.4 Pseudocode for readiness scoring

```pseudo
function calculate_readiness(answers):
  // Score each scored question
  q8_score  = min(count_selected(answers.q8), 4)  // multi-select capped
  if "None of the above" in answers.q8: q8_score = 0
  
  q9_score  = map_single_select(answers.q9, [0, 1.5, 3, 4])
  q10_score = map_single_select(answers.q10, [0, 1.5, 3, 4])
  q11_score = map_single_select(answers.q11, [0, 1.5, 3, 4])
  q12_score = map_single_select(answers.q12, [0, 1.5, 3, 4])
  q13_score = map_single_select(answers.q13, [0, 1.5, 3, 4])
  q14_score = map_single_select(answers.q14, [0, 1.5, 3, 4])
  q15_score = map_single_select(answers.q15, [0, 1.5, 3, 4])
  q16_score = map_single_select(answers.q16, [0, 1.5, 3, 4])
  
  q17_score = min(count_selected(answers.q17), 4)  // multi-select capped
  if "None of the above" in answers.q17: q17_score = 0
  
  q18_score = map_single_select(answers.q18, [0, 1.5, 3, 4])
  
  // Sub-area aggregation
  subarea_a = q8_score + q9_score + q10_score
  subarea_b = q11_score + q12_score + q13_score
  subarea_c = q14_score + q15_score + q16_score
  subarea_d = q17_score + q18_score
  
  total = subarea_a + subarea_b + subarea_c + subarea_d
  
  // Band determination
  if   total <= 11: band = "Critical Gap"
  elif total <= 22: band = "Foundation Needed"
  elif total <= 33: band = "Strengthen & Formalise"
  else:             band = "Advanced — Optimise & Assure"
  
  return {
    total: total,
    band: band,
    band_tagline: get_tagline(band),
    subareas: {
      a: {score: subarea_a, max: 12},
      b: {score: subarea_b, max: 12},
      c: {score: subarea_c, max: 12},
      d: {score: subarea_d, max: 8}
    },
    question_scores: { q8, q9, q10, ..., q18 }
  }
```

---

## PART 3 — Weakest sub-area identification

### 3.0 Overview

The weakest sub-area drives:
- Best Practices bullet selection (which bullets in the matched cell to prioritise)
- The "what this means" paragraph (which 1 of 28 templates to use)
- The Greenmentor recommendation framing (gap-driven)

### 3.1 Step 1 — Compute sub-area percentages

```
percent_A = (subarea_a / 12) * 100
percent_B = (subarea_b / 12) * 100
percent_C = (subarea_c / 12) * 100
percent_D = (subarea_d / 8)  * 100
```

Percentages are used (not absolute scores) so D's smaller denominator doesn't bias the comparison.

### 3.2 Step 2 — Identify weakest sub-area with proximity rule

```pseudo
function identify_weakest(percent_A, percent_B, percent_C, percent_D):
  // Find the lowest percentage
  min_pct = min(percent_A, percent_B, percent_C, percent_D)
  
  // Find all sub-areas within 5pp of the lowest
  candidates = [sub-area X where percent_X <= min_pct + 5]
  
  // Proximity rule: prefer A/B/C over D
  // (Protects against D's 8-point max disproportionately amplifying small absolute differences)
  if "D" in candidates AND length(candidates) > 1:
    remove "D" from candidates
  
  // Among remaining candidates, pick by tie-breaker order: A > B > C
  if "A" in candidates: return "A"
  if "B" in candidates: return "B"
  if "C" in candidates: return "C"
  if "D" in candidates: return "D"
```

### 3.3 Step 3 — Identify lowest-scoring questions within weakest sub-area

For the identified weakest sub-area, find the 2 lowest-scoring questions:

```pseudo
function identify_lowest_questions(weakest_subarea, question_scores):
  subarea_questions = {
    "A": ["Q8", "Q9", "Q10"],
    "B": ["Q11", "Q12", "Q13"],
    "C": ["Q14", "Q15", "Q16"],
    "D": ["Q17", "Q18"]
  }[weakest_subarea]
  
  // Sort questions by score ascending; ties broken by lower Q-number first
  sorted = sort(subarea_questions, by_score_then_q_number)
  
  return sorted[0:2]  // top 2 lowest-scoring
```

### 3.4 Step 4 — Identify strongest sub-area (for narrative)

Same logic inverted. Find highest sub-area percentage. Use for the "strongest area" line in the "what this means" paragraph.

```pseudo
function identify_strongest(percent_A, percent_B, percent_C, percent_D):
  max_pct = max(percent_A, percent_B, percent_C, percent_D)
  // No proximity rule needed for strongest; just return the highest
  if percent_A == max_pct: return "A"
  if percent_B == max_pct: return "B"
  if percent_C == max_pct: return "C"
  return "D"
```

### 3.5 Worked example

**Respondent:** Auto / Tier-1 / ₹500-1,000 Cr / Unlisted / EU exports / Major listed buyer / Major MNC supply

**Sub-area scores:**

| Sub-area | Score | Max | Percentage |
|---|---|---|---|
| A — Data infrastructure | 3.5 | 12 | 29% |
| B — People & knowledge | 4.5 | 12 | 38% |
| C — Governance | 6 | 12 | 50% |
| D — Output & pressure | 5 | 8 | 63% |

**Step 1:** Percentages computed above.

**Step 2:** Min percentage = 29% (A). Candidates within 5pp = only A (B at 38% is > 5pp away). Weakest = **A**.

**Step 3:** Within A (Q8, Q9, Q10), scores are Q8=2, Q9=1.5, Q10=0. Sorted ascending: Q10 (0), Q9 (1.5). Lowest two: **Q10, Q9**.

**Step 4:** Max percentage = 63% (D). Strongest = **D**.

---

## PART 4 — Edge cases and special outputs

### 4.1 All frameworks = "Doesn't apply currently"

If after A1–A7 all 7 frameworks return "Doesn't apply currently" (no matching rules above default), set:

- `edge_case_flag = "all_doesnt_apply"`
- PDF rendering uses the alternate Page 1 "what this means" paragraph (per Document 4)
- Page 2 best practices section adjusts framing
- Recommendation engine still runs but produces foundational/preventive content

### 4.2 Advanced band (34–44/44) with full applicability

If `total ≥ 34` AND at least 3 frameworks are at Definite or Likely:

- `edge_case_flag = "advanced_band"`
- PDF rendering filters Best Practices selection to optimization/assurance bullets (skip foundational ones)
- "What this means" paragraph uses one of 7 "Advanced" templates

### 4.3 Score = 0/44

Genuinely possible. No special handling required — band is "Critical Gap." Recommendation engine surfaces foundational offerings.

### 4.4 Score = 44/44

Also possible. Band is "Advanced." Recommendation engine surfaces optimisation offerings.

---

## PART 5 — Logic summary table

For quick reference by the Make.com builder:

### Applicability evaluation order

| Step | Action |
|---|---|
| 1 | For each of 7 frameworks, run rule hierarchy (top-down, first match wins) |
| 2 | Record label, confidence %, why_text_key per framework |
| 3 | After all 7 done, check Q18 boost eligibility |
| 4 | Apply Q18 boost only to Likely/Possible labels; recalculate label if threshold crossed; cap at 95% |
| 5 | Pass results downstream |

### Readiness scoring order

| Step | Action |
|---|---|
| 1 | Score each of 11 scored questions per per-question rules |
| 2 | Aggregate to 4 sub-areas |
| 3 | Sum to total |
| 4 | Determine band and tagline |
| 5 | Compute sub-area percentages |
| 6 | Identify weakest sub-area with proximity tie-breaker |
| 7 | Identify top 2 lowest-scoring questions within weakest sub-area |
| 8 | Identify strongest sub-area |

---

## Test cases for end-to-end validation

When the Make.com scenario is built, validate against these test cases:

### Test 1 — Auto Tier-1 mid-maturity (running example throughout)

Inputs: Q1=Auto, Q2=Tier-1, Q3=₹500-1,000 Cr, Q4=unlisted, Q5=EU exports, Q6=major to top 250 listed, Q7=major MNC supply, Q8=ERP+HRMS (2), Q9=partial, Q10=no, Q11=part-time, Q12=informal, Q13=one-off, Q14=vendor master no ESG, Q15=generic policy, Q16=briefly mentioned, Q17=GHG+buyer Q&A (2), Q18=3-5

Expected outputs:
- BRSR: Likely 80% (boosted to 80% from 75% by Q18=+5)
- BRSR Core: Likely 85% (boosted from 80%)
- CCTS: Doesn't apply 90%
- CBAM: Doesn't apply 80% (Auto not in CBAM sectors)
- GRI: Possible 65% (boosted from 60%)
- GHG: Definite 95%
- Custom ESG: Definite 90%
- Total readiness: 19/44 → Foundation Needed
- Weakest sub-area: A (Data Infrastructure, 29%)
- Lowest questions in A: Q10, Q9

### Test 2 — Small unlisted food brand (zero applicability)

Inputs: Q1=Food, Q2=Packaged foods, Q3=<₹50 Cr, Q4=unlisted, Q5=no exports, Q6=no, Q7=no, Q8-Q18 all worst-option

Expected outputs:
- All 7 frameworks: Doesn't apply currently
- Total readiness: 0/44 → Critical Gap
- `edge_case_flag = "all_doesnt_apply"`

### Test 3 — Listed top-250 cement with advanced maturity

Inputs: Q1=Cement, Q2=Cement manufacturing, Q3=>₹5,000 Cr, Q4=top 250, Q5=both EU and other, Q6=no, Q7=major MNC supply, Q8-Q18 all best-option

Expected outputs:
- BRSR: Definite 95%
- BRSR Core: Definite 95%
- CCTS: Likely 80%
- CBAM: Definite 95%
- GRI: Likely 80%
- GHG: Definite 95%
- Custom ESG: Definite 90%
- Total readiness: 44/44 → Advanced
- `edge_case_flag = "advanced_band"`

### Test 4 — Mid-sized chemicals exporter with EU exposure

Inputs: Q1=Chemicals, Q2=Specialty chemicals, Q3=₹500-1,000 Cr, Q4=unlisted, Q5=EU exports, Q6=no, Q7=minor MNC supply, Q8-Q18 mid-range

Expected outputs:
- BRSR: Possible 60%
- BRSR Core: Doesn't apply 85%
- CCTS: Possible 60% (chemicals + ₹500-1,000 Cr)
- CBAM: Doesn't apply 80% (specialty chemicals not in CBAM sectors yet)
- GRI: Possible 60%
- GHG: Likely 75% or Definite 95% (depending on Q3 floor)
- Custom ESG: Likely 75%

### Test 5 — Q18 boost label flip

Same as Test 1 but Q18="More than 5":

Expected: Boost = +10 instead of +5.
- BRSR Core: 80% + 10 = 90% → flips to **Definite**
- GRI: 60% + 10 = 70% → flips to **Likely**

---

## What the Make.com freelancer must deliver

| Deliverable | Status criteria |
|---|---|
| Working scenario with all 7 framework evaluators | Test cases 1–5 above produce expected outputs |
| Q18 boost logic with label flip + 95% cap | Tested with both +5 and +10 boost levels |
| Readiness scorer producing correct sub-area + total | Validated against Documents 2 and 6 |
| Weakest sub-area identification with proximity rule | Validated against the worked example in 3.5 |
| Airtable lookup with graceful degradation | Tested when target cell exists and when it doesn't |
| JSON payload to PDFMonkey matching schema in Document 4 | Pass-through verification |
| Acknowledgement email immediate-send | Triggers within 30 seconds of lead capture |
| Internal lead alert email with full context | Subject line includes source, band, top framework |
| Lead tracking sheet/Airtable row creation | All 18 answers + computed results logged |
| Error handling and fallback emails | All 6 failure paths from Document 5 handled |
| Make.com run logging for monitoring | Errors visible in scenario dashboard |

---

*End of Document 6.*
