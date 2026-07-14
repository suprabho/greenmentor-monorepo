// Acceptance tests for the ESG readiness engine, encoding the five validation
// cases from lead-gen-amitava/Document 6. Run with:
//   pnpm --filter @gm/platform esg:test
// (node:test via tsx — no test-framework dependency, matching the repo's
// existing `--import tsx` script pattern).
//
// IMPORTANT — the assertions follow Doc 6's RULE TABLES + the A8 boost
// algorithm, which are precise and internally consistent. Doc 6's hand-worked
// "expected outputs" contain three divergences from its own rules; each is
// flagged inline below and reported to the team for confirmation. The engine
// implements the rules; these tests lock in the rule-faithful behaviour.

import assert from "node:assert/strict";
import { test } from "node:test";

import { assess } from "../index";
import type { Answers, FrameworkKey } from "../types";

/** Build a full Answers object; scored questions default to worst option. */
function answers(overrides: Partial<Answers>): Answers {
  return {
    companyName: "Test Co",
    q1_sector: "other",
    q2_subsector: "n/a",
    q3_turnover: "under_50",
    q4_listed: "unlisted",
    q5_exports: "none",
    q6_listed_buyer: "no",
    q7_mnc: "no",
    q8_systems: ["none"],
    q9_scope12: "no",
    q10_scope3: "no",
    q11_owner: "no",
    q12_training: "none",
    q13_consultants: "no",
    q14_supplier_data: "no_master",
    q15_policy: "no",
    q16_board: "no",
    q17_outputs: ["none"],
    q18_requests: "none",
    ...overrides,
  };
}

function fw(result: ReturnType<typeof assess>, key: FrameworkKey) {
  const f = result.frameworks.find((x) => x.key === key);
  assert.ok(f, `framework ${key} missing`);
  return f!;
}

// --- Test 1 — Auto Tier-1 mid-maturity (the running example) -----------------
test("Doc 6 Test 1 — Auto Tier-1 mid-maturity", () => {
  const r = assess(
    answers({
      q1_sector: "automotive",
      q2_subsector: "Tier-1 supplier",
      q3_turnover: "500_1000",
      q4_listed: "unlisted",
      q5_exports: "eu",
      q6_listed_buyer: "major_top250",
      q7_mnc: "major",
      q8_systems: ["erp", "hrms"],
      q9_scope12: "partial",
      q10_scope3: "no",
      q11_owner: "part_time",
      q12_training: "informal",
      q13_consultants: "informal",
      q14_supplier_data: "master_no_esg",
      q15_policy: "generic",
      q16_board: "briefly",
      q17_outputs: ["ghg_inventory", "buyer_questionnaire"],
      q18_requests: "three_five", // boost = +5
    }),
  );

  assert.deepEqual(
    { l: fw(r, "brsr_full").label, c: fw(r, "brsr_full").confidence },
    { l: "Likely", c: 80 }, // 75 + 5
  );
  assert.deepEqual(
    { l: fw(r, "brsr_core").label, c: fw(r, "brsr_core").confidence },
    { l: "Likely", c: 85 }, // 80 + 5
  );
  assert.deepEqual(
    { l: fw(r, "ccts").label, c: fw(r, "ccts").confidence },
    { l: "Doesn't apply currently", c: 90 },
  );
  // DIVERGENCE #1: Doc 6 Test 1 states CBAM "Doesn't apply 80%", but rule A4.2
  // (EU export + non-CBAM sector + MAJOR MNC customer) matches this profile and
  // yields Possible 55%, then +5 boost → 60%. Tests 2–4 are consistent with the
  // rules; only Test 1/5's CBAM line conflicts. Engine follows the rule.
  assert.deepEqual(
    { l: fw(r, "cbam").label, c: fw(r, "cbam").confidence },
    { l: "Possible", c: 60 },
  );
  assert.deepEqual(
    { l: fw(r, "gri").label, c: fw(r, "gri").confidence },
    { l: "Possible", c: 65 }, // 60 + 5
  );
  assert.deepEqual(
    { l: fw(r, "ghg").label, c: fw(r, "ghg").confidence },
    { l: "Definite", c: 95 },
  );
  assert.deepEqual(
    { l: fw(r, "custom_esg").label, c: fw(r, "custom_esg").confidence },
    { l: "Definite", c: 90 },
  );

  assert.equal(r.readiness.totalScore, 19);
  assert.equal(r.readiness.band, "Foundation Needed");
  assert.equal(r.readiness.weakestSubarea, "A");
  assert.deepEqual(r.readiness.weakestQuestions, ["Q10", "Q9"]);
  assert.equal(r.readiness.strongestSubarea, "D");
});

