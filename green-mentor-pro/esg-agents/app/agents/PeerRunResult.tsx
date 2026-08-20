"use client";

import { useState } from "react";

/**
 * Renders a peer-research result in the Agent Studio test bench — both the
 * emitted peer set (full agent run) and the no-LLM candidate preview, which
 * share the scores/profile shape produced by @gm/orchestrator/peer.
 *
 * Mirrors the platform's PeerSetCard (components/ai-hub/SkillCards.tsx) in the
 * Studio's inline-style idiom.
 */

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";
const MUTED = "#8a958f";
const INK = "#1a2420";

export interface PeerScores {
  business?: number | null;
  revenue?: number | null;
  market?: number | null;
  overall?: number | null;
  estimated_dimensions?: string[];
}

/** A row in either view: emitted peer, or a scored candidate from the preview. */
export interface PeerRow {
  name?: string;
  symbol?: string | null;
  nse_listed?: boolean;
  scores?: PeerScores;
  rationale?: string;
  shared_products?: string[];
  revenue_inr_cr?: number | null;
  markets_summary?: string | null;
  markets?: Record<string, number | null> | null;
  sources?: { kind?: string; ref?: string }[];
  products?: { name?: string | null; nic_code?: string | null; turnover_share?: number | null }[];
  industry?: string | null;
  sector?: string | null;
  fy?: string | null;
}

export interface PeerResultData {
  subject?: PeerRow;
  peers?: PeerRow[];
  candidates?: PeerRow[];
  methodology?: string;
  caveats?: string[];
  note?: string;
  count?: number;
  error?: string;
}

const inr = (n?: number | null) => (n == null ? null : `₹${n.toLocaleString("en-IN")} cr`);

function Score({ value, estimated }: { value?: number | null; estimated?: boolean }) {
  if (value == null) return <span style={{ textAlign: "right", color: MUTED }}>—</span>;
  const fg = value >= 70 ? ACCENT : value >= 40 ? "#a8710a" : "#b23b3b";
  return (
    <span
      style={{ textAlign: "right", fontWeight: 700, color: fg }}
      title={estimated ? "estimated from web research" : "deterministic, from BRSR filings"}
    >
      {value}
      {estimated ? "*" : ""}
    </span>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", margin: "14px 0 5px" }}>
      {children}
    </div>
  );
}

const GRID = "1fr 62px 62px 62px 62px";

export default function PeerRunResult({
  data,
  meta,
  mode,
}: {
  data: PeerResultData;
  meta?: { model?: string; stopReason?: string | null; seconds?: number } | null;
  mode: "run" | "preview";
}) {
  const [raw, setRaw] = useState(false);
  const rows = (mode === "preview" ? data.candidates : data.peers) ?? [];
  const s = data.subject ?? {};
  const anyEstimated = rows.some((p) => (p.scores?.estimated_dimensions ?? []).length > 0);

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, background: "#fff", marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, color: ACCENT, textTransform: "uppercase" }}>
            {mode === "preview" ? "Candidate preview · no LLM" : "Peer set"}
            {s.fy ? ` · BRSR FY ${s.fy}` : ""}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15.5, marginTop: 2, color: INK }}>
            {rows.length} {mode === "preview" ? "candidate" : "peer"}
            {rows.length === 1 ? "" : "s"} for {s.name ?? "the company"}
            {s.symbol ? ` (${s.symbol})` : ""}
          </div>
        </div>
        <button
          onClick={() => setRaw((r) => !r)}
          style={{ fontSize: 11.5, fontWeight: 600, color: "#5d6b64", background: "#f6f8f7", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {raw ? "Table" : "Raw JSON"}
        </button>
      </div>

      {(s.industry || s.sector || s.revenue_inr_cr != null) && (
        <div style={{ fontSize: 12.5, color: "#5d6b64", marginTop: 3 }}>
          {[s.industry ?? s.sector, inr(s.revenue_inr_cr), s.markets_summary].filter(Boolean).join(" · ")}
        </div>
      )}

      {meta && (
        <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
          {[meta.model, meta.stopReason ? `stop: ${meta.stopReason}` : null, meta.seconds ? `${meta.seconds}s` : null]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}

      {raw ? (
        <pre style={{ marginTop: 12, background: "#f6f8f7", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, fontSize: 11.5, lineHeight: 1.5, overflow: "auto", maxHeight: 520 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 12 }}>
          {data.note ?? data.error ?? "No results."}
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase" }}>
            <span>Company</span>
            <span style={{ textAlign: "right" }}>Business</span>
            <span style={{ textAlign: "right" }}>Revenue</span>
            <span style={{ textAlign: "right" }}>Market</span>
            <span style={{ textAlign: "right" }}>Overall</span>
          </div>
          {rows.map((p, i) => {
            const est = p.scores?.estimated_dimensions ?? [];
            return (
              <div key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : "none", paddingBottom: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, fontSize: 12.5, color: INK, fontVariantNumeric: "tabular-nums", alignItems: "baseline" }}>
                  <span style={{ fontWeight: 700, minWidth: 0 }}>
                    {p.name}
                    {p.symbol && <span style={{ fontWeight: 600, color: MUTED, marginLeft: 6, fontSize: 11 }}>{p.symbol}</span>}
                    {p.nse_listed === false && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#5d6b64", background: "#f0f6f3", border: `1px solid ${BORDER}`, padding: "1px 5px", borderRadius: 5 }}>
                        UNLISTED
                      </span>
                    )}
                    {p.revenue_inr_cr != null && (
                      <span style={{ fontWeight: 500, color: MUTED, marginLeft: 6, fontSize: 11 }}>{inr(p.revenue_inr_cr)}</span>
                    )}
                  </span>
                  <Score value={p.scores?.business} estimated={est.includes("business")} />
                  <Score value={p.scores?.revenue} estimated={est.includes("revenue")} />
                  <Score value={p.scores?.market} estimated={est.includes("market")} />
                  <span style={{ textAlign: "right", fontWeight: 800, color: INK }}>{p.scores?.overall ?? "—"}</span>
                </div>
                {p.rationale && <div style={{ fontSize: 12, color: "#5d6b64", marginTop: 3 }}>{p.rationale}</div>}
                {mode === "preview" && !!p.products?.length && (
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                    {p.products.slice(0, 3).map((pr) => `${pr.name ?? pr.nic_code}`).join(" · ")}
                  </div>
                )}
                {!!p.sources?.length && (
                  <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.sources.map((src, j) => (
                      <span key={j}>
                        {j > 0 && " · "}
                        {src.kind === "web" && src.ref?.startsWith("http") ? (
                          <a href={src.ref} target="_blank" rel="noopener noreferrer" style={{ color: MUTED }}>
                            {safeHost(src.ref)}
                          </a>
                        ) : (
                          src.ref
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!raw && anyEstimated && (
        <div style={{ marginTop: 8, fontSize: 11, color: MUTED }}>* estimated from web research (no filing data for that dimension)</div>
      )}
      {!raw && data.note && rows.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: MUTED }}>{data.note}</div>
      )}
      {!raw && data.methodology && (
        <>
          <Heading>Methodology</Heading>
          <div style={{ fontSize: 12, color: "#5d6b64" }}>{data.methodology}</div>
        </>
      )}
      {!raw && !!data.caveats?.length && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${BORDER}`, paddingTop: 8 }}>
          <Heading>Caveats</Heading>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#a8710a" }}>
            {data.caveats.map((c, i) => (
              <li key={i} style={{ marginBottom: 2 }}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Hostname for display; falls back to the raw ref if the URL doesn't parse. */
function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
