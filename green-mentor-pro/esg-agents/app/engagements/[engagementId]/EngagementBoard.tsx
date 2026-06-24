"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PHASE_ROWS, type ReviewItem } from "@/lib/demo/fixtures";
import { summarizeArtifact } from "@/lib/demo/phaseInputs";
import type { PhaseKey } from "@/lib/orchestrator/pipeline";
import type { PhaseStatus } from "@/lib/orchestrator/gates";
import { approvePhaseAction, requestChangesAction, decideReviewAction } from "./actions";

const ACCENT = "#1f8a5b";
const C = { bg: "#f6f8f7", card: "#fff", border: "#e3e8e5", text: "#1a2420", sub: "#5d6b64", high: "#1f8a5b", medium: "#b8860b", low: "#c2410c", blocked: "#9aa6a0" };

export interface BoardEngagement {
  id: string;
  clientName: string;
  financialYear: string;
  framework: string[];
}

export interface EngagementBoardProps {
  engagement: BoardEngagement;
  phaseStatus: Record<PhaseKey, PhaseStatus>;
  nextRunnable: PhaseKey | null;
  artifactPayloads: Partial<Record<PhaseKey, unknown>>;
  fieldReviews: ReviewItem[];
}

type Display = PhaseStatus | "ready";

function displayStatus(key: PhaseKey, status: PhaseStatus, nextRunnable: PhaseKey | null): Display {
  if ((status === "not_started" || status === "changes_requested") && key === nextRunnable) return "ready";
  return status;
}