// --- Test 2 — Small unlisted food brand (zero applicability) ------------------
test("Doc 6 Test 2 — zero applicability, all doesn't apply", () => {
  const r = assess(
    answers({
      q1_sector: "food",
      q2_subsector: "Packaged foods",
      q3_turnover: "under_50",
      // all profiling = no exposure, all scored = worst (defaults)
    }),
  );

  // Six regulatory frameworks all "Doesn't apply currently".
  for (const k of ["brsr_full", "brsr_core", "ccts", "cbam", "gri", "custom_esg"] as FrameworkKey[]) {
    assert.equal(fw(r, k).label, "Doesn't apply currently", `${k} should not apply`);
  }
  // DIVERGENCE #2 (design gap): Doc 6 Test 2 says "all 7 doesn't apply", but rule
  // A6 has no doesn't-apply outcome — GHG rule 3 is Possible 55% ("voluntary
  // baseline"), which Doc 4's honesty paragraph explicitly still recommends.
  // GHG therefore shows Possible; the all_doesnt_apply flag keys off the six
  // regulatory frameworks. PENDING product confirmation.
  assert.equal(fw(r, "ghg").label, "Possible");
  assert.equal(fw(r, "ghg").confidence, 55);

  assert.equal(r.readiness.totalScore, 0);
  assert.equal(r.readiness.band, "Critical Gap");
  assert.equal(r.edgeCaseFlag, "all_doesnt_apply");
});

// --- Test 3 — Listed top-250 cement, advanced maturity ------------------------
test("Doc 6 Test 3 — advanced, full applicability", () => {
  const r = assess(
    answers({
      q1_sector: "cement",
      q2_subsector: "Cement manufacturing",
      q3_turnover: "above_5000",
      q4_listed: "top_250",
      q5_exports: "both",
      q6_listed_buyer: "no",
      q7_mnc: "major",
      q8_systems: ["erp", "hrms", "ehs", "energy"], // 4 (capped)
      q9_scope12: "continuous",
      q10_scope3: "comprehensive",
      q11_owner: "team",
      q12_training: "org_wide",
      q13_consultants: "retainer",
      q14_supplier_data: "full_profiles",
      q15_policy: "targets",
      q16_board: "regular",
      q17_outputs: ["brsr", "voluntary_report", "ghg_inventory", "buyer_questionnaire"], // 4 (capped)
      q18_requests: "more_than_five", // boost = +10
    }),
  );

  assert.equal(fw(r, "brsr_full").label, "Definite");
  assert.equal(fw(r, "brsr_core").label, "Definite");
  // DIVERGENCE #3: Doc 6 Test 3 lists CCTS "Likely 80%" and GRI "Likely 80%" —
  // i.e. PRE-boost values. But Q18 = "More than 5" gives +10 (Test 1 & Test 5
  // both apply the boost), so CCTS 80→90 and GRI 80→90 flip to Definite. Engine
  // applies the boost uniformly per A8.
  assert.equal(fw(r, "ccts").label, "Definite"); // 80 + 10 = 90
  assert.equal(fw(r, "cbam").label, "Definite"); // EU + cement (CBAM sector) = 95
  assert.equal(fw(r, "gri").label, "Definite"); // 80 + 10 = 90
  assert.equal(fw(r, "ghg").label, "Definite");
  assert.equal(fw(r, "custom_esg").label, "Definite");

  assert.equal(r.readiness.totalScore, 44);
  assert.equal(r.readiness.band, "Advanced — Optimise & Assure");
  assert.equal(r.edgeCaseFlag, "advanced_band");
});

