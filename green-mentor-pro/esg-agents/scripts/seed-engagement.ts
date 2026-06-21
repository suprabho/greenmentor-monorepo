/**
 * Create an engagement (and its 8 phase rows) from config/engagement.template.json.
 *
 *   tsx scripts/seed-engagement.ts [config/engagement.template.json]
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY. STUB for M1 — wire to lib/db once the access
 * layer lands; for now it prints the rows it would insert.
 */
import fs from "node:fs";
import path from "node:path";
import { PHASES, PHASE_ORDER } from "../lib/orchestrator/pipeline";

const cfgPath = process.argv[2] ?? path.join(process.cwd(), "config", "engagement.template.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

const engagement = {
  client_name: cfg.engagement.client.legal_name,
  financial_year: cfg.engagement.reporting_period.label,
  framework: cfg.engagement.frameworks,
  config: cfg,
};

const phases = PHASE_ORDER.map((key) => ({
  phase_key: key,
  phase_no: PHASES[key].phaseNo,
  agent_family: PHASES[key].agentKey,
  status: "not_started",
}));

console.log("engagement:", JSON.stringify(engagement, null, 2));
console.log("phases:", JSON.stringify(phases, null, 2));
console.log("\n(STUB) wire to lib/db.insertEngagement + insertPhases in M1.");
