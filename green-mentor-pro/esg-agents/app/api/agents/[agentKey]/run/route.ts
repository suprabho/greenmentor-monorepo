import { NextResponse } from "next/server";
import { loadAgent } from "@/lib/agents/loadAgent";
import { runAgent } from "@/lib/agents/runAgent";
import { getSession } from "@/lib/auth/session";
import { runPhase, PhaseNotRunnableError } from "@/lib/orchestrator/runPhase";
import { PHASES, PHASE_ORDER, type PhaseKey } from "@/lib/orchestrator/pipeline";

export const runtime = "nodejs"; // loadAgent reads the filesystem; node:crypto for session
export const maxDuration = 300; // Opus multi-turn runs exceed the default serverless timeout

const AGENT_TO_PHASE: Record<string, PhaseKey> = Object.fromEntries(
  PHASE_ORDER.map((k) => [PHASES[k].agentKey, k]),
) as Record<string, PhaseKey>;

/**
 * Agent runner. Two modes:
 *  • Real (body has engagementId): authenticated + tenant-scoped + persisted via
 *    runPhase (DB runs/artifacts/review_queue). ctx is derived server-side.
 *  • Legacy demo (no engagementId): the original in-memory path — loads the package
 *    and runs it with client-supplied input/ctx, no persistence.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentKey: string }> },
) {
  const { agentKey } = await params;
  const body = await req.json().catch(() => ({}));

  // ---- Real, persisted path ----
  if (body?.engagementId) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const phaseKey = AGENT_TO_PHASE[agentKey];
    if (!phaseKey) return NextResponse.json({ error: `Unknown agent "${agentKey}"` }, { status: 400 });
    try {
      const result = await runPhase(session.orgUuid, String(body.engagementId), phaseKey, session.userUuid);
      return NextResponse.json(result);
    } catch (e) {
      if (e instanceof PhaseNotRunnableError) return NextResponse.json({ error: e.message }, { status: 409 });
      const message = e instanceof Error ? e.message : "agent run failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ---- Legacy demo path (no DB) ----
  try {
    const agent = loadAgent(agentKey);
    if (!agent.enabled) {
      return NextResponse.json({ error: `${agentKey} is disabled in v1` }, { status: 409 });
    }
    const result = await runAgent(agent, body.input ?? {}, {
      orgId: body.ctx?.orgId ?? "org_dev",
      engagementId: body.ctx?.engagementId ?? "eng_dev",
      financialYear: body.ctx?.financialYear,
    });
    return NextResponse.json({ output: result.output, meta: result.meta });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "agent run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
