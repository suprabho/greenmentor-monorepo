"use client";

import type { ReactNode } from "react";

/**
 * Result cards for the standalone Chat skills (runScopingSkill / extractBillSkill /
 * understandEpdSkill in @gm/orchestrator). Each skill's tool output renders here,
 * keyed by the `tool-<name>` message part in MessageList. Styled to match
 * DataRequestCard (inline styles, green left-rail) so the transcript reads as one set.
 */

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";
const MUTED = "#8a958f";
const INK = "#1a2420";

type Confidence = "high" | "medium" | "low";
const CONF_BG: Record<Confidence, string> = { high: "#e9f2ec", medium: "#fdf3e3", low: "#fdeaea" };
const CONF_FG: Record<Confidence, string> = { high: ACCENT, medium: "#a8710a", low: "#b23b3b" };

function Shell({ label, title, right, loading, children }: {
  label: string; title?: ReactNode; right?: ReactNode; loading?: boolean; children?: ReactNode;
}) {
  return (
    <div style={{ width: "100%", maxWidth: 460, background: "#fff", border: `1px solid ${BORDER}`, borderLeft: `3px solid ${ACCENT}`, borderRadius: 12, padding: 16, opacity: loading ? 0.7 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, color: ACCENT, textTransform: "uppercase" }}>{label}</div>
          {title != null && <div style={{ fontWeight: 700, fontSize: 15.5, marginTop: 2, color: INK }}>{title}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function ConfBadge({ level }: { level?: string }) {
  const l = (level as Confidence) in CONF_BG ? (level as Confidence) : undefined;
  if (!l) return null;
  return <span style={{ background: CONF_BG[l], color: CONF_FG[l], fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 7, textTransform: "capitalize", whiteSpace: "nowrap" }}>{l} confidence</span>;
}

function Heading({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", margin: "14px 0 5px" }}>{children}</div>;
}

function ErrorNote({ error }: { error: string }) {
  return <div style={{ fontSize: 12.5, color: "#b23b3b", background: "#fdeaea", borderRadius: 8, padding: "8px 10px", marginTop: 4 }}>{error}</div>;
}

function Chips({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {items.map((c, i) => (
        <span key={i} style={{ fontSize: 11.5, fontWeight: 600, color: "#5d6b64", background: "#f0f6f3", border: `1px solid ${BORDER}`, padding: "2px 8px", borderRadius: 6 }}>{c}</span>
      ))}
    </div>
  );
}

/* ---------------------------------- Scoping --------------------------------- */

interface FrameworkInScope { framework?: string; rationale?: string; mandatory?: boolean }
interface ScopeData {
  error?: string;
  scope_charter?: { objectives?: string[]; frameworks_in_scope?: FrameworkInScope[]; reporting_boundary?: string; out_of_scope?: string[] };
  project_plan?: { phase_no?: number; phase?: string; milestone?: string; target_date?: string | null }[];
  open_questions?: string[];
}

export function ScopeResultCard({ data, loading }: { data: ScopeData; loading?: boolean }) {
  if (loading) return <Shell label="Scope · scoping…" title="…" loading />;
  const d = data ?? {};
  if (d.error) return <Shell label="Scope"><ErrorNote error={d.error} /></Shell>;
  const c = d.scope_charter ?? {};
  const frameworks = c.frameworks_in_scope ?? [];

  return (
    <Shell label="Scope charter" title="Engagement scope">
      {!!c.objectives?.length && (
        <>
          <Heading>Objectives</Heading>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: INK }}>
            {c.objectives.map((o, i) => <li key={i} style={{ marginBottom: 2 }}>{o}</li>)}
          </ul>
        </>
      )}
      {!!frameworks.length && (
        <>
          <Heading>Frameworks in scope</Heading>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {frameworks.map((f, i) => (
              <div key={i} style={{ fontSize: 12.5, color: INK }}>
                <span style={{ fontWeight: 700 }}>{f.framework}</span>
                {f.mandatory && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: "#b23b3b", background: "#fdeaea", padding: "1px 6px", borderRadius: 5 }}>MANDATORY</span>}
                {f.rationale && <div style={{ color: "#5d6b64", marginTop: 1 }}>{f.rationale}</div>}
              </div>
            ))}
          </div>
        </>
      )}
      {c.reporting_boundary && (<><Heading>Reporting boundary</Heading><div style={{ fontSize: 12.5, color: INK }}>{c.reporting_boundary}</div></>)}
      {!!c.out_of_scope?.length && (<><Heading>Out of scope</Heading><Chips items={c.out_of_scope} /></>)}
      {!!d.project_plan?.length && (
        <>
          <Heading>Project plan</Heading>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {d.project_plan.map((p, i) => (
              <div key={i} style={{ fontSize: 12.5, color: INK, display: "flex", gap: 8 }}>
                <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>{p.phase_no ?? i + 1}.</span>
                <span style={{ flex: 1 }}>{p.phase}{p.milestone ? ` — ${p.milestone}` : ""}</span>
                {p.target_date && <span style={{ color: MUTED, whiteSpace: "nowrap" }}>{p.target_date}</span>}
              </div>
            ))}
          </div>
        </>
      )}
      {!!d.open_questions?.length && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
          <Heading>Open questions</Heading>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#a8710a" }}>
            {d.open_questions.map((q, i) => <li key={i} style={{ marginBottom: 2 }}>{q}</li>)}
          </ul>
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------ Bill extraction ----------------------------- */

interface Prov { value?: string | number | boolean | null }
interface DatasetRow {
  metric_code?: string; site_id?: string;
  reported_value?: Prov; reported_unit?: Prov;
  overall_confidence?: string; is_outlier?: boolean;
}
interface ExtractData {
  error?: string;
  document_type_detected?: string;
  dataset_rows?: DatasetRow[];
  coverage_pct?: number;
  run_confidence?: string;
}

export function ExtractedDataCard({ data, loading }: { data: ExtractData; loading?: boolean }) {
  if (loading) return <Shell label="Extraction · reading document…" title="…" loading />;
  const d = data ?? {};
  if (d.error) return <Shell label="Extraction"><ErrorNote error={d.error} /></Shell>;
  const rows = d.dataset_rows ?? [];

  return (
    <Shell
      label={`Extracted data${d.document_type_detected ? ` · ${d.document_type_detected.replace(/_/g, " ")}` : ""}`}
      title={`${rows.length} row${rows.length === 1 ? "" : "s"}`}
      right={<ConfBadge level={d.run_confidence} />}
    >
      {rows.length === 0 ? (
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 10 }}>No structured rows could be extracted from this document.</div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : "none", paddingBottom: 6 }}>
              <span style={{ fontSize: 11.5, color: MUTED, fontFamily: "ui-monospace, Menlo, monospace", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.metric_code}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: INK, whiteSpace: "nowrap" }}>
                {String(r.reported_value?.value ?? "—")}{" "}
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#5d6b64" }}>{String(r.reported_unit?.value ?? "")}</span>
              </span>
              {r.is_outlier && <span title="flagged outlier" style={{ fontSize: 11 }}>⚠</span>}
              <span style={{ width: 8, height: 8, borderRadius: 8, background: CONF_FG[(r.overall_confidence as Confidence) in CONF_FG ? (r.overall_confidence as Confidence) : "low"] }} />
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: MUTED }}>
          {typeof d.coverage_pct === "number" && d.coverage_pct > 0 ? `Coverage ${Math.round(d.coverage_pct)}% · ` : ""}
          each dot shows that row&apos;s confidence
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------- EPD summary -------------------------------- */

