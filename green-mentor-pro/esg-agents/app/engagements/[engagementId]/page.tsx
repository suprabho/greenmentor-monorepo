import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import type { UIMessage } from "ai";
import { getEngagementSnapshot } from "@/lib/db/engagements";
import { listReviews, listOpenQuestions } from "@/lib/db/reviews";
import { loadMessages } from "@/lib/db/messages";
import { confidenceLabel } from "@/lib/db/types";
import { nextRunnablePhase, type PhaseStatus } from "@/lib/orchestrator/gates";
import { PHASE_ORDER, type PhaseKey } from "@/lib/orchestrator/pipeline";
import type { ReviewItem, OpenQuestionReview } from "@/lib/demo/fixtures";
import EngagementBoard from "./EngagementBoard";
import EngagementChat from "./EngagementChat";

export default async function Page({ params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const snapshot = await getEngagementSnapshot(session.orgUuid, engagementId);
  if (!snapshot) notFound();

  const phaseStatus = Object.fromEntries(PHASE_ORDER.map((k) => [k, "not_started"])) as Record<PhaseKey, PhaseStatus>;
  for (const p of snapshot.phases) phaseStatus[p.phase_key] = p.status;
  const nextRunnable = nextRunnablePhase(phaseStatus);

  const artifactPayloads: Partial<Record<PhaseKey, unknown>> = {};
  for (const k of PHASE_ORDER) {
    const a = snapshot.artifactByPhase[k];
    if (a) artifactPayloads[k] = a.payload;
  }

  const chatHistory = (await loadMessages(session.orgUuid, engagementId)) as unknown as UIMessage[];

  const openQuestionReviews: OpenQuestionReview[] = (await listOpenQuestions(session.orgUuid, engagementId)).map((q) => ({
    id: q.id,
    question: q.question,
    answer: q.answer ?? undefined,
    waived: q.waived,
    status: q.status,
  }));

  const config = snapshot.engagement.config ?? {};
  const dataSourceMode = config.data_source_mode === "user" ? "user" : "demo";
  const documents = (((config.documents as Record<string, unknown>[]) ?? [])).map((d) => ({
    name: String(d.name ?? "document"),
    parseStatus: String(d.parse_status ?? "skipped"),
    pageCount: typeof d.page_count === "number" ? d.page_count : null,
  }));

  const reviews = await listReviews(session.orgUuid, engagementId, "data_collection");
  const fieldReviews: ReviewItem[] = reviews
    .filter((r) => r.subject_type === "field")
    .map((r) => {
      const av = (r.ai_value ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        item: r.item,
        site: String(av.site ?? "—"),
        value: Number(av.value ?? 0),
        unit: String(av.unit ?? ""),
        confidence: confidenceLabel(r.confidence),
        sourceSnippet: String(av.source_snippet ?? "(no snippet)"),
        reviewRequired: r.review_required,
        note: (av.note as string) ?? undefined,
        status: r.status,
      };
    });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 0, minHeight: "100vh", background: "#f6f8f7" }}>
      <EngagementBoard
        engagement={{
          id: snapshot.engagement.id,
          clientName: snapshot.engagement.client_name,
          financialYear: snapshot.engagement.financial_year,
          framework: snapshot.engagement.framework,
        }}
        phaseStatus={phaseStatus}
        nextRunnable={nextRunnable}
        artifactPayloads={artifactPayloads}
        fieldReviews={fieldReviews}
        openQuestionReviews={openQuestionReviews}
        dataSourceMode={dataSourceMode}
        documents={documents}
      />
      <EngagementChat engagementId={engagementId} initialMessages={chatHistory} />
    </div>
  );
}
