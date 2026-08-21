import { fetchPeerMaterialTopics, type PeerMaterialTopics } from "../db/brsrTopics";

/**
 * Grounding tool for the peer-material-topics-extraction agent: the material
 * responsible business conduct issues (BRSR Section A) each peer disclosed,
 * batched over the whole cohort in one call. Lives here (not toolHandlers.ts)
 * for the same reason as the peer-research tools — the platform and the Agent
 * Studio ground runs through one implementation via @gm/orchestrator/peer.
 */

/** Tool names the peer-material-topics-extraction agent may call (its tools.json). */
export const PEER_TOPICS_TOOL_NAMES = ["get_peer_material_topics"] as const;

/**
 * Compact per-peer payload for the model. topic_norm (the canon join key) is
 * dropped — the join already happened; the model reasons over the verbatim
 * topic, the truncated rationale, and the canon hint.
 */
export function peerTopicsForModel(p: PeerMaterialTopics) {
  return {
    symbol: p.symbol,
    name: p.companyName,
    fy: p.fy,
    topic_count: p.topics.length,
    topics: p.topics.map((t) => ({
      topic: t.topicRaw,
      risk_opportunity: t.riskOpportunity,
      rationale: t.rationale,
      canon: t.canonicalTopic
        ? { topic: t.canonicalTopic, pillar: t.pillarHint, confidence: t.canonConfidence }
        : null,
    })),
    source: { kind: "brsr", ref: `NSE BRSR filing ${p.symbol} FY ${p.fy}` },
  };
}

/**
 * Material topics for up to 15 peers by NSE symbol (clamped in the read layer —
 * strict tool schemas can't carry bounds). `missing` lists symbols with no
 * topics-extracted filing so coverage gaps are visible, never silent.
 */
export async function getPeerMaterialTopics(input: unknown): Promise<unknown> {
  const { symbols, financial_year } = (input ?? {}) as {
    symbols?: string[];
    financial_year?: string | null;
  };
  if (!symbols?.length) return { peers: [], missing: [], note: "provide at least one NSE symbol" };
  try {
    const { peers, missing } = await fetchPeerMaterialTopics(symbols, {
      financialYear: financial_year?.trim() || undefined,
    });
    const zeroTopic = peers.filter((p) => p.topics.length === 0).map((p) => p.symbol);
    const notes = [
      missing.length ? `no topics-extracted BRSR filing for: ${missing.join(", ")}` : null,
      zeroTopic.length ? `filing extracted but zero material-issue rows for: ${zeroTopic.join(", ")}` : null,
    ].filter(Boolean);
    return {
      peers: peers.map(peerTopicsForModel),
      missing,
      count: peers.length,
      note: notes.length ? notes.join("; ") : null,
    };
  } catch (e) {
    return { peers: [], missing: [], error: e instanceof Error ? e.message : String(e) };
  }
}
