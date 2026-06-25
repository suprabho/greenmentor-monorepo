"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { PHASE_ROWS, type ReviewItem, type OpenQuestionReview } from "@/lib/demo/fixtures";
import type { PhaseKey } from "@/lib/orchestrator/pipeline";
import type { PhaseStatus } from "@/lib/orchestrator/gates";
import {
  approvePhaseAction, requestChangesAction, decideReviewAction,
  answerOpenQuestionAction, applyAnswersAndRerunKickoffAction, setDataSourceModeAction,
  cancelRunAction,
} from "./actions";
import { C, ACCENT, CONF_STYLE, btn, btnGhost } from "@/app/stages/theme";
import { StageView } from "@/app/stages/StageView";

export interface BoardEngagement {
  id: string;
  clientName: string;
  financialYear: string;
  framework: string[];
}

export type DataSourceMode = "demo" | "user";
export interface DocumentSummary {
  name: string;
  parseStatus: string;
  pageCount: number | null;
}

export interface EngagementBoardProps {
  engagement: BoardEngagement;
  phaseStatus: Record<PhaseKey, PhaseStatus>;
  nextRunnable: PhaseKey | null;
  artifactPayloads: Partial<Record<PhaseKey, unknown>>;
  fieldReviews: ReviewItem[];
  openQuestionReviews: OpenQuestionReview[];
  dataSourceMode: DataSourceMode;
  documents: DocumentSummary[];
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

export default function EngagementBoard({ engagement, phaseStatus, nextRunnable, artifactPayloads, fieldReviews, openQuestionReviews, dataSourceMode, documents }: EngagementBoardProps) {
  const router = useRouter();
  const [openPhase, setOpenPhase] = useState<PhaseKey | null>(null);
  const [running, setRunning] = useState<PhaseKey | null>(null);
  const [stopping, setStopping] = useState<PhaseKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runAbortRef = useRef<AbortController | null>(null);

  const rowByKey = useMemo(() => Object.fromEntries(PHASE_ROWS.map((r) => [r.key, r])), []);
  const completeCount = PHASE_ROWS.filter((r) => phaseStatus[r.key] === "complete" || phaseStatus[r.key] === "approved").length;
  const openReviews = fieldReviews.filter((i) => i.status === "submitted").length;
  const openQuestions = openQuestionReviews.filter((q) => q.status === "submitted").length;

  const runPhase = async (key: PhaseKey) => {
    const agentKey = rowByKey[key].agentKey;
    const controller = new AbortController();
    runAbortRef.current = controller;
    setRunning(key); setError(null); setOpenPhase(key);
    try {
      const res = await fetch(`/api/agents/${agentKey}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId: engagement.id }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      // A user-initiated Stop aborts the request — that's expected, not an error.
      if (e instanceof DOMException && e.name === "AbortError") router.refresh();
      else {
        setError(e instanceof Error ? e.message : "run failed");
        router.refresh(); // reflect the real DB state (e.g. a failed run) even on error
      }
    } finally {
      if (runAbortRef.current === controller) runAbortRef.current = null;
      setRunning(null);
    }
  };

  // Stop a phase that's mid-run (or stuck in agent_running after a reload). Aborts the
  // in-flight request locally so the spinner clears at once, then flips the persisted
  // phase off agent_running via the server action so it becomes runnable again.
  const stopPhase = async (key: PhaseKey) => {
    setStopping(key); setError(null);
    runAbortRef.current?.abort();
    try {
      const r = await cancelRunAction(engagement.id, key);
      if (!r.ok) setError(r.error ?? "Couldn't stop the run.");
      else {
        setRunning((cur) => (cur === key ? null : cur));
        router.refresh();
      }
    } finally {
      setStopping(null);
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

  // Like `act`, but keeps the detail panel open (answering a question / re-running a
  // phase should reveal the updated state in place, not collapse the panel).
  const actKeepOpen = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true); setError(null);
    try {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "action failed");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "28px 32px 64px" }}>
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

        <DataSourceControl
          engagementId={engagement.id}
          mode={dataSourceMode}
          documents={documents}
          busy={busy}
          onSetMode={(m) => act(() => setDataSourceModeAction(engagement.id, m))}
          onError={setError}
          onUploaded={() => router.refresh()}
        />

        {error && (
          <div style={{ background: "#fde8de", border: `1px solid ${C.low}55`, color: C.low, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontWeight: 600, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: openPhase ? "1fr 1fr" : "1fr", gap: 20, alignItems: "start" }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 8, minWidth: 0 }}>
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
                    <button
                      onClick={() => stopPhase(row.key)}
                      disabled={stopping === row.key}
                      title="Stop this run and free the phase to re-run"
                      style={{ ...btnGhost, color: C.low, borderColor: `${C.low}55`, opacity: stopping === row.key ? 0.6 : 1, cursor: stopping === row.key ? "wait" : "pointer" }}
                    >
                      {stopping === row.key ? "Stopping…" : "■ Stop"}
                    </button>
                  ) : st === "ready" ? (
                    <button onClick={() => runPhase(row.key)} style={btn("#2848b8")}>▸ Run</button>
                  ) : st === "awaiting_human_review" ? (
                    <button onClick={() => setOpenPhase(row.key)} style={btn(ACCENT)}>Review{row.key === "data_collection" && openReviews ? ` ${openReviews}` : row.key === "kickoff" && openQuestions ? ` ${openQuestions}` : ""} →</button>
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
              openQuestions={openPhase === "kickoff" ? openQuestionReviews : []}
              busy={busy}
              onClose={() => setOpenPhase(null)}
              onApprove={() => act(() => approvePhaseAction(engagement.id, openPhase))}
              onRequestChanges={() => act(() => requestChangesAction(engagement.id, openPhase))}
              onDecideRow={(id, decision) => act(() => decideReviewAction(engagement.id, id, decision))}
              onAnswerQuestion={(id, patch) => actKeepOpen(() => answerOpenQuestionAction(engagement.id, id, patch))}
              onApplyRerun={() => actKeepOpen(() => applyAnswersAndRerunKickoffAction(engagement.id))}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanel(props: {
  phase: PhaseKey; label: string; no: number; status: PhaseStatus; payload: unknown;
  fieldReviews: ReviewItem[]; openQuestions: OpenQuestionReview[]; busy: boolean; onClose: () => void;
  onApprove: () => void; onRequestChanges: () => void; onDecideRow: (id: string, d: "approved" | "rejected") => void;
  onAnswerQuestion: (id: string, patch: { answer?: string; waived?: boolean }) => void;
  onApplyRerun: () => void;
}) {
  const { phase, label, no, status, payload, fieldReviews, openQuestions, busy } = props;
  const reviewable = status === "awaiting_human_review";
  const openRows = fieldReviews.filter((i) => i.status === "submitted").length;
  const unanswered = openQuestions.filter((q) => q.status === "submitted").length;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontWeight: 750, fontSize: 16 }}>Phase {no} · {label}</div>
        <button onClick={props.onClose} style={{ ...btnGhost, fontSize: 13 }}>Close</button>
      </div>

      {phase === "kickoff" && openQuestions.length > 0 ? (
        <>
          <StageView phase="kickoff" payload={payload} showRawJson={false} hideKickoffQuestions />
          <div style={{ fontSize: 13, color: C.sub, margin: "12px 0" }}>
            The scoping agent flagged these for client confirmation — the boundary above rests on them. Answer or waive each, then approve, or apply the answers and re-run to regenerate the charter.
          </div>
          {openQuestions.map((q) => (
            <OpenQuestionCard key={q.id} q={q} editable={reviewable} busy={busy} onAnswer={(patch) => props.onAnswerQuestion(q.id, patch)} />
          ))}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>
              {unanswered > 0 ? `Gate closed — ${unanswered} question(s) unanswered.` : "All questions resolved — approve the charter, or apply answers & re-run."}
            </div>
            {reviewable && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button disabled={busy || unanswered > 0} onClick={props.onApprove} style={{ ...btn(ACCENT), opacity: busy || unanswered > 0 ? 0.45 : 1, cursor: unanswered > 0 ? "not-allowed" : "pointer" }}>Approve phase →</button>
                <button disabled={busy || unanswered > 0} onClick={props.onApplyRerun} style={{ ...btn("#2848b8"), opacity: busy || unanswered > 0 ? 0.45 : 1, cursor: unanswered > 0 ? "not-allowed" : "pointer" }}>↻ Apply answers & re-run</button>
                <button disabled={busy} onClick={props.onRequestChanges} style={btnGhost}>Request changes</button>
              </div>
            )}
          </div>
        </>
      ) : phase === "data_collection" && fieldReviews.length > 0 ? (
        <>
          <StageView phase="data_collection" payload={payload} showRawJson={false} />
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
            <div style={{ marginBottom: 14 }}>
              <StageView phase={phase} payload={payload} />
            </div>
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

const PARSE_BADGE: Record<string, { bg: string; fg: string; label: (pages: number | null) => string }> = {
  parsed: { bg: "#e6f4ec", fg: C.high, label: (p) => `✓ parsed${p ? ` · ${p}p` : ""}` },
  unsupported: { bg: "#fbf2dc", fg: C.medium, label: () => "⚠ unsupported" },
  error: { bg: "#fde8de", fg: C.low, label: () => "✕ parse failed" },
  skipped: { bg: "#eef1f0", fg: C.sub, label: () => "○ not parsed" },
};

function DataSourceControl(props: {
  engagementId: string;
  mode: DataSourceMode;
  documents: DocumentSummary[];
  busy: boolean;
  onSetMode: (m: DataSourceMode) => void;
  onError: (msg: string) => void;
  onUploaded: () => void;
}) {
  const { engagementId, mode, documents, busy, onSetMode, onError, onUploaded } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const parsedCount = documents.filter((d) => d.parseStatus === "parsed").length;

  const upload = async (file: File) => {
    setUploading(true);
    onError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/engagements/${engagementId}/upload`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `Upload failed (HTTP ${res.status})`);
      if (data?.parse_status === "error" || data?.parse_status === "unsupported") {
        onError(data?.parse_error ?? `Document stored but not parsed (${data.parse_status}).`);
      }
      onUploaded();
    } catch (e) {
      onError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const seg = (m: DataSourceMode, label: string) => {
    const active = mode === m;
    return (
      <button
        key={m}
        disabled={busy || active}
        onClick={() => onSetMode(m)}
        style={{
          border: "none", cursor: active ? "default" : "pointer", fontSize: 13, fontWeight: 650,
          padding: "6px 14px", borderRadius: 7, background: active ? "#fff" : "transparent",
          color: active ? C.text : C.sub, boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.sub, letterSpacing: 0.3 }}>DATA SOURCE</span>
        <div style={{ display: "inline-flex", gap: 2, background: "#eef1f0", padding: 3, borderRadius: 9 }}>
          {seg("demo", "Demo data")}
          {seg("user", "My data")}
        </div>
        <span style={{ fontSize: 12.5, color: C.sub }}>
          {mode === "demo"
            ? "Runs on the built-in sample bill + fixtures."
            : `Extracts from your uploaded documents${parsedCount ? ` (${parsedCount} ready)` : ""}.`}
        </span>
      </div>

      {mode === "user" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.tiff,.webp,.docx,.doc,.pptx,.ppt,.odt,.rtf,.html,.htm"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              disabled={uploading || busy}
              onClick={() => fileRef.current?.click()}
              style={{ ...btn(ACCENT), opacity: uploading || busy ? 0.5 : 1 }}
            >
              {uploading ? "Parsing…" : "＋ Upload document"}
            </button>
            <span style={{ fontSize: 12, color: C.sub }}>PDF / image (OCR), Word, PowerPoint, HTML — parsed to markdown, then extracted.</span>
          </div>

          {documents.length > 0 ? (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {documents.map((d, i) => {
                const b = PARSE_BADGE[d.parseStatus] ?? PARSE_BADGE.skipped;
                return (
                  <div key={`${d.name}_${i}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 13, background: "#f6f8f7", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 10px" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                    <span style={{ background: b.bg, color: b.fg, fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{b.label(d.pageCount)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 12.5, color: C.sub }}>No documents yet — upload at least one before running Data Collection.</div>
          )}
        </div>
      )}
    </div>
  );
}

function OpenQuestionCard(props: {
  q: OpenQuestionReview; editable: boolean; busy: boolean;
  onAnswer: (patch: { answer?: string; waived?: boolean }) => void;
}) {
  const { q, editable, busy, onAnswer } = props;
  const [text, setText] = useState(q.answer ?? "");
  const resolved = q.status !== "submitted";
  const accent = resolved ? (q.waived ? C.medium : C.high) : C.low;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ fontWeight: 650, fontSize: 14, lineHeight: 1.45 }}>{q.question}</div>
      {resolved ? (
        <div style={{ fontSize: 13, marginTop: 8 }}>
          {q.waived ? (
            <span style={{ color: C.medium, fontWeight: 650 }}>↪ Waived — not applicable this cycle</span>
          ) : (
            <span style={{ color: C.text }}><span style={{ color: C.sub }}>Answer: </span>{q.answer || "—"}</span>
          )}
        </div>
      ) : editable ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="The client's confirmed answer…"
            rows={2}
            style={{ width: "100%", marginTop: 8, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button disabled={busy || !text.trim()} onClick={() => onAnswer({ answer: text })} style={{ ...btn(ACCENT), opacity: busy || !text.trim() ? 0.45 : 1 }}>Save answer</button>
            <button disabled={busy} onClick={() => onAnswer({ waived: true })} style={btnGhost}>Waive</button>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: C.low, marginTop: 6 }}>Unanswered</div>
      )}
    </div>
  );
}
