"use client";

import { useState } from "react";

/**
 * Renders a nic-framework-materiality result in the Agent Studio test bench —
 * both the emitted deduplicated table (full agent run) and the no-LLM
 * per-framework preview, whose payload comes straight from the
 * `get_nic_framework_materiality` grounding tool in @gm/orchestrator/frameworks.
 *
 * Sibling of TopicsRunResult.tsx in the Studio's inline-style idiom. Where that
 * one's columns are the disclosing peers, these are the frameworks — SASB,
 * Sustainalytics and MSCI — so the convergence across them reads at a glance.
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

const FRAMEWORK_STYLE: Record<string, { fg: string; bg: string; label: string }> = {
  sasb: { fg: "#1f6f8a", bg: "#e6f2f6", label: "SASB" },
  sustainalytics: { fg: "#8a5a1f", bg: "#f7efe4", label: "Sustainalytics" },
  msci: { fg: "#7a3fa8", bg: "#f4ecfa", label: "MSCI" },
};

export interface TopicFrameworkRef {
  framework?: string;
  as_named?: string;
  code?: string | null;
  grouping?: string | null;
  prevalence?: number | null;
}

export interface FrameworkTopicRow {
  name?: string;
  description?: string;
  pillar?: string;
  frameworks?: TopicFrameworkRef[];
  convergence?: number;
  msci_weight_pct?: number | null;
  company_specific?: boolean | null;
  disclosure_topics?: { code?: string; name?: string; industry?: string }[] | null;
}

export interface FrameworkCoverageRow {
  framework?: string;
  matched_count?: number;
  match_level?: string | null;
  issue_count?: number;
  source?: string;
}

export interface NicScopeShape {
  divisions?: { code?: string; title?: string; section?: string; turnover_share?: number | null }[];
  sections?: { letter?: string; title?: string }[];
  unresolved?: string[];
  from_symbol?: { symbol?: string; name?: string | null; fy?: string | null; mapped_coverage?: number | null } | null;
}

/** One framework block in the no-LLM preview (the raw grounding-tool payload). */
export interface PreviewFramework {
  matched_industries?: { code?: string; name?: string; sector?: string | null; nic?: string; matched_at?: string; crosswalk_confidence?: string }[];
  matched_count?: number;
  issues?: {
    code?: string;
    name?: string;
    description?: string | null;
    framework_grouping?: string | null;
    pillar?: string;
    industries?: string[];
    industry_count?: number;
    prevalence?: number;
    avg_weight_pct?: number;
    max_weight_pct?: number;
    company_specific?: boolean;
    disclosure_topics?: { code?: string; name?: string; industry?: string }[];
  }[];
  issue_count?: number;
  weights_as_of?: string;
  licence?: string;
  note?: string | null;
}

export interface FrameworkResultData {
  // emitted table (run mode)
  topics?: FrameworkTopicRow[];
  nic_scope?: NicScopeShape;
  frameworks_covered?: FrameworkCoverageRow[];
  methodology?: string;
  caveats?: string[];
  // grounding payload (preview mode)
  scope?: NicScopeShape & { from_symbol?: unknown };
  frameworks?: Record<string, PreviewFramework> | FrameworkCoverageRow[];
  frameworks_requested?: string[];
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

/** The framework columns — a chip per naming framework, its native label on hover. */
function FrameworkChips({ frameworks }: { frameworks?: TopicFrameworkRef[] }) {
  if (!frameworks?.length) return <span style={{ color: MUTED }}>—</span>;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 4 }}>
      {frameworks.map((f, i) => {
        const s = f.framework ? FRAMEWORK_STYLE[f.framework] : undefined;
        const detail = [
          f.as_named ? `"${f.as_named}"` : null,
          f.grouping,
          f.prevalence != null ? `${Math.round(f.prevalence * 100)}% of matched industries` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <span
            key={i}
            title={detail || undefined}
            style={{ fontSize: 10.5, fontWeight: 700, color: s?.fg ?? "#5d6b64", background: s?.bg ?? "#f0f6f3", border: `1px solid ${(s?.fg ?? BORDER)}33`, padding: "2px 7px", borderRadius: 6 }}
          >
            {s?.label ?? f.framework}
          </span>
        );
      })}
    </span>
  );
}