interface GwpModule { module?: string; gwp_fossil?: number | null; gwp_biogenic?: number | null; gwp_total?: number | null; unit?: string }
interface EpdData {
  error?: string;
  product?: string; manufacturer?: string | null; declared_unit?: string;
  programme_operator?: string | null; registration_number?: string | null; pcr?: string | null;
  standards?: string[]; epd_scope?: string | null;
  gwp_by_module?: GwpModule[];
  validity?: { issued?: string | null; valid_until?: string | null };
  verification?: { independent?: boolean | null; verifier?: string | null };
  key_findings?: string[];
  confidence?: string;
}

const num = (n?: number | null) => (typeof n === "number" ? n.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "—");

export function EpdSummaryCard({ data, loading }: { data: EpdData; loading?: boolean }) {
  if (loading) return <Shell label="EPD · reading declaration…" title="…" loading />;
  const d = data ?? {};
  if (d.error) return <Shell label="EPD"><ErrorNote error={d.error} /></Shell>;
  const modules = d.gwp_by_module ?? [];

  return (
    <Shell
      label={`EPD${d.epd_scope ? ` · ${d.epd_scope.replace(/-/g, " ")}` : ""}`}
      title={d.product ?? "Environmental Product Declaration"}
      right={<ConfBadge level={d.confidence} />}
    >
      {(d.manufacturer || d.declared_unit) && (
        <div style={{ fontSize: 12.5, color: "#5d6b64", marginTop: 2 }}>
          {d.manufacturer}{d.manufacturer && d.declared_unit ? " · " : ""}
          {d.declared_unit && <span>per <span style={{ fontWeight: 700, color: INK }}>{d.declared_unit}</span></span>}
        </div>
      )}

      {!!modules.length && (
        <>
          <Heading>GWP by life-cycle module</Heading>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase" }}>
              <span>Module</span><span style={{ textAlign: "right" }}>Fossil</span><span style={{ textAlign: "right" }}>Biogenic</span><span style={{ textAlign: "right" }}>Total</span>
            </div>
            {modules.map((m, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, fontSize: 12.5, color: INK, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ fontWeight: 700 }}>{m.module}</span>
                <span style={{ textAlign: "right" }}>{num(m.gwp_fossil)}</span>
                <span style={{ textAlign: "right" }}>{num(m.gwp_biogenic)}</span>
                <span style={{ textAlign: "right", fontWeight: 700 }}>{num(m.gwp_total)}</span>
              </div>
            ))}
          </div>
          {modules[0]?.unit && <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Values in {modules[0].unit} per declared unit.</div>}
        </>
      )}

      {!!d.standards?.length && (<><Heading>Standards</Heading><Chips items={d.standards} /></>)}
      {(d.pcr || d.programme_operator || d.registration_number) && (
        <>
          <Heading>Programme</Heading>
          <div style={{ fontSize: 12.5, color: INK }}>
            {[d.programme_operator, d.pcr, d.registration_number].filter(Boolean).join(" · ")}
          </div>
        </>
      )}
      {(d.validity?.valid_until || d.validity?.issued || d.verification?.verifier || d.verification?.independent != null) && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: MUTED, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {d.validity?.valid_until && <span>Valid until {d.validity.valid_until}</span>}
          {d.verification?.independent != null && <span>{d.verification.independent ? "✓ Independently verified" : "Not independently verified"}{d.verification.verifier ? ` (${d.verification.verifier})` : ""}</span>}
        </div>
      )}
      {!!d.key_findings?.length && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
          <Heading>Notes</Heading>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#5d6b64" }}>
            {d.key_findings.map((k, i) => <li key={i} style={{ marginBottom: 2 }}>{k}</li>)}
          </ul>
        </div>
      )}
    </Shell>
  );
}
