import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { getSession } from "@/lib/auth/session";
import { resolveBuddyModel, engagementCopilotSystem } from "@/lib/ai/gateway";
import { buildEngagementTools } from "@/lib/ai/engagementTools";
import { getEngagementSnapshot } from "@/lib/db/engagements";
import { countOpenFieldReviews } from "@/lib/db/reviews";
import { loadMessages, replaceMessages } from "@/lib/db/messages";
import { nextRunnablePhase, type PhaseStatus } from "@/lib/orchestrator/gates";
import { PHASE_ORDER, type PhaseKey } from "@/lib/orchestrator/pipeline";
import { PHASE_ROWS } from "@/lib/demo/fixtures";

export const runtime = "nodejs";
export const maxDuration = 60; // tools are fast; phase runs are dispatched to the run route

const LABEL = Object.fromEntries(PHASE_ROWS.map((r) => [r.key, `${r.no}. ${r.label}`])) as Record<PhaseKey, string>;

export async function POST(req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  const session = await getSession();
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const snapshot = await getEngagementSnapshot(session.orgUuid, engagementId);
  if (!snapshot) return new Response(JSON.stringify({ error: "Engagement not found" }), { status: 404 });

  const { messages }: { messages: UIMessage[] } = await req.json();

  // Engagement context for the system prompt.
  const phaseStatus = Object.fromEntries(PHASE_ORDER.map((k) => [k, "not_started"])) as Record<PhaseKey, PhaseStatus>;
  for (const p of snapshot.phases) phaseStatus[p.phase_key] = p.status;
  const phaseLines = PHASE_ORDER.map((k) => `${LABEL[k]} — ${phaseStatus[k]}`);
  const openReviews = await countOpenFieldReviews(session.orgUuid, engagementId);

  const { model } = resolveBuddyModel();
  const system = engagementCopilotSystem({
    clientName: snapshot.engagement.client_name,
    financialYear: snapshot.engagement.financial_year,
    frameworks: snapshot.engagement.framework,
    phaseLines,
    nextRunnable: nextRunnablePhase(phaseStatus),
    openReviews,
  });

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(messages),
    tools: buildEngagementTools({ orgId: session.orgUuid, engagementId, userUuid: session.userUuid }),
    stopWhen: stepCountIs(6),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: ({ messages: finalMessages }) => {
      // Persist the full updated conversation (fire-and-forget; never block the stream).
      void replaceMessages(
        session.orgUuid,
        engagementId,
        finalMessages.map((m) => ({ id: m.id, role: m.role, parts: m.parts as unknown[] })),
        session.userUuid,
      );
    },
  });
}

/** Initial history for the panel (GET is convenient for the client to hydrate). */
export async function GET(req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  const session = await getSession();
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  const messages = await loadMessages(session.orgUuid, engagementId);
  return Response.json({ messages });
}