function StatusPill({ status }: { status: Display }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    complete: { bg: "#e6f4ec", fg: C.high, label: "✓ complete" },
    approved: { bg: "#e6f4ec", fg: C.high, label: "✓ approved" },
    agent_running: { bg: "#e9eefb", fg: "#2848b8", label: "● running…" },
    awaiting_human_review: { bg: "#fdeede", fg: C.low, label: "● awaiting review" },
    changes_requested: { bg: "#fbf2dc", fg: C.medium, label: "↺ changes requested" },
    ready: { bg: "#e9eefb", fg: "#2848b8", label: "▶ ready to run" },
    failed: { bg: "#fde8de", fg: C.low, label: "✕ failed" },
    not_started: { bg: "#eef1f0", fg: C.blocked, label: "○ blocked" },
  };
  const s = map[status] ?? map.not_started;
  return <span style={{ background: s.bg, color: s.fg, fontSize: 12.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>{s.label}</span>;
}

const CONF_STYLE: Record<string, { bg: string; fg: string }> = {
  high: { bg: "#e6f4ec", fg: C.high },
  medium: { bg: "#fbf2dc", fg: C.medium },
  low: { bg: "#fde8de", fg: C.low },
};

export default function EngagementBoard({ engagement, phaseStatus, nextRunnable, artifactPayloads, fieldReviews }: EngagementBoardProps) {
  const router = useRouter();
  const [openPhase, setOpenPhase] = useState<PhaseKey | null>(null);
  const [running, setRunning] = useState<PhaseKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rowByKey = useMemo(() => Object.fromEntries(PHASE_ROWS.map((r) => [r.key, r])), []);
  const completeCount = PHASE_ROWS.filter((r) => phaseStatus[r.key] === "complete" || phaseStatus[r.key] === "approved").length;
  const openReviews = fieldReviews.filter((i) => i.status === "submitted").length;

  const runPhase = async (key: PhaseKey) => {
    const agentKey = rowByKey[key].agentKey;
    setRunning(key); setError(null); setOpenPhase(key);
    try {
      const res = await fetch(`/api/agents/${agentKey}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId: engagement.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "run failed");
      router.refresh(); // reflect the real DB state (e.g. a failed run) even on error
    } finally {
      setRunning(null);
    }
  };

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true); setError(null);
    try {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "action failed");
      else { setOpenPhase(null); router.refresh(); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
          <a href="/" style={{ fontSize: 13, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>← Engagements</a>
          <a href={`/report/${engagement.id}`} style={{ fontSize: 13, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>View report →</a>
        </div>
        <h1 style={{ fontSize: 23, margin: "6px 0 4px", fontWeight: 750 }}>{engagement.clientName} — {engagement.financialYear}</h1>
        <div style={{ color: C.sub, fontSize: 14, marginBottom: 10 }}>{completeCount}/{PHASE_ROWS.length} phases approved</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {engagement.framework.map((f) => (
            <span key={f} style={{ fontSize: 12, fontWeight: 600, color: C.sub, background: "#fff", border: `1px solid ${C.border}`, padding: "3px 9px", borderRadius: 6 }}>{f}</span>
          ))}
        </div>

        {error && (
          <div style={{ background: "#fde8de", border: `1px solid ${C.low}55`, color: C.low, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontWeight: 600, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: openPhase ? "1fr 1fr" : "1fr", gap: 20, alignItems: "start" }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 8 }}>
            <div style={{ padding: "10px 14px", fontSize: 12.5, fontWeight: 700, color: C.sub, letterSpacing: 0.4 }}>8-PHASE PIPELINE · HUMAN GATE AFTER EACH</div>
            {PHASE_ROWS.map((row) => {
              const st = displayStatus(row.key, phaseStatus[row.key], nextRunnable);
              const isOpen = openPhase === row.key;
              const isRunning = running === row.key || phaseStatus[row.key] === "agent_running";
              const dim = st === "not_started";
              return (
                <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, margin: "2px 4px", background: isOpen ? "#f0f6f3" : "transparent", border: isOpen ? `1px solid ${ACCENT}33` : "1px solid transparent", opacity: dim ? 0.62 : 1 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: st === "complete" || st === "approved" ? ACCENT : "#eef1f0", color: st === "complete" || st === "approved" ? "#fff" : C.sub, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    {st === "complete" || st === "approved" ? "✓" : row.no}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 14.5 }}>{row.label}</div>
                    <div style={{ fontSize: 12, color: C.sub, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{row.agentKey}</div>
                  </div>
                  <StatusPill status={isRunning ? "agent_running" : st} />
                  {isRunning ? (
                    <button disabled style={{ ...btn(C.sub), opacity: 0.6, cursor: "wait" }}>Running…</button>
                  ) : st === "ready" ? (
                    <button onClick={() => runPhase(row.key)} style={btn("#2848b8")}>▸ Run</button>
                  ) : st === "awaiting_human_review" ? (
                    <button onClick={() => setOpenPhase(row.key)} style={btn(ACCENT)}>Review{row.key === "data_collection" && openReviews ? ` ${openReviews}` : ""} →</button>
                  ) : st === "failed" ? (
                    <button onClick={() => runPhase(row.key)} style={btn(C.low)}>↻ Retry</button>
                  ) : (st === "complete" || st === "approved" || st === "changes_requested") ? (
                    <button onClick={() => setOpenPhase(row.key)} style={{ ...btnGhost, fontSize: 13 }}>View</button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {openPhase && (
            <DetailPanel
              phase={openPhase}
              label={rowByKey[openPhase].label}
              no={rowByKey[openPhase].no}
              status={phaseStatus[openPhase]}
              payload={artifactPayloads[openPhase]}
              fieldReviews={openPhase === "data_collection" ? fieldReviews : []}
              busy={busy}
              onClose={() => setOpenPhase(null)}
              onApprove={() => act(() => approvePhaseAction(engagement.id, openPhase))}
              onRequestChanges={() => act(() => requestChangesAction(engagement.id, openPhase))}
              onDecideRow={(id, decision) => act(() => decideReviewAction(engagement.id, id, decision))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanel(props: {
  phase: PhaseKey; label: string; no: number; status: PhaseStatus; payload: unknown;
  fieldReviews: ReviewItem[]; busy: boolean; onClose: () => void;
  onApprove: () => void; onRequestChanges: () => void; onDecideRow: (id: string, d: "approved" | "rejected") => void;
}) {
  const { phase, label, no, status, payload, fieldReviews, busy } = props;
  const bullets = payload ? summarizeArtifact(phase, payload) : [];
  const reviewable = status === "awaiting_human_review";
  const openRows = fieldReviews.filter((i) => i.status === "submitted").length;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontWeight: 750, fontSize: 16 }}>Phase {no} · {label}</div>
        <button onClick={props.onClose} style={{ ...btnGhost, fontSize: 13 }}>Close</button>
      </div>

      {phase === "data_collection" && fieldReviews.length > 0 ? (
        <>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>The data-collection agent extracted these as drafts. Verify each before approving the phase; flagged rows sort first.</div>
          {[...fieldReviews].sort((a, b) => Number(b.reviewRequired) - Number(a.reviewRequired)).map((it) => {
            const cs = CONF_STYLE[it.confidence] ?? CONF_STYLE.low;
            return (
              <div key={it.id} style={{ border: `1px solid ${C.border}`, borderLeft: it.reviewRequired ? `3px solid ${C.low}` : `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12, opacity: it.status === "rejected" ? 0.7 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div><div style={{ fontWeight: 650, fontSize: 14 }}>{it.item}</div><div style={{ fontSize: 12.5, color: C.sub }}>{it.site}</div></div>
                  <span style={{ background: cs.bg, color: cs.fg, fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6, height: "fit-content" }}>conf: {it.confidence}{it.reviewRequired ? " · flagged" : ""}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 750, margin: "8px 0 2px" }}>{Number(it.value).toLocaleString("en-IN")} <span style={{ fontSize: 14, color: C.sub, fontWeight: 600 }}>{it.unit}</span></div>
                <div style={{ fontSize: 12.5, color: C.sub, fontStyle: "italic", background: "#f6f8f7", padding: "6px 9px", borderRadius: 6, margin: "6px 0" }}>“{it.sourceSnippet}”</div>
                {it.note && <div style={{ fontSize: 12.5, color: it.reviewRequired ? C.low : C.sub, marginBottom: 8 }}>{it.note}</div>}
                {it.status === "submitted" ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button disabled={busy} onClick={() => props.onDecideRow(it.id, "approved")} style={btn(ACCENT)}>Approve</button>
                    <button disabled={busy} onClick={() => props.onDecideRow(it.id, "rejected")} style={btnGhost}>Reject</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 650, color: it.status === "approved" ? C.high : C.medium }}>{it.status === "approved" ? "✓ approved" : "↺ rejected"}</div>
                )}
              </div>
            );
          })}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>{openRows > 0 ? `Gate closed — ${openRows} row(s) awaiting your decision.` : "All rows decided — you can approve the phase."}</div>
            <button disabled={busy || openRows > 0 || !reviewable} onClick={props.onApprove} style={{ ...btn(ACCENT), opacity: busy || openRows > 0 || !reviewable ? 0.45 : 1, cursor: openRows > 0 ? "not-allowed" : "pointer" }}>Approve phase →</button>
          </div>
        </>
      ) : (
        <>
          {!payload ? (
            <div style={{ fontSize: 13, color: C.sub }}>No artifact yet — run this phase from the board.</div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                {bullets.map((b) => (
                  <div key={b.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, borderBottom: `1px solid ${C.border}`, paddingBottom: 7 }}>
                    <span style={{ color: C.sub }}>{b.label}</span><span style={{ fontWeight: 650, textAlign: "right" }}>{b.value}</span>
                  </div>
                ))}
              </div>
              <details style={{ marginBottom: 14 }}>
                <summary style={{ fontSize: 12.5, color: C.sub, cursor: "pointer", fontWeight: 600 }}>View raw artifact (JSON)</summary>
                <pre style={{ fontSize: 11, background: "#f6f8f7", border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, overflow: "auto", maxHeight: 320, marginTop: 8 }}>{JSON.stringify(payload, null, 2)}</pre>
              </details>
            </>
          )}
          {reviewable && (
            <div style={{ paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
              <button disabled={busy} onClick={props.onApprove} style={btn(ACCENT)}>Approve phase →</button>
              <button disabled={busy} onClick={props.onRequestChanges} style={btnGhost}>Request changes</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return { background: color, color: "#fff", border: "none", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 650, cursor: "pointer", whiteSpace: "nowrap" };
}
const btnGhost: React.CSSProperties = { background: "#fff", color: "#5d6b64", border: "1px solid #e3e8e5", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
