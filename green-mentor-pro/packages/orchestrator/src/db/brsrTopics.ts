import { createAdminClient } from "../admin";
import { fetchAllRows, fyLabel } from "./brsrPeers";

/**
 * Read layer for the peer-material-topics-extraction agent's grounding tool,
 * over the material-issues rows the platform scrape worker extracts from BRSR
 * Section A XBRL (brsr_material_topics + the brsr_topic_canon LLM cache —
 * migration 0012). Service-role reads, same rationale as brsrPeers.ts: public
 * regulatory data, server-side tool handlers only.
 *
 * Filters on topics_status='extracted' — NOT profile_status: the topics stage
 * of scrape-brsr.ts runs independently of Section A profiling, so a filing can
 * have either without the other.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface PeerTopicRow {
  /** Verbatim MaterialIssueIdentified (entity-decoded, <=600 chars as stored). */
  topicRaw: string;
  riskOpportunity: "R" | "O" | "RO" | null;
  /** RationaleForIdentifyingTheRiskOpportunity, truncated to maxRationaleChars. */
  rationale: string | null;
  canonicalTopic: string | null;
  pillarHint: "environment" | "social" | "governance" | "cross_cutting" | null;
  canonConfidence: number | null;
}

export interface PeerMaterialTopics {
  filingId: string;
  symbol: string;
  companyName: string;
  fy: string;
  topics: PeerTopicRow[];
}

export interface PeerTopicsResult {
  peers: PeerMaterialTopics[];
  /** Input symbols with no topics-extracted filing (unlisted, not scraped, or the topics stage failed). */
  missing: string[];
}

/** Uppercased, deduped, order-preserving symbol list, capped (strict tool schemas can't carry bounds). */
export function normalizeSymbols(symbols: unknown, cap = 15): string[] {
  if (!Array.isArray(symbols)) return [];
  const cleaned = symbols
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(cleaned)].slice(0, cap);
}

/** Truncate on a word boundary with a trailing ellipsis; short strings pass through. */
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}

/**
 * Each peer's disclosed material-issue rows from its latest topics-extracted
 * filing (or the requested FY's, when that year was extracted), with the
 * canonical topic + pillar hint joined in from the canon cache.
 */
export async function fetchPeerMaterialTopics(
  symbols: string[],
  opts: { financialYear?: string; maxRationaleChars?: number } = {},
): Promise<PeerTopicsResult> {
  const maxRationale = opts.maxRationaleChars ?? 300;
  const syms = normalizeSymbols(symbols);
  if (!syms.length) return { peers: [], missing: [] };
  const admin = createAdminClient();

  // Symbols are stored uppercase (resolveCompany's ilike is an exact match on
  // them), so a plain .in() over the normalized list is safe.
  const filings = await fetchAllRows<Record<string, any>>((from, to) =>
    admin
      .from("brsr_filings")
      .select("id, symbol, company_name, legal_name, fy_from, fy_to")
      .in("symbol", syms)
      .eq("topics_status", "extracted")
      .order("id")
      .range(from, to),
  );

  // One filing per symbol: prefer the requested FY when it was extracted,
  // else the latest (mixed-FY cohorts are the agent's caveat to surface).
  const bySymbol = new Map<string, Record<string, any>[]>();
  for (const f of filings) {
    const list = bySymbol.get(f.symbol) ?? [];
    list.push(f);
    bySymbol.set(f.symbol, list);
  }
  const chosen = new Map<string, Record<string, any>>();
  for (const [symbol, rows] of bySymbol) {
    const matching = opts.financialYear
      ? rows.filter((r) => fyLabel(r.fy_from, r.fy_to) === opts.financialYear)
      : [];
    const pool = matching.length ? matching : rows;
    chosen.set(
      symbol,
      pool.reduce((best, r) => (r.fy_to > best.fy_to ? r : best)),
    );
  }

  const filingIds = [...chosen.values()].map((f) => f.id);
  const topicRows = filingIds.length
    ? await fetchAllRows<Record<string, any>>((from, to) =>
        admin
          .from("brsr_material_topics")
          .select("filing_id, context_ref, row_ord, topic_raw, topic_norm, risk_opportunity, rationale")
          .in("filing_id", filingIds)
          .order("filing_id")
          .order("row_ord", { ascending: true, nullsFirst: false })
          .order("context_ref")
          .range(from, to),
      )
    : [];

  // Canon join client-side (PostgREST can't reach brsr_topic_canon through the
  // base table — the join key is topic_norm, not a foreign key). Chunked .in()
  // keeps the querystring under PostgREST's URL length limit.
  const norms = [...new Set(topicRows.map((r) => r.topic_norm as string).filter(Boolean))];
  const canon = new Map<string, Record<string, any>>();
  for (let i = 0; i < norms.length; i += 150) {
    const { data, error } = await admin
      .from("brsr_topic_canon")
      .select("topic_norm, canonical_topic, pillar, confidence")
      .in("topic_norm", norms.slice(i, i + 150));
    if (error) throw new Error(error.message);
    for (const c of data ?? []) canon.set(c.topic_norm, c);
  }

  const topicsByFiling = new Map<string, PeerTopicRow[]>();
  for (const r of topicRows) {
    const c = canon.get(r.topic_norm);
    const list = topicsByFiling.get(r.filing_id) ?? [];
    list.push({
      topicRaw: r.topic_raw,
      riskOpportunity: r.risk_opportunity ?? null,
      rationale: r.rationale ? truncateAtWord(String(r.rationale), maxRationale) : null,
      canonicalTopic: c?.canonical_topic ?? null,
      pillarHint: c?.pillar ?? null,
      canonConfidence: typeof c?.confidence === "number" ? c.confidence : c?.confidence != null ? Number(c.confidence) : null,
    });
    topicsByFiling.set(r.filing_id, list);
  }

  // Preserve the caller's symbol order; a filing with zero rows still counts
  // as covered (topics_status='extracted' with an empty table is a real state).
  const peers: PeerMaterialTopics[] = [];
  for (const symbol of syms) {
    const f = chosen.get(symbol);
    if (!f) continue;
    peers.push({
      filingId: f.id,
      symbol,
      companyName: f.legal_name || f.company_name,
      fy: fyLabel(f.fy_from, f.fy_to),
      topics: topicsByFiling.get(f.id) ?? [],
    });
  }
  return { peers, missing: syms.filter((s) => !chosen.has(s)) };
}
