"use client";

import { C, ACCENT, CONF_STYLE } from "./theme";
import { Card, SectionLabel, Chip, ConfidenceBadge, StatusBadge, ProgressBar, BarChart, Donut, toneColor, fmt, Empty, arr } from "./primitives";
import type { DataCollectionArtifact, DatasetRow } from "./types";

const pv = (f?: { value?: unknown }) => (f ? f.value : undefined);

function Row({ r }: { r: DatasetRow }) {
  const flagged = r.is_outlier || r.overall_confidence === "low";
  const flags = [r.is_outlier && "outlier", r.unit_mismatch && "unit mismatch", r.period_mismatch && "period mismatch"].filter(Boolean) as string[];
  const val = pv(r.reported_value);
  const unit = pv(r.reported_unit);
  const snippet = r.reported_value?.source_snippet;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderLeft: flagged ? `3px solid ${C.low}` : `1px solid ${C.border}`, borderRadius: 10, padding: 13, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 650, fontSize: 13.5, fontFamily: "ui-monospace, Menlo, monospace" }}>{r.metric_code ?? "—"}</div>
          <div style={{ fontSize: 12, color: C.sub }}>
            {r.site_id ?? "—"}
            {r.disclosure_code ? ` · ${r.disclosure_code}` : ""}
          </div>
        </div>
        <ConfidenceBadge level={r.overall_confidence} flagged={flagged} />
      </div>
      <div style={{ fontSize: 21, fontWeight: 750, margin: "8px 0 2px" }}>
        {typeof val === "number" ? val.toLocaleString("en-IN") : String(val ?? "—")} <span style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>{String(unit ?? "")}</span>
        {r.normalized_value != null && r.normalized_unit && (
          <span style={{ fontSize: 12, color: C.sub, fontWeight: 500 }}>
            {" "}
            ≈ {fmt(r.normalized_value)} {r.normalized_unit}
          </span>
        )}
      </div>
      {snippet && (
        <div style={{ fontSize: 12.5, color: C.sub, fontStyle: "italic", background: "#f6f8f7", padding: "6px 9px", borderRadius: 6, margin: "6px 0" }}>“{snippet}”</div>
      )}
      {r.outlier_note && <div style={{ fontSize: 12.5, color: C.low, marginBottom: 4 }}>{r.outlier_note}</div>}
      {!!flags.length && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
          {flags.map((f) => (
            <span key={f} style={{ fontSize: 11, fontWeight: 700, color: C.low, background: "#fde8de", padding: "2px 7px", borderRadius: 5 }}>
              ⚠ {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DataCollectionStage({ o }: { o: Record<string, unknown> }) {
  const a = o as DataCollectionArtifact;
  const rows = arr<DatasetRow>(a.dataset_rows);
  const fulfillment = arr<{ request_id?: string; status?: string; reason?: string | null }>(a.fulfillment);
  const qualitative = arr<{ summary?: string; evidence_ref?: string; disclosure_code?: string | null }>(a.qualitative_capture);
  const followups = arr<{ data_owner?: string; channel?: string; subject?: string; message?: string }>(a.followups);

  const confDist = (["high", "medium", "low"] as const)
    .map((lvl) => ({ label: lvl, value: rows.filter((r) => r.overall_confidence === lvl).length, color: CONF_STYLE[lvl].fg }))
    .filter((d) => d.value > 0);

  const fulfillDist = [...new Map(fulfillment.map((f) => [f.status, 0])).keys()].map((status) => ({
    label: String(status ?? "—"),
    value: fulfillment.filter((f) => f.status === status).length,
    color: toneColor(status ?? undefined),
  }));

  const sorted = [...rows].sort((x, y) => Number(y.is_outlier || y.overall_confidence === "low") - Number(x.is_outlier || x.overall_confidence === "low"));

  return (
    <div>
      <Card
        title="Collected dataset"
        accent={ACCENT}
        right={
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {a.document_type_detected && <Chip>{a.document_type_detected.replace(/_/g, " ")}</Chip>}
            {a.run_confidence && <ConfidenceBadge level={a.run_confidence} />}
          </span>
        }
      >
        <SectionLabel>Coverage</SectionLabel>
        <ProgressBar value={typeof a.coverage_pct === "number" ? a.coverage_pct : null} />
        {(confDist.length || fulfillDist.length) > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }}>
            {!!confDist.length && (
              <div>
                <SectionLabel>Row confidence</SectionLabel>
                <BarChart data={confDist} />
              </div>
            )}
            {!!fulfillDist.length && (
              <div>
                <SectionLabel>Fulfillment</SectionLabel>
                <Donut segments={fulfillDist} centerLabel="requests" />
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title={`Extracted rows · ${rows.length}`}>
        {sorted.length ? sorted.map((r, i) => <Row key={i} r={r} />) : <Empty>No dataset rows.</Empty>}
      </Card>

      {!!qualitative.length && (
        <Card title="Qualitative capture">
          {qualitative.map((q, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 8 }}>
              {q.disclosure_code && (
                <span style={{ marginRight: 8 }}>
                  <Chip>{q.disclosure_code}</Chip>
                </span>
              )}
              <span style={{ fontSize: 13, color: C.text }}>{q.summary ?? "—"}</span>
              {q.evidence_ref && <div style={{ fontSize: 11.5, color: "#8a958f", marginTop: 2 }}>ref: {q.evidence_ref}</div>}
            </div>
          ))}
        </Card>
      )}

      {!!followups.length && (
        <Card title="Drafted follow-ups">
          {followups.map((f, i) => (
            <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 8, background: "#f6f8f7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{f.subject ?? "Follow-up"}</strong>
                <StatusBadge value={f.channel} />
              </div>
              <div style={{ fontSize: 12, color: C.sub, margin: "2px 0 4px" }}>to {f.data_owner ?? "—"}</div>
              <div style={{ fontSize: 12.5, color: C.text }}>{f.message ?? ""}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
