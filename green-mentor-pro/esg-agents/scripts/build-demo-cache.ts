/**
 * Pre-run the full 8-phase pipeline once, chaining each phase's emitted output
 * into the next via buildPhaseInput, and cache the artifacts to
 * lib/demo/cachedArtifacts.json. The PipelineBoard loads that file so a completed
 * engagement renders instantly; any single phase can still be re-run live on demand.
 *
 * Runs agents IN-PROCESS (not over HTTP) to avoid the ~5-min fetch timeout on the
 * slow phases. Needs ANTHROPIC_API_KEY in the environment:
 *
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/build-demo-cache.ts
 */
import fs from "node:fs";
import path from "node:path";
import { loadAgent } from "../lib/agents/loadAgent";
import { runAgent } from "../lib/agents/runAgent";
import { PHASE_ORDER, type PhaseKey } from "../lib/orchestrator/pipeline";
import { buildPhaseInput, summarizeArtifact, type Artifacts } from "../lib/demo/phaseInputs";

const OUT = path.join(process.cwd(), "lib/demo/cachedArtifacts.json");
const FORCE = process.argv.includes("--force"); // re-run even already-cached phases
const RETRIES = 3; // Opus samples non-deterministically (temperature omitted) — retry flaky emits

async function main() {
  // Resume: keep phases already cached unless --force.
  const artifacts: Artifacts = FORCE
    ? {}
    : (JSON.parse(fs.readFileSync(OUT, "utf8")) as Artifacts);

  for (const phase of PHASE_ORDER as PhaseKey[]) {
    if (artifacts[phase] && !FORCE) {
      console.error(`• ${phase} — cached, skipping`);
      continue;
    }
    const agent = loadAgent(buildPhaseInput(phase, artifacts).agentKey);
    let lastErr: unknown;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      const { input, ctx } = buildPhaseInput(phase, artifacts);
      process.stderr.write(`▶ ${phase} (${agent.model}) attempt ${attempt}/${RETRIES} … `);
      const t0 = Date.now();
      try {
        const result = await runAgent(agent, input, ctx);
        artifacts[phase] = result.output;
        fs.writeFileSync(OUT, JSON.stringify(artifacts, null, 2)); // incremental save
        console.error(`✓ ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        const sum = summarizeArtifact(phase, result.output)?.map((b) => `${b.label}=${b.value}`).join("  ·  ");
        if (sum) console.error(`    ${sum}`);
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        console.error(`✗ ${((Date.now() - t0) / 1000).toFixed(0)}s — ${(e as Error)?.message ?? e}`);
      }
    }
    if (lastErr) throw new Error(`${phase} failed after ${RETRIES} attempts: ${(lastErr as Error)?.message ?? lastErr}`);
  }
  console.error(`\n✅ cached ${Object.keys(artifacts).length} phases → ${OUT}`);
}

main().catch((e) => {
  console.error("cache build failed:", e?.message ?? e);
  process.exit(1);
});
