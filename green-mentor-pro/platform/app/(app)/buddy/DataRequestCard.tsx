"use client";

import { useState } from "react";

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";

/** Structured shape produced by the draftDataRequest tool (lib/ai/tools.ts). */
export interface DataRequestData {
  request_id?: string;
  metric?: string;
  metric_code?: string | null;
  unit?: string;
  site?: string;
  period?: string;
  granularity?: string;
  data_owner?: string;
  disclosure_codes?: string[];
  evidence_required?: string[];
  deadline?: string | null;
  channel?: string;
  status?: string;
}

/** Renders the draftDataRequest tool's structured input/output as an editable card. */
export default function DataRequestCard({ data, loading }: { data: DataRequestData; loading?: boolean }) {
  const [sent, setSent] = useState(false);
  const d = data ?? {};

  const Field = ({ label, value }: { label: string; value?: React.ReactNode }) =>
    value == null || value === "" ? null : (
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: "#8a958f", textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 13.5, color: "#1a2420", marginTop: 1 }}>{value}</div>
      </div>
    );

  return (
    <div style={{ width: "100%", maxWidth: 440, background: "#fff", border: `1px solid ${BORDER}`, borderLeft: `3px solid ${ACCENT}`, borderRadius: 12, padding: 16, opacity: loading ? 0.7 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, color: ACCENT, textTransform: "uppercase" }}>
            Data Request {loading ? "· drafting…" : `· ${d.status ?? "draft"}`}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15.5, marginTop: 2 }}>{d.metric ?? "…"}</div>
          {d.metric_code && <div style={{ fontSize: 11.5, color: "#8a958f", fontFamily: "ui-monospace, Menlo, monospace" }}>{d.metric_code}</div>}
        </div>
        {d.unit && (
          <span style={{ background: "#e9f2ec", color: ACCENT, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 7, whiteSpace: "nowrap" }}>{d.unit}</span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "14px 0" }}>
        <Field label="Site" value={d.site} />
        <Field label="Period" value={d.period} />
        <Field label="Data owner" value={d.data_owner} />
        <Field label="Granularity" value={d.granularity?.replace(/_/g, " ")} />
        <Field label="Channel" value={d.channel} />
        <Field label="Deadline" value={d.deadline ?? undefined} />
      </div>

      {!!d.disclosure_codes?.length && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: "#8a958f", textTransform: "uppercase", marginBottom: 4 }}>Feeds disclosures</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {d.disclosure_codes.map((c) => (
              <span key={c} style={{ fontSize: 11.5, fontWeight: 600, color: "#5d6b64", background: "#f0f6f3", border: `1px solid ${BORDER}`, padding: "2px 8px", borderRadius: 6 }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      {!!d.evidence_required?.length && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: "#8a958f", textTransform: "uppercase", marginBottom: 4 }}>Evidence</div>
          <div style={{ fontSize: 12.5, color: "#5d6b64" }}>{d.evidence_required.join(" · ")}</div>
        </div>
      )}

      {!loading && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
          <button
            onClick={() => setSent(true)}
            disabled={sent}
            style={{ background: sent ? "#e9f2ec" : ACCENT, color: sent ? ACCENT : "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 650, cursor: sent ? "default" : "pointer" }}
          >
            {sent ? "✓ Queued to portal" : "Send to portal"}
          </button>
          {d.request_id && <span style={{ fontSize: 11.5, color: "#9aa6a0", fontFamily: "ui-monospace, Menlo, monospace" }}>{d.request_id}</span>}
        </div>
      )}
    </div>
  );
}
