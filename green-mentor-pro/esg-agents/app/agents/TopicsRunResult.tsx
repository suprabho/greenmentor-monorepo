"use client";

import { useState } from "react";

/**
 * Renders a peer-material-topics-extraction result in the Agent Studio test
 * bench — both the emitted deduplicated table (full agent run) and the no-LLM
 * per-peer preview, whose payload comes straight from the
 * `get_peer_material_topics` grounding tool in @gm/orchestrator/peer.
 *
 * Sibling of PeerRunResult.tsx in the Studio's inline-style idiom.
 */

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";
const MUTED = "#8a958f";
const INK = "#1a2420";

const PILLAR_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  E: { bg: "#e8f5ee", fg: "#1f8a5b", label: "Environmental" },
  S: { bg: "#e9f0fa", fg: "#2f5fa8", label: "Social" },
  G: { bg: "#f4ecfa", fg: "#7a3fa8", label: "Governance" },
};

export interface TopicPeerRef {
  symbol?: string;
  name?: string | null;
  as_disclosed?: string | null;
}

export interface MaterialTopicRow {
  name?: string;
  description?: string;
  pillar?: string;
  peers?: TopicPeerRef[];
  frequency?: number;
  risk_opportunity?: string | null;
}

export interface PeerCoverageRow {
  symbol?: string;
  name?: string | null;
  fy?: string | null;
  topic_count?: number;
  source?: string;
}

/** A peer block in the no-LLM preview (the raw grounding-tool payload). */
export interface PreviewPeer {
  symbol?: string;
  name?: string;
  fy?: string;
  topic_count?: number;
  topics?: {
    topic?: string;
    risk_opportunity?: string | null;
    rationale?: string | null;
    canon?: { topic?: string; pillar?: string | null; confidence?: number | null } | null;
  }[];
  source?: { kind?: string; ref?: string };
}

export interface TopicsResultData {
  // emitted table (run mode)
  topics?: MaterialTopicRow[];
  peers_covered?: PeerCoverageRow[];
  peers_missing?: string[];
  methodology?: string;
  caveats?: string[];
  // grounding payload (preview mode)
  peers?: PreviewPeer[];
  missing?: string[];
  count?: number;
  note?: string | null;
  error?: string;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", margin: "14px 0 5px" }}>
      {children}
    </div>
  );
}

function PillarBadge({ pillar }: { pillar?: string }) {
  const p = pillar ? PILLAR_STYLE[pillar] : undefined;
  if (!p) return <span style={{ color: MUTED }}>—</span>;
  return (
    <span
      title={p.label}
      style={{ display: "inline-block", minWidth: 20, textAlign: "center", fontSize: 11, fontWeight: 800, color: p.fg, background: p.bg, border: `1px solid ${p.fg}33`, borderRadius: 6, padding: "2px 7px" }}
    >
      {pillar}
    </span>
  );
}

function PeerChips({ peers }: { peers?: TopicPeerRef[] }) {
  if (!peers?.length) return null;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
      {peers.map((p, i) => (
        <span
          key={i}
          title={p.as_disclosed ? `${p.name ?? p.symbol}: "${p.as_disclosed}"` : p.name ?? p.symbol}
          style={{ fontSize: 10.5, fontWeight: 700, color: "#5d6b64", background: "#f0f6f3", border: `1px solid ${BORDER}`, padding: "2px 7px", borderRadius: 6 }}
        >
          {p.symbol}
        </span>
      ))}
    </span>
  );
}

function MissingNote({ symbols }: { symbols?: string[] }) {
  if (!symbols?.length) return null;
  return (
    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: "#a8710a", background: "#fdf6e8", border: "1px solid #f0dfb8", borderRadius: 8, padding: "8px 12px" }}>
      No topics-extracted BRSR filing for: {symbols.join(", ")} — these peers are not in the table.
    </div>
  );
}

