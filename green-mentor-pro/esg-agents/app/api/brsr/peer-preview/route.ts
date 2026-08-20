import { NextResponse } from "next/server";
import { findBrsrPeerCandidates } from "@gm/orchestrator/peer";

export const runtime = "nodejs"; // service-role Supabase read
export const maxDuration = 60;

/**
 * No-LLM preview for the Agent Studio test bench: calls the peer-research
 * agent's `find_brsr_peer_candidates` grounding tool directly and returns the
 * payload the agent would see — subject profile plus the deterministically
 * scored candidate table.
 *
 * This isolates "are the DB queries and the similarity scoring right against
 * real BRSR data" from "is the agent reasoning well", and costs nothing to run.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.trim();
  const max = Number(searchParams.get("max_candidates") ?? 25);
  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });

  try {
    const result = await findBrsrPeerCandidates({
      symbol,
      max_candidates: Number.isFinite(max) ? max : 25,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "peer preview failed";
    return NextResponse.json({ error: message, candidates: [] }, { status: 500 });
  }
}
