import { NextResponse } from "next/server";
import { getPeerMaterialTopics } from "@gm/orchestrator/peer";

export const runtime = "nodejs"; // service-role Supabase read
export const maxDuration = 60;

/**
 * No-LLM preview for the Agent Studio test bench: calls the
 * peer-material-topics-extraction agent's `get_peer_material_topics` grounding
 * tool directly and returns the payload the agent would see — each peer's
 * disclosed material issues with canon hints, plus the `missing` symbols.
 *
 * This isolates "are the DB reads right against real BRSR data" from "is the
 * dedupe/classification good", and costs nothing to run.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!symbols.length) return NextResponse.json({ error: "symbols is required (comma-separated)" }, { status: 400 });

  try {
    const result = await getPeerMaterialTopics({
      symbols,
      financial_year: searchParams.get("financial_year") || null,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "topics preview failed";
    return NextResponse.json({ error: message, peers: [] }, { status: 500 });
  }
}