export default function TopicsRunResult({
  data,
  meta,
  mode,
}: {
  data: TopicsResultData;
  meta?: { model?: string; stopReason?: string | null; seconds?: number } | null;
  mode: "run" | "preview";
}) {
  const [raw, setRaw] = useState(false);
  const topics = data.topics ?? [];
  const previewPeers = data.peers ?? [];
  const missing = mode === "preview" ? data.missing : data.peers_missing;
  const empty = mode === "preview" ? previewPeers.length === 0 : topics.length === 0;

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, background: "#fff", marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, color: ACCENT, textTransform: "uppercase" }}>
            {mode === "preview" ? "Disclosed topics preview · no LLM" : "Material topics table"}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15.5, marginTop: 2, color: INK }}>
            {mode === "preview"
              ? `${previewPeers.length} peer${previewPeers.length === 1 ? "" : "s"} grounded`
              : `${topics.length} deduplicated topic${topics.length === 1 ? "" : "s"} across ${data.peers_covered?.length ?? 0} peer${(data.peers_covered?.length ?? 0) === 1 ? "" : "s"}`}
          </div>
        </div>
        <button
          onClick={() => setRaw((r) => !r)}
          style={{ fontSize: 11.5, fontWeight: 600, color: "#5d6b64", background: "#f6f8f7", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          {raw ? "Table" : "Raw JSON"}
        </button>
      </div>

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
      ) : empty ? (
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 12 }}>
          {data.note ?? data.error ?? "No results."}
        </div>
      ) : mode === "preview" ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
          {previewPeers.map((p, i) => (
            <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>
                {p.name ?? p.symbol}
                <span style={{ color: MUTED, fontWeight: 600, fontSize: 11, marginLeft: 6 }}>{p.symbol}</span>
                <span style={{ color: MUTED, fontWeight: 500, fontSize: 11, marginLeft: 6 }}>
                  FY {p.fy} · {p.topic_count} topic{p.topic_count === 1 ? "" : "s"}
                </span>
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {(p.topics ?? []).map((t, j) => (
                  <div key={j} style={{ fontSize: 12, color: "#42504a", display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span style={{ minWidth: 24, fontSize: 10.5, fontWeight: 700, color: MUTED }}>{t.risk_opportunity ?? "—"}</span>
                    <span style={{ fontWeight: 600, color: INK }}>{t.topic}</span>
                    {t.canon?.topic && (
                      <span style={{ fontSize: 10.5, color: MUTED }}>
                        → {t.canon.topic}
                        {t.canon.pillar ? ` (${t.canon.pillar})` : ""}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) 2fr 54px", gap: 10, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase" }}>
            <span>Material topic</span>
            <span>Description</span>
            <span style={{ textAlign: "center" }}>Pillar</span>
          </div>
          {topics.map((t, i) => (
            <div key={i} style={{ borderBottom: i < topics.length - 1 ? `1px solid ${BORDER}` : "none", paddingBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) 2fr 54px", gap: 10, alignItems: "baseline" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>
                  {t.name}
                  {t.risk_opportunity && (
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#5d6b64", textTransform: "uppercase" }}>
                      {t.risk_opportunity}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 12.5, color: "#42504a" }}>{t.description}</span>
                <span style={{ textAlign: "center" }}>
                  <PillarBadge pillar={t.pillar} />
                </span>
              </div>
              <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase" }}>
                  {t.frequency ?? t.peers?.length ?? 0} peer{(t.frequency ?? t.peers?.length ?? 0) === 1 ? "" : "s"}
                </span>
                <PeerChips peers={t.peers} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!raw && <MissingNote symbols={missing} />}
      {!raw && data.note && !empty && <div style={{ marginTop: 8, fontSize: 11, color: MUTED }}>{data.note}</div>}

      {!raw && mode === "run" && !!data.peers_covered?.length && (
        <>
          <Heading>Coverage</Heading>
          <div style={{ fontSize: 12, color: "#5d6b64" }}>
            {data.peers_covered.map((p, i) => (
              <span key={i}>
                {i > 0 && " · "}
                {p.symbol} (FY {p.fy ?? "?"}, {p.topic_count ?? 0})
              </span>
            ))}
          </div>
        </>
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
