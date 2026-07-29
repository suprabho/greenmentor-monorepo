"use client";

import { useEffect, useState } from "react";

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";

/** Structured shape produced by the draftDataRequest tool (@gm/agents buddyTools.ts). */
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
  status?: string;
  /** Subject line for the drafted message. */
  subject?: string;
  /** The request as plain text, ready to paste into an email or WhatsApp. */
  message?: string;
}

/**
 * Renders the draftDataRequest tool's result: the structured fields as context, and
 * the drafted request as editable plain text the user copies out. There is no
 * collection portal yet — copying the message IS how the request gets sent.
 */
export default function DataRequestCard({ data, loading }: { data: DataRequestData; loading?: boolean }) {
  const [copied, setCopied] = useState(false);
  const d = data ?? {};
  const [draft, setDraft] = useState(d.message ?? "");

  // The tool streams: adopt the message once it arrives, but keep the user's edits after.
  useEffect(() => {
    setDraft((prev) => (prev ? prev : (d.message ?? "")));
  }, [d.message]);

  const copy = async () => {
    const text = d.subject ? `${d.subject}\n\n${draft}` : draft;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the textarea is selectable as a fallback */
    }
  };

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

      {!loading && !!d.message && (
        <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: "#8a958f", textTransform: "uppercase", marginBottom: 6 }}>
            Message to send
          </div>
          {d.subject && (
            <div style={{ fontSize: 12.5, fontWeight: 650, color: "#1a2420", marginBottom: 6 }}>{d.subject}</div>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            spellCheck={false}
            style={{
              width: "100%",
              resize: "vertical",
              background: "#f7faf8",
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 13,
              lineHeight: 1.55,
              color: "#1a2420",
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
            <button
              onClick={copy}
              style={{ background: copied ? "#e9f2ec" : ACCENT, color: copied ? ACCENT : "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 650, cursor: "pointer" }}
            >
              {copied ? "✓ Copied" : "Copy message"}
            </button>
            <span style={{ fontSize: 11.5, color: "#9aa6a0" }}>Edit as needed, then paste into email or WhatsApp.</span>
          </div>
        </div>
      )}
    </div>
  );
}
