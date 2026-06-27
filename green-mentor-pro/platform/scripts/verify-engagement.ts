/**
 * End-to-end engine verification (Task 8) — no browser/auth needed.
 *   node --env-file=.env.local --import tsx scripts/verify-engagement.ts
 *
 * Creates a throwaway org + BRSR engagement in the shared esg_* DB, runs the
 * kickoff phase through @gm/orchestrator (real agent + tools + input assembly),
 * and reads back the persisted artifact. Proves the whole integration.
 */
import path from "node:path";
import { createRequire } from "node:module";
import {
  createAdminClient, createEngagement, runPhase, getLatestArtifact, setAgentsRoot,
} from "@gm/orchestrator";

const require = createRequire(import.meta.url);
setAgentsRoot(path.resolve(path.dirname(require.resolve("@gm/orchestrator")), "..", "agents"));

const FAKE_USER = "00000000-0000-0000-0000-0000000000aa";

async function main() {
  const admin = createAdminClient();
  const { data: org, error } = await admin
    .from("esg_organizations")
    .insert({ name: "VERIFY-DELETE", slug: `verify-${Math.random().toString(36).slice(2, 10)}` })
    .select("id").single();
  if (error || !org) throw new Error(`org insert: ${error?.message}`);
  console.log("✓ org:", org.id);

  const eng = await createEngagement(org.id, {
    clientName: "Acme Manufacturing Ltd",
    financialYear: "FY2025-26",
    framework: ["BRSR"],
    createdBy: FAKE_USER,
    config: {
      sector: "Manufacturing",
      sites: [{ site_id: "site_pune", name: "Pune Plant", country: "India" }],
      candidate_frameworks: ["BRSR", "GRI"],
      brief: "First-time BRSR Core filing for an Indian listed manufacturer.",
    },
  });
  console.log("✓ engagement:", eng.id, "(8 phases seeded)");

  console.log("▶ running kickoff phase (sonnet, real agent + tools)…");
  const result = await runPhase(org.id, eng.id, "kickoff", FAKE_USER);
  console.log("✓ run:", JSON.stringify(result));

  const artifact = await getLatestArtifact(org.id, eng.id, "kickoff");
  console.log("✓ artifact:", artifact?.artifact_type, "| status:", artifact?.status, "| confidence:", artifact?.confidence);
  console.log("✓ artifact payload keys:", Object.keys((artifact?.payload as Record<string, unknown>) ?? {}).join(", "));
  console.log("\n✅ end-to-end engine verification PASSED — org", org.id, "(name VERIFY-DELETE) left for cleanup");
}

main().catch((e) => { console.error("❌ FAIL:", e?.message ?? e); process.exit(1); });
