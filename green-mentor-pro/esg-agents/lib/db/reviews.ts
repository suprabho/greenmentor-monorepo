import { createAdminClient } from "@/lib/supabase/admin";
import type { PhaseKey } from "@/lib/orchestrator/pipeline";
import type { EsgReviewItem, ReviewStatus, Json } from "./types";
import { CONFIDENCE_SCORE, type Confidence } from "./types";

/**
 * One review_queue row of subject_type 'phase_summary' IS the human gate for a
 * phase. Data-collection additionally fans out one 'field' row per dataset row.
 */
export async function openPhaseGate(
  orgId: string,
  args: {
    engagementId: string;
    phaseKey: PhaseKey;
    runId: string | null;
    subjectId: string | null; // the artifact id
    item: string;
    confidence?: number | null;
    requestedBy?: string | null;
  },
): Promise<EsgReviewItem> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("esg_review_queue")
    .insert({
      org_id: orgId,
      engagement_id: args.engagementId,
      phase_key: args.phaseKey,
      run_id: args.runId,
      subject_type: "phase_summary",
      subject_id: args.subjectId,
      item: args.item,
      confidence: args.confidence ?? null,
      review_required: (args.confidence ?? 1) < 0.6,
      status: "submitted",
      requested_by: args.requestedBy ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`openPhaseGate: ${error?.message ?? "no row"}`);
  return data as EsgReviewItem;
}

interface DatasetRow {
  metric_code?: string;
  site_id?: string;
  reported_value?: { value?: unknown; source_snippet?: string | null; extraction_note?: string | null };
  reported_unit?: { value?: unknown };
  overall_confidence?: Confidence;
  is_outlier?: boolean;
  outlier_note?: string;
}

/** One 'field' review row per extracted dataset row (data-collection). */
export async function fanoutFieldReviews(
  orgId: string,
  args: {
    engagementId: string;
    runId: string | null;
    datasetOutput: unknown;
    requestedBy?: string | null;
  },
): Promise<number> {
  const rows = ((args.datasetOutput as { dataset_rows?: DatasetRow[] })?.dataset_rows ?? []) as DatasetRow[];
  if (rows.length === 0) return 0;
  const admin = createAdminClient();
  const records = rows.map((r) => {
    const conf = (r.overall_confidence ?? "low") as Confidence;
    const reviewRequired = conf === "low" || r.is_outlier === true;
    const num = typeof r.reported_value?.value === "number" ? r.reported_value.value : Number(r.reported_value?.value ?? 0);
    return {
      org_id: orgId,
      engagement_id: args.engagementId,
      phase_key: "data_collection" as PhaseKey,
      run_id: args.runId,
      subject_type: "field" as const,
      item: `${r.metric_code ?? "metric"} @ ${r.site_id ?? "—"} (${r.reported_unit?.value ?? ""})`.trim(),
      ai_value: {
        value: Number.isFinite(num) ? num : 0,
        unit: r.reported_unit?.value ?? "",
        site: r.site_id ?? "—",
        metric_code: r.metric_code ?? null,
        source_snippet: r.reported_value?.source_snippet ?? null,
        note: r.outlier_note ?? r.reported_value?.extraction_note ?? null,
      } as Json,
      confidence: CONFIDENCE_SCORE[conf],
      review_required: reviewRequired,
      status: "submitted" as const,
      requested_by: args.requestedBy ?? null,
    };
  });
  const { error } = await admin.from("esg_review_queue").insert(records);
  if (error) throw new Error(`fanoutFieldReviews: ${error.message}`);
  return records.length;
}

export async function listReviews(
  orgId: string,
  engagementId: string,
  phaseKey?: PhaseKey,
  status?: ReviewStatus,
): Promise<EsgReviewItem[]> {
  const admin = createAdminClient();
  let q = admin
    .from("esg_review_queue")
    .select("*")
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .order("review_required", { ascending: false })
    .order("created_at", { ascending: true });
  if (phaseKey) q = q.eq("phase_key", phaseKey);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(`listReviews: ${error.message}`);
  return (data ?? []) as EsgReviewItem[];
}

/** Count open (submitted) data-collection field rows — the gate for that phase. */
export async function countOpenFieldReviews(orgId: string, engagementId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("esg_review_queue")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .eq("phase_key", "data_collection")
    .eq("subject_type", "field")
    .eq("status", "submitted");
  if (error) throw new Error(`countOpenFieldReviews: ${error.message}`);
  return count ?? 0;
}

/** Approve / reject one review row (a field row, or the phase_summary gate). */
export async function decideReview(
  orgId: string,
  reviewId: string,
  decision: "approved" | "rejected",
  patch: { reviewedBy?: string | null; feedback?: string | null } = {},
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("esg_review_queue")
    .update({ status: decision, reviewed_by: patch.reviewedBy ?? null, feedback: patch.feedback ?? null })
    .eq("org_id", orgId)
    .eq("id", reviewId);
  if (error) throw new Error(`decideReview: ${error.message}`);
}

/** Flip the phase_summary gate row for a phase (approve or reject). */
export async function decidePhaseGate(
  orgId: string,
  engagementId: string,
  phaseKey: PhaseKey,
  decision: "approved" | "rejected",
  patch: { reviewedBy?: string | null; feedback?: string | null } = {},
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("esg_review_queue")
    .update({ status: decision, reviewed_by: patch.reviewedBy ?? null, feedback: patch.feedback ?? null })
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .eq("phase_key", phaseKey)
    .eq("subject_type", "phase_summary")
    .eq("status", "submitted");
  if (error) throw new Error(`decidePhaseGate: ${error.message}`);
}
