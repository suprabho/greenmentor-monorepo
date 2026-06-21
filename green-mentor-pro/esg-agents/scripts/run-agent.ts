/**
 * Run a single agent package against an input JSON file (no DB required).
 *
 *   tsx scripts/run-agent.ts <agentKey> <input.json>
 *   tsx scripts/run-agent.ts data-collection config/samples/portal_upload_manifest.sample.json
 *
 * Requires ANTHROPIC_API_KEY in the environment.
 */
import fs from "node:fs";
import path from "node:path";
import { loadAgent } from "../lib/agents/loadAgent";
import { runAgent } from "../lib/agents/runAgent";

async function main() {
  const [agentKey, inputPath] = process.argv.slice(2);
  if (!agentKey || !inputPath) {
    console.error("usage: tsx scripts/run-agent.ts <agentKey> <input.json>");
    process.exit(1);
  }

  const agent = loadAgent(path.join(process.cwd(), "agents", agentKey));
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));

  console.error(`▶ running ${agent.key} (${agent.model}) — emit tool: ${agent.emitToolName}`);

  const result = await runAgent(agent, input, {
    orgId: input.org_id ?? input.orgId ?? "org_dev",
    engagementId: input.engagement_id ?? input.engagementId ?? "eng_dev",
    financialYear: input.financial_year ?? input.financialYear,
  });

  console.error(`✓ ${agent.key} done (stop: ${result.meta.stopReason})`);
  console.log(JSON.stringify(result.output, null, 2));
}

main().catch((e) => {
  console.error("run failed:", e?.message ?? e);
  process.exit(1);
});
