import { createAdminClient } from "@/lib/supabase/admin";
import { getEngagement } from "@/lib/db/engagements";
import type { AssembleInput } from "./assemble";

/**
 * Read the final report artifacts for an engagement. Prefers status='final' but
 * falls back to the highest non-superseded version per phase, so a board-approved
 * (or not-yet-flagged) engagement still renders. Org-scoped (service-role).
 */
export async function getReportArtifacts(
  orgId: string,
  engagementId: string,
): Promise<AssembleInput | null> {
  const engagement = await getEngagement(orgId, engagementId);
  if (!engagement) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_artifacts")
    .select("phase_key, payload, status, version")
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .in("phase_key", ["report_drafting", "publication", "calculation"])
    .in("status", ["final", "draft"])
    .order("version", { ascending: false });
  if (error) throw new Error(`getReportArtifacts: ${error.message}`);

  const pick = (phase: string) => (data ?? []).find((r) => r.phase_key === phase)?.payload;

  const { data: asm } = await admin
    .from("esg_assumptions_log")
    .select("statement")
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId);

  return {
    engagement: {
      client_name: engagement.client_name,
      financial_year: engagement.financial_year,
      framework: engagement.framework,
    },
    reportDrafting: pick("report_drafting"),
    publication: pick("publication"),
    calculation: pick("calculation"),
    assumptions: (asm ?? []).map((a) => String(a.statement)),
  };
}
