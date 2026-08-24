"use client";

import { useState } from "react";

/**
 * Renders a materiality-long-list result — the distilled long list the wizard
 * ends on. Columns mirror the consultant's register: Name | Description |
 * E/S/G | Frequency in analysed data, with each row expandable to the
 * provenance behind its counts (disclosing peers + prescribing frameworks).
 *
 * Sibling of the Agent Studio result cards (TopicsRunResult.tsx etc.) in the
 * same inline-style idiom.
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

const FRAMEWORK_LABEL: Record<string, string> = {
  sasb: "SASB",
  sustainalytics: "Sustainalytics",
  msci: "MSCI",
};

export interface LongListSourcePeer {
  symbol?: string;
  name?: string | null;
  as_disclosed?: string;
}

export interface LongListSourceFramework {
  framework?: string;
  as_named?: string;
}

export interface LongListFrequency {
  peer_count?: number;
  peers_analysed?: number;
  framework_count?: number;
  frameworks_analysed?: number;
  label?: string;
}

export interface LongListTopicRow {
  name?: string;
  description?: string;
  pillar?: string;
  frequency?: LongListFrequency;
  sources?: { peers?: LongListSourcePeer[]; frameworks?: LongListSourceFramework[] };
}

export interface LongListResultData {
  topics?: LongListTopicRow[];
  methodology?: string;
  caveats?: string[];
  error?: string;
}

export type LongListMeta = { model?: string; stopReason?: string | null; seconds?: number };

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", margin: "14px 0 5px" }}>
      {children}
    </div>
  );
}

const GRID = "220px 1fr 52px 190px";

export default function LongListResult({ data, meta }: { data: LongListResultData; meta: LongListMeta | null }) {
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const topics = data.topics ?? [];

  const copyTsv = async () => {
    const rows = [
      ["Name", "Description", "E / S / G", "Frequency in analysed data"],
      ...topics.map((t) => [t.name ?? "", t.description ?? "", t.pillar ?? "", t.frequency?.label ?? ""]),
    ];
    // Tabs/newlines inside a cell would shear the paste target's columns.
    const tsv = rows.map((r) => r.map((c) => c.replace(/[\t\n]+/g, " ")).join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable (permissions/insecure context) — button just doesn't confirm */
    }
  };

  return (
    <div style={{ marginTop: 16, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 750, color: INK }}>
          Materiality long list{" "}
          <span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>· {topics.length} topics</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {meta && (
            <span style={{ fontSize: 11.5, color: MUTED }}>
              {[meta.model, meta.seconds != null ? `${meta.seconds}s` : null].filter(Boolean).join(" · ")}
            </span>
          )}
          <button
            onClick={copyTsv}
            style={{ background: "#fff", color: copied ? ACCENT : "#5d6b64", border: `1px solid ${copied ? `${ACCENT}55` : BORDER}`, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 650, cursor: "pointer" }}
          >
            {copied ? "✓ Copied" : "Copy as TSV"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "9px 14px", background: "#f6f8f7", fontSize: 11, fontWeight: 700, letterSpacing: 0.3, color: "#5d6b64" }}>
          <span>Name</span>
          <span>Description</span>
          <span>E / S / G</span>
          <span>Frequency in analysed data</span>
        </div>

        {topics.map((t, i) => {
          const pillar = PILLAR_STYLE[t.pillar ?? ""] ?? null;
          const isOpen = open === i;
          const peers = t.sources?.peers ?? [];
          const frameworks = t.sources?.frameworks ?? [];
          return (
            <div key={`${t.name}-${i}`} style={{ borderTop: `1px solid ${BORDER}` }}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                title="Show the peers and frameworks behind this topic"
                style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, width: "100%", textAlign: "left", alignItems: "start", background: isOpen ? "#fbfcfb" : "none", border: "none", padding: "11px 14px", cursor: "pointer" }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{t.name}</span>
                <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "#3d4a44" }}>{t.description}</span>
                <span>
                  {pillar ? (
                    <span title={pillar.label} style={{ display: "inline-block", background: pillar.bg, color: pillar.fg, borderRadius: 6, padding: "2px 8px", fontSize: 11.5, fontWeight: 750 }}>
                      {t.pillar}
                    </span>
                  ) : (
                    <span style={{ color: MUTED }}>—</span>
                  )}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 650, color: "#3d4a44" }}>
                  {t.frequency?.label ?? "—"}
                  <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: MUTED, marginTop: 2 }}>
                    {isOpen ? "▾ hide sources" : "▸ sources"}
                  </span>
                </span>
              </button>

              {isOpen && (
                <div style={{ padding: "0 14px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>
                      Disclosing peers ({peers.length})
                    </div>
                    {peers.length === 0 && <div style={{ fontSize: 12, color: MUTED }}>No peer evidence — framework-prescribed only.</div>}
                    {peers.map((p, j) => (
                      <div key={`${p.symbol}-${j}`} style={{ fontSize: 12, lineHeight: 1.5, color: "#3d4a44" }}>
                        <strong style={{ color: INK }}>{p.symbol}</strong>
                        {p.name ? ` (${p.name})` : ""} — <em>&ldquo;{p.as_disclosed}&rdquo;</em>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", marginBottom: 4 }}>
                      Prescribing frameworks ({frameworks.length})
                    </div>
                    {frameworks.length === 0 && <div style={{ fontSize: 12, color: MUTED }}>No framework evidence — peer-disclosed only.</div>}
                    {frameworks.map((f, j) => (
                      <div key={`${f.framework}-${j}`} style={{ fontSize: 12, lineHeight: 1.5, color: "#3d4a44" }}>
                        <strong style={{ color: INK }}>{FRAMEWORK_LABEL[f.framework ?? ""] ?? f.framework}</strong> —{" "}
                        <em>&ldquo;{f.as_named}&rdquo;</em>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {topics.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: MUTED, borderTop: `1px solid ${BORDER}` }}>No topics emitted.</div>}
      </div>

      {data.methodology && (
        <>
          <Heading>Methodology</Heading>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "#3d4a44" }}>{data.methodology}</div>
        </>
      )}
      {(data.caveats?.length ?? 0) > 0 && (
        <>
          <Heading>Caveats</Heading>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {data.caveats!.map((c, i) => (
              <li key={i} style={{ fontSize: 12.5, lineHeight: 1.55, color: "#3d4a44" }}>{c}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