// --- Test 4 — Mid-sized chemicals exporter with EU exposure -------------------
// Q18 pinned to "1–2" (no boost) so the listed structural values match exactly.
test("Doc 6 Test 4 — chemicals exporter, EU exposure", () => {
  const r = assess(
    answers({
      q1_sector: "chemicals",
      q2_subsector: "Specialty chemicals",
      q3_turnover: "500_1000",
      q4_listed: "unlisted",
      q5_exports: "eu",
      q6_listed_buyer: "no",
      q7_mnc: "minor",
      q9_scope12: "partial",
      q10_scope3: "started",
      q11_owner: "part_time",
      q12_training: "informal",
      q18_requests: "one_two", // no boost
    }),
  );

  assert.deepEqual({ l: fw(r, "brsr_full").label, c: fw(r, "brsr_full").confidence }, { l: "Possible", c: 60 });
  assert.equal(fw(r, "brsr_core").label, "Doesn't apply currently");
  assert.deepEqual({ l: fw(r, "ccts").label, c: fw(r, "ccts").confidence }, { l: "Possible", c: 60 });
  assert.deepEqual({ l: fw(r, "cbam").label, c: fw(r, "cbam").confidence }, { l: "Doesn't apply currently", c: 80 });
  assert.deepEqual({ l: fw(r, "gri").label, c: fw(r, "gri").confidence }, { l: "Possible", c: 60 });
  assert.deepEqual({ l: fw(r, "ghg").label, c: fw(r, "ghg").confidence }, { l: "Definite", c: 95 });
  assert.deepEqual({ l: fw(r, "custom_esg").label, c: fw(r, "custom_esg").confidence }, { l: "Likely", c: 75 });
});

// --- Test 5 — Q18 boost label flip (Test 1 with Q18 = "More than 5") ----------
test("Doc 6 Test 5 — boost flips labels", () => {
  const base = answers({
    q1_sector: "automotive",
    q3_turnover: "500_1000",
    q4_listed: "unlisted",
    q5_exports: "eu",
    q6_listed_buyer: "major_top250",
    q7_mnc: "major",
    q18_requests: "more_than_five", // boost = +10
  });
  const r = assess(base);

  // BRSR Core 80 + 10 = 90 → Definite.
  assert.deepEqual({ l: fw(r, "brsr_core").label, c: fw(r, "brsr_core").confidence }, { l: "Definite", c: 90 });
  // GRI 60 + 10 = 70 → Likely.
  assert.deepEqual({ l: fw(r, "gri").label, c: fw(r, "gri").confidence }, { l: "Likely", c: 70 });
  // BRSR 75 + 10 = 85 → Likely.
  assert.deepEqual({ l: fw(r, "brsr_full").label, c: fw(r, "brsr_full").confidence }, { l: "Likely", c: 85 });
});

// --- Boost mechanics — cap and eligibility -----------------------------------
test("A8 boost caps at 95 and never touches Definite / Doesn't-apply", () => {
  // Definite stays put (not eligible), doesn't-apply stays put.
  const r = assess(
    answers({
      q1_sector: "automotive",
      q3_turnover: "500_1000",
      q4_listed: "unlisted",
      q6_listed_buyer: "major_top250",
      q7_mnc: "major",
      q18_requests: "more_than_five",
    }),
  );
  const ghg = fw(r, "ghg"); // Definite 95, not eligible
  assert.equal(ghg.confidence, 95);
  assert.equal(ghg.q18BoostApplied, false);
  // Every post-boost confidence is ≤ 95.
  for (const f of r.frameworks) assert.ok(f.confidence <= 95, `${f.key} exceeded 95`);
});
