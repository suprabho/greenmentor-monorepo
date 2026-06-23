/**
 * Create an engagement (and its 8 phase rows) from config/engagement.template.json.
 *
 *   tsx scripts/seed-engagement.ts [config/engagement.template.json]
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment.
 * Provisions a CLI dev org (slug "cli:dev") and creates the engagement under it.
 */
import fs from "node:fs";
import path from "node:path";
import { createAdminClient } from "../lib/supabase/admin";
import { createEngagement } from "../lib/db/engagements";

const DEV_USER_UUID = "00000000-0000-0000-0000-000000000001";
const DEV_ORG_SLUG = process.env.CLI_ORG_SLUG ?? "cli:dev";

async function devOrgId(): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_organizations")
    .upsert({ name: "CLI Dev Org", slug: DEV_ORG_SLUG, config: {} }, { onConflict: "slug" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`dev org upsert failed: ${error?.message}`);
  return data.id as string;
}

async function main() {
  const cfgPath = process.argv[2] ?? path.join(process.cwd(), "config", "engagement.template.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const orgId = await devOrgId();
  const eng = await createEngagement(orgId, {
    clientName: cfg.engagement.client.legal_name,
    financialYear: cfg.engagement.reporting_period.label,
    framework: cfg.engagement.frameworks,
    config: cfg.engagement,
    createdBy: DEV_USER_UUID,
  });
  console.log(`created engagement ${eng.id}`);
  console.log(`org ${orgId} · FY ${eng.financial_year} · ${eng.framework.join(", ")}`);
  console.log(`\nrun the next phase with:\n  tsx scripts/advance-phase.ts ${eng.id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