/** NIC Divisions the run resolved to, plus how they were reached. */
function ScopeBar({ scope }: { scope?: NicScopeShape }) {
  if (!scope?.divisions?.length && !scope?.from_symbol) return null;
  const sym = scope?.from_symbol;
  return (
    <div style={{ marginTop: 10, fontSize: 12, color: "#5d6b64", background: "#f6f8f7", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px" }}>
      {sym?.symbol && (
        <div style={{ marginBottom: 4 }}>
          <strong style={{ color: INK }}>{sym.name ?? sym.symbol}</strong>{" "}
          <span style={{ color: MUTED }}>{sym.symbol}</span>
          {sym.fy ? ` · BRSR FY ${sym.fy}` : ""}
          {sym.mapped_coverage != null ? ` · ${Math.round(sym.mapped_coverage * 100)}% of turnover mapped to NIC` : ""}
        </div>
      )}
      <span style={{ fontWeight: 600 }}>NIC scope:</span>{" "}
      {(scope?.divisions ?? []).map((d, i) => (
        <span key={i} style={{ marginRight: 8 }}>
          {d.section}/{d.code} {d.title}
          {d.turnover_share != null ? ` (${Math.round(d.turnover_share * 100)}%)` : ""}
          {i < (scope!.divisions!.length - 1) ? " ·" : ""}
        </span>
      ))}
      {!!scope?.unresolved?.length && (
        <span style={{ color: "#a8710a" }}> · unresolved codes: {scope.unresolved.join(", ")}</span>
      )}
    </div>
  );
}

/** MSCI's licence terms travel with any table that contains its rows. */
function InternalUseNote() {
  return (
    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: "#7a3fa8", background: "#f4ecfa", border: "1px solid #dcc8ea", borderRadius: 8, padding: "8px 12px" }}>
      Contains proprietary MSCI reference data — internal use only, not for publication or redistribution.
    </div>
  );
}

function Note({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "muted" }) {
  const style =
    tone === "warn"
      ? { color: "#a8710a", background: "#fdf6e8", border: "1px solid #f0dfb8" }
      : { color: "#5d6b64", background: "#f6f8f7", border: `1px solid ${BORDER}` };
  return (
    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, borderRadius: 8, padding: "8px 12px", ...style }}>
      {children}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.4,
  color: MUTED,
  textTransform: "uppercase",
  borderBottom: `1px solid ${BORDER}`,
  padding: "7px 10px",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  fontSize: 12.5,
  color: INK,
  borderBottom: `1px solid ${BORDER}`,
  padding: "8px 10px",
  verticalAlign: "top",
};

