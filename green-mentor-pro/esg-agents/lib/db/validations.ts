import { createAdminClient } from "@/lib/supabase/admin";
import type { EsgValidation, Json } from "./types";

interface RawIssue {
  check_type?: string;
  type?: string;
  severity?: string;
  field_path?: string;
  row_ref?: string;
  message?: string;
  finding?: string;
  detected_value?: unknown;
  expected_hint?: unknown;
  expected?: unknown;
}

const SEVERITIES = new Set(["info", "warning", "error"]);

/** Map a data-validation agent's issues[] into esg_validations rows. */
export async function insertValidations(
  orgId: string,
  args: { engagementId: string; artifactId: string | null; validationOutput: unknown },
): Promise<number> {
  const out = (args.validationOutput ?? {}) as { issues?: RawIssue[]; gaps?: RawIssue[] };
  const issues = [...(out.issues ?? []), ...(out.gaps ?? [])];
  if (issues.length === 0) return 0;

  const admin = createAdminClient();
  const records = issues.map((i) => {
    const severity = (i.severity ?? "warning").toLowerCase();
    return {
      org_id: orgId,
      engagement_id: args.engagementId,
      artifact_id: args.artifactId,
      check_type: i.check_type ?? i.type ?? "consistency",
      severity: SEVERITIES.has(severity) ? severity : "warning",
      field_path: i.field_path ?? i.row_ref ?? null,
      message: i.message ?? i.finding ?? "Validation issue",
      detected_value: (i.detected_value ?? null) as Json,
      expected_hint: (i.expected_hint ?? i.expected ?? null) as Json,
      status: "open" as const,
    };
  });
  const { error } = await admin.from("esg_validations").insert(records);
  if (error) throw new Error(`insertValidations: ${error.message}`);
  return records.length;
}

export async function listValidations(orgId: string, engagementId: string): Promise<EsgValidation[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_validations")
    .select("*")
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listValidations: ${error.message}`);
  return (data ?? []) as EsgValidation[];
}
