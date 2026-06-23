/**
 * Verify the live pipeline cascade end-to-end: run the first N phases in order,
 * feeding each phase's REAL emitted output into the next phase's input via the
 * same buildPhaseInput() the PipelineBoard UI uses. Hits the running dev server,
 * so it exercises the exact route + env the browser does.
 *
 *   npx tsx scripts/verify-cascade.ts [N=3]          # first N phases, chained
 *   npx tsx scripts/verify-cascade.ts data_collection # one phase, fallback input
 */
import { PHASE_ORDER, type PhaseKey } from "../lib/orchestrator/pipeline";
import { buildPhaseInput, summarizeArtifact, type Artifacts } from "../lib/demo/phaseInputs";

const BASE = process.env.ESG_BASE_URL ?? "http://localhost:3300";
const arg = process.argv[2] ?? "3";
// numeric → run the first N phases chained; a phase key → run just that phase
// standalone (empty artifacts → buildPhaseInput uses its seed/config fallbacks).
const phases: PhaseKey[] = /^\d+$/.test(arg)
  ? (PHASE_ORDER.slice(0, Number(arg)) as PhaseKey[])
  : [arg as PhaseKey];

async function main() {
  const artifacts: Artifacts = {};
  for (const phase of phases) {
    const { agentKey, input, ctx } = buildPhaseInput(phase, artifacts);
    process.stdout.write(`▶ ${phase} (${agentKey}) … `);
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/agents/${agentKey}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, ctx }),
    });
    const data = await res.json();
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    if (!res.ok || data.error) {
      console.log(`❌ HTTP ${res.status} (${secs}s): ${data.error ?? "run failed"}`);
      process.exit(1);
    }
    artifacts[phase] = data.output;
    console.log(`✓ ${secs}s [${data.meta?.model}]`);
    const sum = summarizeArtifact(phase, data.output).map((b) => `${b.label}=${b.value}`).join("  ·  ");
    if (sum) console.log(`    ${sum}`);
  }
  console.log(`\n✅ ran ${phases.length} phase(s): ${phases.join(" → ")}`);
}

main().catch((e) => {
  console.error("verify failed:", e?.message ?? e);
  process.exit(1);
});