/** The emitted, cross-framework deduplicated table. */
function EmittedTable({ data }: { data: FrameworkResultData }) {
  const topics = data.topics ?? [];
  const hasMsci = topics.some((t) => t.frameworks?.some((f) => f.framework === "msci"));
  const coverage = Array.isArray(data.frameworks_covered) ? data.frameworks_covered : [];

  return (
    <>
      <ScopeBar scope={data.nic_scope} />
      {hasMsci && <InternalUseNote />}

      <Heading>
        Material topics — {topics.length} deduplicated across {coverage.length || 3} frameworks
      </Heading>
      <div style={{ overflowX: "auto", border: `1px solid ${BORDER}`, borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}>Topic</th>
              <th style={th}>Pillar</th>
              <th style={th}>Frameworks</th>
              <th style={{ ...th, textAlign: "right" }}>MSCI wt</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((t, i) => (
              <tr key={i}>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  {t.description && (
                    <div style={{ fontSize: 11.5, color: "#5d6b64", marginTop: 2, lineHeight: 1.5 }}>{t.description}</div>
                  )}
                  {!!t.disclosure_topics?.length && (
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
                      SASB disclosure topics: {t.disclosure_topics.map((d) => d.name).filter(Boolean).join("; ")}
                    </div>
                  )}
                </td>
                <td style={td}>
                  <PillarBadge pillar={t.pillar} />
                </td>
                <td style={td}>
                  <FrameworkChips frameworks={t.frameworks} />
                  <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>
                    convergence {t.convergence ?? t.frameworks?.length ?? 0}/3
                  </div>
                </td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  {t.msci_weight_pct != null ? (
                    <span style={{ fontWeight: 700 }}>{t.msci_weight_pct}%</span>
                  ) : (
                    <span style={{ color: MUTED }}>—</span>
                  )}
                  {t.company_specific && (
                    <div title="MSCI applies this only to some companies in the industry" style={{ fontSize: 10, color: "#a8710a" }}>
                      company-specific
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!!coverage.length && (
        <>
          <Heading>Framework coverage</Heading>
          <div style={{ overflowX: "auto", border: `1px solid ${BORDER}`, borderRadius: 10 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={th}>Framework</th>
                  <th style={{ ...th, textAlign: "right" }}>Industries</th>
                  <th style={th}>Matched at</th>
                  <th style={{ ...th, textAlign: "right" }}>Issues</th>
                  <th style={th}>Source</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((c, i) => {
                  const s = c.framework ? FRAMEWORK_STYLE[c.framework] : undefined;
                  return (
                    <tr key={i}>
                      <td style={{ ...td, fontWeight: 700, color: s?.fg ?? INK }}>{s?.label ?? c.framework}</td>
                      <td style={{ ...td, textAlign: "right" }}>{c.matched_count ?? 0}</td>
                      <td style={td}>
                        {c.match_level === "section" ? (
                          <span title="No framework industry maps to the NIC Division — this is a sector-level answer" style={{ color: "#a8710a", fontWeight: 700 }}>
                            NIC Section
                          </span>
                        ) : (
                          <span style={{ color: MUTED }}>{c.match_level ?? "—"}</span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{c.issue_count ?? 0}</td>
                      <td style={{ ...td, fontSize: 11.5, color: "#5d6b64" }}>{c.source}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.methodology && (
        <>
          <Heading>Methodology</Heading>
          <div style={{ fontSize: 12.5, color: "#5d6b64", lineHeight: 1.6 }}>{data.methodology}</div>
        </>
      )}
      {!!data.caveats?.length && (
        <>
          <Heading>Caveats</Heading>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#5d6b64", lineHeight: 1.6 }}>
            {data.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** The raw grounding payload, per framework — what the agent sees before deduping. */
function PreviewTables({ data }: { data: FrameworkResultData }) {
  const frameworks = (data.frameworks ?? {}) as Record<string, PreviewFramework>;
  const keys = Object.keys(frameworks);
  return (
    <>
      <ScopeBar scope={data.scope} />
      {"msci" in frameworks && <InternalUseNote />}
      {data.note && <Note>{data.note}</Note>}

      {keys.map((key) => {
        const f = frameworks[key];
        const s = FRAMEWORK_STYLE[key];
        const broad = f.matched_industries?.some((m) => m.matched_at === "section");
        return (
          <div key={key}>
            <Heading>
              <span style={{ color: s?.fg ?? MUTED }}>{s?.label ?? key}</span> — {f.issue_count ?? 0} issues from{" "}
              {f.matched_count ?? 0} matched {key === "msci" ? "GICS sub-industries" : "industries"}
              {broad ? " (NIC Section — sector-level)" : ""}
              {f.weights_as_of ? ` · weights as of ${f.weights_as_of}` : ""}
            </Heading>

            {!f.issue_count ? (
              <Note>{f.note ?? "No crosswalked industry for these NIC codes."}</Note>
            ) : (
              <>
                <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 6 }}>
                  {(f.matched_industries ?? [])
                    .map((m) => `${m.name}${m.crosswalk_confidence !== "high" ? ` (${m.crosswalk_confidence})` : ""}`)
                    .join(" · ")}
                  {(f.matched_count ?? 0) > (f.matched_industries?.length ?? 0) &&
                    ` … +${(f.matched_count ?? 0) - (f.matched_industries?.length ?? 0)} more`}
                </div>
                <div style={{ overflowX: "auto", border: `1px solid ${BORDER}`, borderRadius: 10 }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 620 }}>
                    <thead>
                      <tr>
                        <th style={th}>Issue</th>
                        <th style={th}>{key === "msci" ? "Theme" : "Grouping"}</th>
                        <th style={{ ...th, textAlign: "right" }}>Prevalence</th>
                        {key === "msci" && <th style={{ ...th, textAlign: "right" }}>Avg wt</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(f.issues ?? []).map((issue, i) => (
                        <tr key={i}>
                          <td style={td}>
                            <div style={{ fontWeight: 650 }}>{issue.name}</div>
                            {issue.description && (
                              <div style={{ fontSize: 11, color: "#5d6b64", marginTop: 2, lineHeight: 1.5 }}>
                                {issue.description}
                              </div>
                            )}
                            {!!issue.disclosure_topics?.length && (
                              <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3 }}>
                                {issue.disclosure_topics.map((d) => d.name).filter(Boolean).join("; ")}
                              </div>
                            )}
                          </td>
                          <td style={{ ...td, fontSize: 11.5, color: "#5d6b64" }}>
                            {issue.framework_grouping ?? issue.pillar ?? <span style={{ color: MUTED }}>—</span>}
                          </td>
                          <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                            {issue.prevalence != null ? `${Math.round(issue.prevalence * 100)}%` : "—"}
                            <div style={{ fontSize: 10, color: MUTED }}>{issue.industry_count} ind.</div>
                          </td>
                          {key === "msci" && (
                            <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700 }}>
                              {issue.avg_weight_pct != null ? `${issue.avg_weight_pct}%` : "—"}
                              {issue.company_specific && (
                                <div style={{ fontSize: 10, fontWeight: 600, color: "#a8710a" }}>CS</div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

export default function FrameworkRunResult({
  data,
  meta,
  mode,
}: {
  data: FrameworkResultData;
  meta: { model?: string; stopReason?: string | null; seconds?: number } | null;
  mode: "run" | "preview";
}) {
  const [showRaw, setShowRaw] = useState(false);

  if (data.error) {
    return (
      <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600, color: "#c2410c" }}>{data.error}</div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: mode === "run" ? ACCENT : MUTED }}>
          {mode === "run" ? "Agent run" : "Grounding preview (no LLM)"}
        </span>
        {meta?.model && <span style={{ fontSize: 11.5, color: MUTED }}>{meta.model}</span>}
        {meta?.seconds != null && <span style={{ fontSize: 11.5, color: MUTED }}>{meta.seconds}s</span>}
        {meta?.stopReason && <span style={{ fontSize: 11.5, color: MUTED }}>stop: {meta.stopReason}</span>}
        <button
          onClick={() => setShowRaw((v) => !v)}
          style={{ marginLeft: "auto", background: "none", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "4px 10px", fontSize: 11.5, fontWeight: 600, color: "#5d6b64", cursor: "pointer" }}
        >
          {showRaw ? "Hide JSON" : "Show JSON"}
        </button>
      </div>

      {mode === "run" ? <EmittedTable data={data} /> : <PreviewTables data={data} />}

      {showRaw && (
        <pre style={{ marginTop: 12, background: "#f6f8f7", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, fontSize: 12, lineHeight: 1.55, overflow: "auto", maxHeight: 520 }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
