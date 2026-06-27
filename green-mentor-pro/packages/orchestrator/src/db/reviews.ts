import { createAdminClient } from "../admin";
import type { PhaseKey } from "../orchestrator/pipeline";
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

/* ============ Kickoff open questions (the scope_approval clarification gate) ============ */

export interface OpenQuestionRow {
  id: string;
  question: string;
  answer: string | null;
  waived: boolean;
  status: ReviewStatus;
}

/**
 * Fan out one 'open_question' review row per kickoff open question. A (re-)run
 * supersedes the previous round's questions, so we clear any prior open_question
 * rows first — the answered ones have already been folded into
 * engagement.config.kickoff_clarifications, which is the durable record.
 */
export async function fanoutOpenQuestions(
  orgId: string,
  args: { engagementId: string; runId: string | null; questions: string[]; requestedBy?: string | null },
): Promise<number> {
  const admin = createAdminClient();
  const { error: delErr } = await admin
    .from("esg_review_queue")
    .delete()
    .eq("org_id", orgId)
    .eq("engagement_id", args.engagementId)
    .eq("phase_key", "kickoff")
    .eq("subject_type", "open_question");
  if (delErr) throw new Error(`fanoutOpenQuestions (clear): ${delErr.message}`);

  const questions = (args.questions ?? []).map((q) => String(q).trim()).filter(Boolean);
  if (questions.length === 0) return 0;
  const records = questions.map((q) => ({
    org_id: orgId,
    engagement_id: args.engagementId,
    phase_key: "kickoff" as PhaseKey,
    run_id: args.runId,
    subject_type: "open_question" as const,
    item: q,
    ai_value: { question: q } as Json,
    review_required: true,
    status: "submitted" as const,
    requested_by: args.requestedBy ?? null,
  }));
  const { error } = await admin.from("esg_review_queue").insert(records);
  if (error) throw new Error(`fanoutOpenQuestions: ${error.message}`);
  return records.length;
}

/** Count unanswered (submitted) kickoff open questions — the scope_approval gate. */
export async function countOpenQuestions(orgId: string, engagementId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("esg_review_queue")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .eq("phase_key", "kickoff")
    .eq("subject_type", "open_question")
    .eq("status", "submitted");
  if (error) throw new Error(`countOpenQuestions: ${error.message}`);
  return count ?? 0;
}

/** All kickoff open questions for an engagement, oldest first, with any answer/waiver. */
export async function listOpenQuestions(orgId: string, engagementId: string): Promise<OpenQuestionRow[]> {
  const rows = await listReviews(orgId, engagementId, "kickoff");
  return rows
    .filter((r) => r.subject_type === "open_question")
    .map((r) => {
      const av = (r.ai_value ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        question: String(av.question ?? r.item),
        answer: (av.answer as string) ?? null,
        waived: av.waived === true,
        status: r.status,
      };
    });
}

/** Answer or waive one open question → resolves it (status 'approved') and clears the gate row. */
export async function resolveOpenQuestion(
  orgId: string,
  reviewId: string,
  patch: { answer?: string | null; waived?: boolean; reviewedBy?: string | null },
): Promise<void> {
  const admin = createAdminClient();
  const { data: row, error: readErr } = await admin
    .from("esg_review_queue")
    .select("ai_value")
    .eq("org_id", orgId)
    .eq("id", reviewId)
    .eq("subject_type", "open_question")
    .single();
  if (readErr || !row) throw new Error(`resolveOpenQuestion (read): ${readErr?.message ?? "no row"}`);
  const prev = (row.ai_value ?? {}) as Record<string, unknown>;
  const waived = patch.waived === true;
  const answer = waived ? null : patch.answer?.trim() || null;
  const { error } = await admin
    .from("esg_review_queue")
    .update({
      status: "approved",
      feedback: waived ? "(waived)" : answer,
      ai_value: { ...prev, answer, waived } as Json,
      reviewed_by: patch.reviewedBy ?? null,
    })
    .eq("org_id", orgId)
    .eq("id", reviewId)
    .eq("subject_type", "open_question");
  if (error) throw new Error(`resolveOpenQuestion: ${error.message}`);
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
