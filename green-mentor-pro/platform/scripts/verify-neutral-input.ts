/**
 * Pure input-assembly verification — no DB, no LLM, no env needed.
 *   node --import tsx scripts/verify-neutral-input.ts
 *
 * A bare engagement (config: {}) must assemble every phase's agent input with NO
 * Acme/steel demo fixture data; config.data_source_mode: "demo" must still opt in.
 */
import { assemblePhaseInput, PHASE_ORDER } from "@gm/orchestrator";
import type { EsgEngagement } from "@gm/orchestrator";

const DEMO_MARKERS = /acme|steel|pune|chennai|mumbai|U27100|12400|3250|MSEDCL/i;

function engagementWith(config: Record<string, unknown>): EsgEngagement {
  return {
    id: "eng_verify",
    org_id: "org_verify",
    client_name: "Zenith Textiles Ltd",
    financial_year: "FY2026-27",
    framework: ["BRSR"],
    status: "active",
    config,
    created_by: "00000000-0000-0000-0000-0000000000aa",
    created_at: "",
    updated_at: "",
  };
}

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`✓ ${label}`);
  else {
    failures++;
    console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const bare = engagementWith({});
for (const phase of PHASE_ORDER) {
  const { input } = assemblePhaseInput(phase, bare, {});
  const json = JSON.stringify(input);
  const m = DEMO_MARKERS.exec(json);
  check(
    `${phase}: no demo fixture data`,
    !m,
    m ? `matched "${m[0]}" in …${json.slice(Math.max(0, m.index - 60), m.index + 60)}…` : undefined,
  );
}

const kick = assemblePhaseInput("kickoff", bare, {}).input;
check(`kickoff client.sector is "Unspecified"`, kick.client?.sector === "Unspecified");
check(`kickoff reporting_period.fy is the engagement FY`, kick.reporting_period?.fy === "FY2026-27");
const mat = assemblePhaseInput("materiality", bare, {}).input;
check(`materiality sector is "Unspecified"`, mat.sector === "Unspecified");
const reqs = assemblePhaseInput("data_requirements", bare, {}).input;
check(
  "data_requirements reporting_period derived from FY",
  reqs.reporting_period?.start === "2026-04-01" && reqs.reporting_period?.end === "2027-03-31",
);
const calc = assemblePhaseInput("calculation", bare, {}).input;
check("calculation omits denominators", !("denominators" in calc));
const pub = assemblePhaseInput("publication", bare, {}).input;
check("publication has no fabricated signoffs", Array.isArray(pub.signoffs) && pub.signoffs.length === 0);

// Demo stays available, strictly opt-in.
const demo = engagementWith({ data_source_mode: "demo" });
const demoKick = JSON.stringify(assemblePhaseInput("kickoff", demo, {}).input);
check("demo opt-in: kickoff carries the Acme steel fixture", /steel/i.test(demoKick) && /acme/i.test(demoKick));
const demoMat = assemblePhaseInput("materiality", demo, {}).input;
check("demo opt-in: materiality sector is steel", demoMat.sector === "Manufacturing — Steel");
const demoCalc = assemblePhaseInput("calculation", demo, {}).input;
check("demo opt-in: calculation has demo denominators", demoCalc.denominators?.production_tonnes === 84000);

if (failures) {
  console.error(`\n❌ ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n✅ neutral-input verification PASSED");
