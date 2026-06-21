"use client";

import { useMemo, useState } from "react";
import type { PhaseKey } from "@/lib/orchestrator/pipeline";
import {
  PHASE_ROWS,
  DEMO_ENGAGEMENT,
  INITIAL_PHASE_STATUS,
  INITIAL_REVIEW_ITEMS,
  type DemoPhaseStatus,
  type ReviewItem,
  type Confidence,
} from "@/lib/demo/fixtures";

const ACCENT = "#1f8a5b";
const C = {
  bg: "#f6f8f7",
  card: "#ffffff",
  border: "#e3e8e5",
  text: "#1a2420",
  sub: "#5d6b64",
  high: "#1f8a5b",
  medium: "#b8860b",
  low: "#c2410c",
  blocked: "#9aa6a0",
};

const CONF_STYLE: Record<Confidence, { bg: string; fg: string; label: string }> = {
  high: { bg: "#e6f4ec", fg: C.high, label: "high" },
  medium: { bg: "#fbf2dc", fg: C.medium, label: "medium" },
  low: { bg: "#fde8de", fg: C.low, label: "low" },
};

function StatusPill({ status }: { status: DemoPhaseStatus | "ready" }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    complete: { bg: "#e6f4ec", fg: C.high, label: "✓ complete" },
    awaiting_human_review: { bg: "#fdeede", fg: C.low, label: "● awaiting review" },
    changes_requested: { bg: "#fbf2dc", fg: C.medium, label: "↺ changes requested" },
    ready: { bg: "#e9eefb", fg: "#2848b8", label: "▶ ready to run" },
    not_started: { bg: "#eef1f0", fg: C.blocked, label: "○ blocked" },
  };
  const s = map[status] ?? map.not_started;
  return (
    <span style={{ background: s.bg, color: s.fg, fontSize: 12.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

export default function PipelineBoard() {
  const [phaseStatus, setPhaseStatus] = useState<Record<PhaseKey, DemoPhaseStatus>>(INITIAL_PHASE_STATUS);
  const [items, setItems] = useState<ReviewItem[]>(INITIAL_REVIEW_ITEMS);
  const [openPhase, setOpenPhase] = useState<PhaseKey | null>("data_collection");

  // Linear DAG: the next runnable phase is the first not_started/changes_requested
  // whose predecessor is complete.
  const nextRunnable = useMemo<PhaseKey | null>(() => {
    for (let i = 0; i < PHASE_ROWS.length; i++) {
      const row = PHASE_ROWS[i];
      const st = phaseStatus[row.key];
      const prevComplete = i === 0 || phaseStatus[PHASE_ROWS[i - 1].key] === "complete";
      if ((st === "not_started" || st === "changes_requested") && prevComplete) return row.key;
    }
    return null;
  }, [phaseStatus]);

  const open = items.filter((i) => i.status === "submitted").length;
  const rejected = items.filter((i) => i.status === "rejected").length;
  const gateClear = open === 0 && rejected === 0;

  const decide = (id: string, status: "approved" | "rejected") =>
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status, feedback: status === "rejected" ? "Please confirm the figure and attach the source bill." : undefined }
          : i,
      ),
    );

  const approvePhase = () => {
    setPhaseStatus((p) => ({ ...p, data_collection: "complete" }));
    setOpenPhase(null);
  };

  const requestChanges = () => {
    setPhaseStatus((p) => ({ ...p, data_collection: "changes_requested" }));
  };

  const rerunAgent = () => {
    // Re-running injects reviewer feedback; the agent re-submits the corrected items.
    setItems((prev) => prev.map((i) => ({ ...i, status: "submitted", feedback: undefined })));
    setPhaseStatus((p) => ({ ...p, data_collection: "awaiting_human_review" }));
  };

  const displayStatus = (key: PhaseKey): DemoPhaseStatus | "ready" =>
    phaseStatus[key] === "not_started" && key === nextRunnable ? "ready" : phaseStatus[key];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 64px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: ACCENT }} />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: ACCENT }}>GREENMENTOR · ESG-AGENTS</span>
        </div>
        <h1 style={{ fontSize: 24, margin: "6px 0 4px", fontWeight: 750 }}>{DEMO_ENGAGEMENT.name}</h1>
        <div style={{ color: C.sub, fontSize: 14, marginBottom: 10 }}>
          {DEMO_ENGAGEMENT.client} · {DEMO_ENGAGEMENT.financialYear}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {DEMO_ENGAGEMENT.frameworks.map((f) => (
            <span key={f} style={{ fontSize: 12, fontWeight: 600, color: C.sub, background: "#fff", border: `1px solid ${C.border}`, padding: "3px 9px", borderRadius: 6 }}>
              {f}
            </span>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: openPhase ? "1fr 1fr" : "1fr", gap: 20, alignItems: "start" }}>
          {/* pipeline board */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 8 }}>
            <div style={{ padding: "10px 14px", fontSize: 12.5, fontWeight: 700, color: C.sub, letterSpacing: 0.4 }}>
              8-PHASE PIPELINE · HUMAN GATE AFTER EACH
            </div>
            {PHASE_ROWS.map((row) => {
              const st = displayStatus(row.key);
              const dim = st === "not_started";
              const isOpen = openPhase === row.key;
              return (
                <div
                  key={row.key}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                    borderRadius: 10, margin: "2px 4px",
                    background: isOpen ? "#f0f6f3" : "transparent",
                    border: isOpen ? `1px solid ${ACCENT}33` : "1px solid transparent",
                    opacity: dim ? 0.62 : 1,
                  }}
                >
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: st === "complete" ? ACCENT : "#eef1f0", color: st === "complete" ? "#fff" : C.sub, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {row.no}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 14.5 }}>{row.label}</div>
                    <div style={{ fontSize: 12, color: C.sub, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{row.agentKey}</div>
                  </div>
                  <StatusPill status={st} />
                  {row.key === "data_collection" && phaseStatus.data_collection === "awaiting_human_review" && (
                    <button onClick={() => setOpenPhase("data_collection")} style={btn(ACCENT)}>
                      Review {open} →
                    </button>
                  )}
                  {st === "ready" && (
                    <button style={{ ...btn("#2848b8"), opacity: 0.9 }}>Run agent</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* review panel */}
          {openPhase === "data_collection" && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <div style={{ fontWeight: 750, fontSize: 16 }}>Phase 4 · Collection review</div>
                <button onClick={() => setOpenPhase(null)} style={{ ...btnGhost, fontSize: 13 }}>Close</button>
              </div>
              <div style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>
                The <code>data-collection</code> agent extracted these as <strong>drafts</strong>. You verify before Phase 5.
                Low-confidence / outlier items are flagged and sorted first.
              </div>

              {[...items].sort((a, b) => Number(b.reviewRequired) - Number(a.reviewRequired)).map((it) => {
                const cs = CONF_STYLE[it.confidence];
                return (
                  <div key={it.id} style={{ border: `1px solid ${C.border}`, borderLeft: it.reviewRequired ? `3px solid ${C.low}` : `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12, opacity: it.status === "rejected" ? 0.75 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 650, fontSize: 14 }}>{it.item}</div>
                        <div style={{ fontSize: 12.5, color: C.sub }}>{it.site}</div>
                      </div>
                      <span style={{ background: cs.bg, color: cs.fg, fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6, height: "fit-content" }}>
                        conf: {cs.label}{it.reviewRequired ? " · flagged" : ""}
                      </span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 750, margin: "8px 0 2px" }}>
                      {it.value.toLocaleString("en-IN")} <span style={{ fontSize: 14, color: C.sub, fontWeight: 600 }}>{it.unit}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.sub, fontStyle: "italic", background: "#f6f8f7", padding: "6px 9px", borderRadius: 6, margin: "6px 0" }}>
                      “{it.sourceSnippet}”
                    </div>
                    {it.note && <div style={{ fontSize: 12.5, color: it.reviewRequired ? C.low : C.sub, marginBottom: 8 }}>{it.note}</div>}

                    {it.status === "submitted" ? (
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <button onClick={() => decide(it.id, "approved")} style={btn(ACCENT)}>Approve</button>
                        <button onClick={() => decide(it.id, "rejected")} style={btnGhost}>Request changes</button>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, fontWeight: 650, color: it.status === "approved" ? C.high : C.medium }}>
                        {it.status === "approved" ? "✓ approved" : "↺ changes requested"}
                        {it.feedback && <div style={{ fontWeight: 400, color: C.sub, fontSize: 12.5, marginTop: 2 }}>{it.feedback}</div>}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* gate footer */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>
                  {open > 0
                    ? `Gate closed — ${open} item${open > 1 ? "s" : ""} awaiting your decision.`
                    : rejected > 0
                      ? `${rejected} item${rejected > 1 ? "s" : ""} sent back. Re-run the agent with your feedback.`
                      : "All items approved — gate is clear."}
                </div>
                {phaseStatus.data_collection === "changes_requested" ? (
                  <button onClick={rerunAgent} style={btn("#b8860b")}>↺ Re-run agent with feedback</button>
                ) : rejected > 0 && open === 0 ? (
                  <button onClick={requestChanges} style={btn("#b8860b")}>Send phase back for changes</button>
                ) : (
                  <button onClick={approvePhase} disabled={!gateClear} style={{ ...btn(ACCENT), opacity: gateClear ? 1 : 0.45, cursor: gateClear ? "pointer" : "not-allowed" }}>
                    Approve phase → unlock Validation
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 22, fontSize: 12, color: C.blocked }}>
          Demo · interactive client-side state over the sample engagement. The runtime, agent packages, schema, and
          channel adapters are real; this screen is the M1 review console.
        </div>
      </div>
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return { background: color, color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 650, cursor: "pointer", whiteSpace: "nowrap" };
}
const btnGhost: React.CSSProperties = {
  background: "#fff", color: "#5d6b64", border: "1px solid #e3e8e5", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
};
