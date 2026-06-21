import { NextResponse } from "next/server";
import { loadAgent } from "@/lib/agents/loadAgent";
import { runAgent } from "@/lib/agents/runAgent";

export const runtime = "nodejs"; // loadAgent reads the filesystem

/**
 * Generic agent runner: POST /api/agents/<agentKey>/run  { input, ctx }.
 * Loads the package and binds it to a strict tool-use call. M1 adds auth + persistence
 * (agent_runs / artifacts / review_queue) around this core.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentKey: string }> },
) {
  const { agentKey } = await params;
  const body = await req.json().catch(() => ({}));

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
