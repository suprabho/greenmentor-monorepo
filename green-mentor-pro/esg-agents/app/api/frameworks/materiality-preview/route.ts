import { NextResponse } from "next/server";
import { getNicFrameworkMateriality } from "@gm/orchestrator/frameworks";

export const runtime = "nodejs"; // service-role Supabase read
export const maxDuration = 60;

/**
 * No-LLM preview for the Agent Studio test bench: calls the
 * nic-framework-materiality agent's `get_nic_framework_materiality` grounding
 * tool directly and returns the payload the agent would see — per framework, the
 * matched industries and the union of issues they flag.
 *
 * Sibling of ../../brsr/topics-preview, and for the same reason: it isolates
 * "are the crosswalk fan-out and the DB reads right against real framework data"
 * from "is the cross-framework dedupe good", and costs nothing to run.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const nicCodes = (searchParams.get("nic_codes") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const symbol = searchParams.get("symbol")?.trim() || null;
  const frameworks = (searchParams.get("frameworks") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!nicCodes.length && !symbol) {
    return NextResponse.json({ error: "nic_codes (comma-separated) or symbol is required" }, { status: 400 });
  }

  try {
    const result = await getNicFrameworkMateriality({
      nic_codes: nicCodes.length ? nicCodes : null,
      symbol,
      frameworks: frameworks.length ? frameworks : null,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "framework materiality preview failed";
    return NextResponse.json({ error: message, frameworks: {} }, { status: 500 });
  }
}
