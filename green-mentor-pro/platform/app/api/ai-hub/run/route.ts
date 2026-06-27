import { NextResponse } from "next/server";
import path from "node:path";
import { loadAgent, runAgent, type CallableToolFn } from "@gm/agents";
import { agentsRoot } from "@gm/orchestrator";
import { ensureOrchestratorInit } from "@/lib/orchestrator-server";

// loadAgent reads the package off disk (skill.md / io.schema.json / tools.json),
// so this must run on the Node runtime, not the edge.
export const runtime = "nodejs";
export const maxDuration = 60;

// The AI Hub families exposed in this slice, each backed by an esg-agents package.
const FAMILY_AGENT: Record<string, string> = {
  "document-extraction": "data-collection",
  "reports-producer": "report-drafting",
  "planning": "kickoff-scoping",
};

// Per-run AI Hub stubs the grounding (callable) tools — the agent still emits its
// structured output. Full grounding (DB / EFDB lookups) is the esg-agents pipeline's
// job; here we only prove the per-run seam.
const stubCallable: CallableToolFn = (name) => ({
  ok: true,
  stub: true,
  tool: name,
  note: "grounding tool stubbed in per-run AI Hub context",
});

export async function POST(req: Request) {
  try {
    const { family, input } = (await req.json()) as { family?: string; input?: Record<string, unknown> };
    const agentKey = family ? FAMILY_AGENT[family] : undefined;
    if (!agentKey) {
      return NextResponse.json({ error: `unknown family '${family}'` }, { status: 400 });
    }

    ensureOrchestratorInit();
    const agent = loadAgent(path.join(agentsRoot(), agentKey));
    const result = await runAgent(
      agent,
      input ?? {},
      {
        orgId: (input?.tenant_id as string) ?? "org_demo",
        engagementId: (input?.engagement_id as string) ?? "eng_demo",
        financialYear: input?.financial_year as string | undefined,
      },
      { runCallableTool: stubCallable },
    );

    return NextResponse.json({ agentKey, meta: result.meta, output: result.output });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
