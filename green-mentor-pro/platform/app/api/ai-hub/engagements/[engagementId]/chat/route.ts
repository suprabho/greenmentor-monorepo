import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { resolveBuddyModel } from "@gm/agents";
import {
  engagementCopilotSystem, buildEngagementTools,
  getEngagementSnapshot, countOpenFieldReviews, nextRunnablePhase,
  loadMessages, replaceMessages,
} from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";
import { PHASE_ORDER, PHASE_LABEL, type PhaseKey, type PhaseStatus } from "@/lib/engagement-ui";
import { ChatError, toChatError } from "@/lib/chat/errors";
import { chatPostBodySchema } from "@/lib/chat/schema";

export const runtime = "nodejs";
export const maxDuration = 60; // tools are fast; long phase runs go through the run route

// Engagement-scoped Report Copilot. Streams with engagement tools that mutate the
// SAME esg_* state the board shows; persists the conversation to esg_messages.
//
// The pre-stream body is wrapped so env/auth/lookup throws (e.g. a missing
// SUPABASE_SERVICE_ROLE_KEY via createAdminClient) return JSON, never an HTML error
// page — the client parses the stream and would otherwise die on "Unexpected token '<'".
export async function POST(req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return new ChatError("unauthorized").toResponse();
    const { engagementId } = await params;

    const snapshot = await getEngagementSnapshot(ctx.orgId, engagementId);
    if (!snapshot) return new ChatError("not_found", "Engagement not found.").toResponse();

    const parsed = chatPostBodySchema.safeParse(await req.json());
    if (!parsed.success) return new ChatError("bad_request").toResponse();
    const messages = parsed.data.messages as unknown as UIMessage[];

    const phaseStatus = Object.fromEntries(PHASE_ORDER.map((k) => [k, "not_started"])) as Record<PhaseKey, PhaseStatus>;
    for (const p of snapshot.phases) phaseStatus[p.phase_key as PhaseKey] = p.status as PhaseStatus;
    const phaseLines = PHASE_ORDER.map((k, i) => `${i + 1}. ${PHASE_LABEL[k]} — ${phaseStatus[k]}`);
    const openReviews = await countOpenFieldReviews(ctx.orgId, engagementId);
    const next = nextRunnablePhase(phaseStatus);

    const { model } = resolveBuddyModel();
    const system = engagementCopilotSystem({
      clientName: snapshot.engagement.client_name,
      financialYear: snapshot.engagement.financial_year,
      frameworks: snapshot.engagement.framework,
      phaseLines,
      nextRunnable: next ? PHASE_LABEL[next as PhaseKey] : null,
      openReviews,
    });

    const result = streamText({
      model,
      system,
      messages: await convertToModelMessages(messages),
      tools: buildEngagementTools({ orgId: ctx.orgId, engagementId, userUuid: ctx.userId }),
      stopWhen: stepCountIs(6),
    });

    // Drive the stream to completion server-side so onFinish still persists the
    // transcript if the client disconnects mid-stream.
    //
    // DO NOT "fix" this as a double-consume: verified against ai@6 dist
    // (StreamTextResult.teeStream, index.mjs:8146) that consumeStream() and
    // toUIMessageStreamResponse() each read an INDEPENDENT tee of baseStream.
    // Removing this line reintroduces the message-loss-on-disconnect bug (#59).
    void result.consumeStream();

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      // Await the write — a detached promise is dropped when the serverless
      // function suspends on response close, leaving the conversation unsaved.
      onFinish: async ({ messages: finalMessages }) => {
        try {
          await replaceMessages(
            ctx.orgId, engagementId,
            finalMessages.map((m) => ({ id: m.id, role: m.role, parts: m.parts as unknown[] })),
            ctx.userId,
          );
        } catch (err) {
          console.error(`[ai-hub/engagement-chat] failed to persist ${engagementId}:`, err);
        }
      },
      onError: (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        if (/api[_ ]?key|gateway|unauthor|forbidden|401|403/i.test(msg)) {
          return "The copilot has no working model credential. Set ANTHROPIC_API_KEY (or AI_GATEWAY_API_KEY) in platform/.env.local and restart.";
        }
        return msg;
      },
    });
  } catch (e) {
    return toChatError(e).toResponse();
  }
}

// Load the persisted conversation so the chat re-hydrates on open.
export async function GET(_req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return new ChatError("unauthorized").toResponse();
    const { engagementId } = await params;
    // Ownership: getEngagementSnapshot is org-scoped, so a missing snapshot means
    // this engagement isn't visible to the caller — mirror the POST 404 guard.
    const snapshot = await getEngagementSnapshot(ctx.orgId, engagementId);
    if (!snapshot) return new ChatError("not_found", "Engagement not found.").toResponse();
    const messages = await loadMessages(ctx.orgId, engagementId);
    return Response.json({ messages });
  } catch (e) {
    return toChatError(e).toResponse();
  }
}
