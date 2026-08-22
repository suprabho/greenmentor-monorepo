/**
 * @gm/orchestrator/peer — the peer-research grounding layer, exposed as a narrow
 * subpath so consumer apps (the Agent Studio in esg-agents) can wire the BRSR
 * tools without importing the package barrel, which drags in the whole engagement
 * pipeline, the EFDB client and the report renderer.
 *
 * The two tool bodies live here (not in toolHandlers.ts) so the platform and the
 * Studio ground agent runs through one implementation.
 */
import {
  findPeerCandidates,
  resolveCompany,
  type CompanyBrsrProfile,
} from "../db/brsrPeers";
import { getPeerMaterialTopics } from "./topics";

export {
  resolveCompany,
  findPeerCandidates,
  listBrsrCompanies,
  type CompanyBrsrProfile,
  type PeerCandidate,
  type BrsrActivity,
  type BrsrCompanyListItem,
} from "../db/brsrPeers";

export {
  businessSimilarity,
  revenueSimilarity,
  marketSimilarity,
  overallScore,
  shareWeights,
  type ActivityShare,
  type MarketsProfile,
} from "./scoring";

export {
  getPeerMaterialTopics,
  peerTopicsForModel,
  PEER_TOPICS_TOOL_NAMES,
} from "./topics";
export {
  fetchPeerMaterialTopics,
  type PeerMaterialTopics,
  type PeerTopicRow,
  type PeerTopicsResult,
} from "../db/brsrTopics";

/** Tool names the peer-research agent may call (agents/peer-research/tools.json). */
export const PEER_TOOL_NAMES = ["get_company_brsr_profile", "find_brsr_peer_candidates"] as const;

/**
 * Compact profile for the model: full activity vectors are already folded into
 * the deterministic scores, so tool payloads carry only what the agent needs to
 * reason and cite (top products, sector, revenue, markets, filing FY).
 */
export function profileForModel(p: CompanyBrsrProfile) {
  return {
    symbol: p.symbol,
    name: p.legalName ?? p.companyName,
    fy: p.fy,
    website: p.website,
    sector: p.sector ? `${p.sector.sectionLetter} — ${p.sector.title} (${p.sector.superSector})` : null,
    industry: p.industry ? `${p.industry.divisionCode} — ${p.industry.title}` : null,
    products: p.activities.slice(0, 10).map((a) => ({
      name: a.productName,
      nic_code: a.nicCode,
      turnover_share: a.turnover,
    })),
    revenue_inr_cr: p.revenue?.inrCr ?? null,
    markets: p.markets,
    source: { kind: "brsr", ref: `NSE BRSR filing ${p.symbol} FY ${p.fy}` },
  };
}

/**
 * BRSR company profile — Section A identity, products/turnover split, absolute
 * revenue, markets served. Public regulatory data, so no tenant scoping; reads
 * only cleanly profiled filings.
 */
export async function getCompanyBrsrProfile(input: unknown): Promise<unknown> {
  const { symbol, name } = (input ?? {}) as { symbol?: string | null; name?: string | null };
  if (!symbol?.trim() && !name?.trim()) {
    return { company: null, note: "provide an NSE symbol or a company name" };
  }
  try {
    const profile = await resolveCompany({ symbol: symbol ?? undefined, name: name ?? undefined });
    if (!profile) {
      return {
        company: null,
        note: "no profiled BRSR filing found — the company may be unlisted, not yet scraped, or the name may need refining (try the NSE symbol)",
      };
    }
    return { company: profileForModel(profile) };
  } catch (e) {
    return { company: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Peer candidates sharing NIC divisions with the subject, with deterministic
 * similarity scores (./scoring). The agent ranks/annotates these; it must not
 * invent scores. market=null → cover that pair via web research.
 */
export async function findBrsrPeerCandidates(input: unknown): Promise<unknown> {
  const { symbol, max_candidates } = (input ?? {}) as { symbol?: string; max_candidates?: number | null };
  if (!symbol?.trim()) return { candidates: [], note: "symbol is required" };
  try {
    const subject = await resolveCompany({ symbol });
    if (!subject) return { candidates: [], note: `no profiled BRSR filing for symbol "${symbol}"` };
    const candidates = await findPeerCandidates(subject, { limit: max_candidates ?? 25 });
    return {
      subject: profileForModel(subject),
      candidates: candidates.map((c) => ({ ...profileForModel(c.profile), scores: c.scores })),
      count: candidates.length,
      note: candidates.length
        ? "scores are deterministic (0-100) from BRSR filings; market=null means filings lack markets data for the pair — use web research there"
        : "no NIC-division peers found in the BRSR corpus — fall back to web research",
    };
  } catch (e) {
    return { candidates: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Dispatch a peer grounding tool by name; null for a name this layer doesn't own. */
export function runPeerTool(name: string, input: unknown): Promise<unknown> | null {
  if (name === "get_company_brsr_profile") return getCompanyBrsrProfile(input);
  if (name === "find_brsr_peer_candidates") return findBrsrPeerCandidates(input);
  if (name === "get_peer_material_topics") return getPeerMaterialTopics(input);
  return null;
}
