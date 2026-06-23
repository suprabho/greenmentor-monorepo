"use client";

import { useMemo, useState } from "react";
import type { PhaseKey } from "@/lib/orchestrator/pipeline";
import {
  PHASE_ROWS,
  DEMO_ENGAGEMENT,
  type DemoPhaseStatus,
  type ReviewItem,
  type Confidence,
} from "@/lib/demo/fixtures";
import { rowsToReviewItems } from "@/lib/demo/collectionRunInput";
import { buildPhaseInput, summarizeArtifact, type Artifacts } from "@/lib/demo/phaseInputs";
import CACHED_RAW from "@/lib/demo/cachedArtifacts.json";

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

/* Pre-run artifacts (lib/demo/cachedArtifacts.json). Present → board opens on a
   completed engagement; absent ({}) → board opens fresh and you run each phase. */
const CACHED = CACHED_RAW as Artifacts;
const HAS_CACHE = Object.keys(CACHED).length > 0;

const FRESH_STATUS = Object.fromEntries(
  PHASE_ROWS.map((r) => [r.key, "not_started"]),
) as Record<PhaseKey, DemoPhaseStatus>;

const cachedStatus = (): Record<PhaseKey, DemoPhaseStatus> =>
  Object.fromEntries(
    PHASE_ROWS.map((r) => [r.key, CACHED[r.key] ? "complete" : "not_started"]),
  ) as Record<PhaseKey, DemoPhaseStatus>;

const cachedItems = (): ReviewItem[] =>
  CACHED.data_collection
    ? rowsToReviewItems(CACHED.data_collection).map((i) => ({ ...i, status: "approved" as const }))
    : [];

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
  const [phaseStatus, setPhaseStatus] = useState<Record<PhaseKey, DemoPhaseStatus>>(HAS_CACHE ? cachedStatus() : FRESH_STATUS);
  const [artifacts, setArtifacts] = useState<Artifacts>(HAS_CACHE ? CACHED : {});
  const [items, setItems] = useState<ReviewItem[]>(HAS_CACHE ? cachedItems() : []);
  const [openPhase, setOpenPhase] = useState<PhaseKey | null>(null);
  const [running, setRunning] = useState<PhaseKey | null>(null);
  const [runMeta, setRunMeta] = useState<Partial<Record<PhaseKey, string>>>({});
  const [runError, setRunError] = useState<{ phase: PhaseKey; msg: string } | null>(null);

  const rowByKey = useMemo(() => Object.fromEntries(PHASE_ROWS.map((r) => [r.key, r])), []);

  // Linear DAG: next runnable = first not_started/changes_requested with prior complete.
  const nextRunnable = useMemo<PhaseKey | null>(() => {
    for (let i = 0; i < PHASE_ROWS.length; i++) {
      const row = PHASE_ROWS[i];
      const st = phaseStatus[row.key];
      const prevComplete = i === 0 || phaseStatus[PHASE_ROWS[i - 1].key] === "complete";
      if ((st === "not_started" || st === "changes_requested") && prevComplete) return row.key;
    }
    return null;
  }, [phaseStatus]);

  const displayStatus = (key: PhaseKey): DemoPhaseStatus | "ready" =>
    (phaseStatus[key] === "not_started" || phaseStatus[key] === "changes_requested") && key === nextRunnable
      ? "ready"
      : phaseStatus[key];

  // Run one phase's real agent, feeding it the prior phases' outputs.
  const runPhase = async (key: PhaseKey) => {
    setRunning(key);
    setRunError(null);
    setOpenPhase(key);
    try {
      const { agentKey, input, ctx } = buildPhaseInput(key, artifacts);
      const res = await fetch(`/api/agents/${agentKey}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, ctx }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setArtifacts((a) => ({ ...a, [key]: data.output }));
      setRunMeta((m) => ({ ...m, [key]: `live · ${data.meta?.model ?? "claude"}` }));
      setPhaseStatus((p) => ({ ...p, [key]: "awaiting_human_review" }));
      if (key === "data_collection") {
        const live = rowsToReviewItems(data.output);
        setItems(live.length ? live : []);
      }
    } catch (e) {
      setRunError({ phase: key, msg: e instanceof Error ? e.message : "run failed" });
    } finally {
      setRunning(null);
    }
  };

  const approvePhase = (key: PhaseKey) => {
    setPhaseStatus((p) => ({ ...p, [key]: "complete" }));
    setOpenPhase(null);
  };

  const requestChanges = (key: PhaseKey) => {
    setPhaseStatus((p) => ({ ...p, [key]: "changes_requested" }));
    if (key === "data_collection") setItems((prev) => prev.map((i) => ({ ...i, status: "submitted", feedback: undefined })));
    setOpenPhase(null);
  };

  const startFresh = () => {
    setArtifacts({}); setPhaseStatus(FRESH_STATUS); setItems([]);
    setOpenPhase(null); setRunMeta({}); setRunError(null);
  };
  const loadCached = () => {
    setArtifacts(CACHED); setPhaseStatus(cachedStatus()); setItems(cachedItems());
    setOpenPhase(null); setRunMeta({}); setRunError(null);
  };

  // data-collection per-row review
  const decide = (id: string, status: "approved" | "rejected") =>
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status, feedback: status === "rejected" ? "Please confirm the figure and attach the source bill." : undefined }
          : i,
      ),
    );

  const open = items.filter((i) => i.status === "submitted").length;
  const rejected = items.filter((i) => i.status === "rejected").length;
  const collectionGateClear = items.length > 0 && open === 0 && rejected === 0;

  const completeCount = PHASE_ROWS.filter((r) => phaseStatus[r.key] === "complete").length;
  const allDone = completeCount === PHASE_ROWS.length;
  const isReplay = HAS_CACHE && allDone && Object.keys(runMeta).length === 0;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 24px 64px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: ACCENT }} />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3, color: ACCENT }}>GREENMENTOR · ESG-AGENTS</span>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="/buddy" style={{ fontSize: 13, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>🌱 ESG Buddy →</a>
            <a href="/agents" style={{ fontSize: 13, color: ACCENT, fontWeight: 600, textDecoration: "none" }}>Agent Studio →</a>
          </div>
        </div>
        <h1 style={{ fontSize: 24, margin: "6px 0 4px", fontWeight: 750 }}>{DEMO_ENGAGEMENT.name}</h1>
        <div style={{ color: C.sub, fontSize: 14, marginBottom: 10 }}>
          {DEMO_ENGAGEMENT.client} · {DEMO_ENGAGEMENT.financialYear} · {completeCount}/{PHASE_ROWS.length} phases approved
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {DEMO_ENGAGEMENT.frameworks.map((f) => (
            <span key={f} style={{ fontSize: 12, fontWeight: 600, color: C.sub, background: "#fff", border: `1px solid ${C.border}`, padding: "3px 9px", borderRadius: 6 }}>
              {f}
            </span>
          ))}
        </div>

        {/* mode toggle */}
        {HAS_CACHE && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, fontSize: 12.5, color: C.sub }}>
            <span style={{ fontWeight: 600 }}>
              {isReplay ? "📦 Showing pre-run results (instant)" : "▶ Live run"}
            </span>
            <button onClick={loadCached} style={{ ...btnGhost, padding: "5px 11px", fontSize: 12.5 }}>↺ Replay pre-run</button>
            <button onClick={startFresh} style={{ ...btnGhost, padding: "5px 11px", fontSize: 12.5 }}>▶ Start fresh (live)</button>
            <span style={{ color: C.blocked }}>· each phase&apos;s ↻ Re-run live makes a real agent call</span>
          </div>
        )}

        {allDone && (
          <div style={{ background: "#e6f4ec", border: `1px solid ${ACCENT}55`, color: C.high, borderRadius: 12, padding: "12px 16px", marginBottom: 18, fontWeight: 650 }}>
            ✓ All 8 phases complete — the engagement report is ready for board sign-off.
          </div>
        )}

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
              const isRunning = running === row.key;
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
                    {st === "complete" ? "✓" : row.no}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: 14.5 }}>{row.label}</div>
                    <div style={{ fontSize: 12, color: C.sub, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{row.agentKey}</div>
                  </div>
                  <StatusPill status={isRunning ? "ready" : st} />
                  {isRunning ? (
                    <button disabled style={{ ...btn(C.sub), opacity: 0.6, cursor: "wait" }}>Running…</button>
                  ) : st === "ready" ? (
                    <button onClick={() => runPhase(row.key)} style={btn("#2848b8")}>▸ Run live</button>
                  ) : st === "awaiting_human_review" ? (
                    <button onClick={() => setOpenPhase(row.key)} style={btn(ACCENT)}>
                      Review{row.key === "data_collection" && items.length ? ` ${open}` : ""} →
                    </button>
                  ) : st === "complete" ? (
                    <button onClick={() => setOpenPhase(row.key)} style={{ ...btnGhost, fontSize: 13 }}>View</button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* detail / review panel */}
          {openPhase && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <div style={{ fontWeight: 750, fontSize: 16 }}>
                  Phase {rowByKey[openPhase].no} · {rowByKey[openPhase].label}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => runPhase(openPhase)}
                    disabled={running === openPhase}
                    style={{ ...btn(ACCENT), opacity: running === openPhase ? 0.6 : 1, cursor: running === openPhase ? "wait" : "pointer" }}
                  >
                    {running === openPhase ? "Running…" : artifacts[openPhase] ? "↻ Re-run live" : "▸ Run live"}
                  </button>
                  <button onClick={() => setOpenPhase(null)} style={{ ...btnGhost, fontSize: 13 }}>Close</button>
                </div>
              </div>

              {running === openPhase && (
                <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>
                  Running the <code>{rowByKey[openPhase].agentKey}</code> agent live (real Claude call, strict tool-use)…
                </div>
              )}

              {runMeta[openPhase] && running !== openPhase && (
                <div style={{ fontSize: 12, fontWeight: 600, color: C.high, background: "#e6f4ec", padding: "5px 9px", borderRadius: 6, marginBottom: 10 }}>
                  ● {runMeta[openPhase]} — emitted via <code>{rowByKey[openPhase].agentKey}</code>, schema-validated
                  {openPhase === "data_collection" ? " from the sample MSEDCL bill" : ""}
                </div>
              )}

              {runError?.phase === openPhase && (
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.low, background: "#fde8de", padding: "7px 10px", borderRadius: 6, marginBottom: 10 }}>
                  Run failed: {runError.msg}
                  {/anthropic|api[_ ]?key|credential/i.test(runError.msg) && " — check ANTHROPIC_API_KEY in .env.local and restart the dev server."}
                </div>
              )}

              {/* DATA COLLECTION → rich review queue */}
              {openPhase === "data_collection" ? (
                items.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.sub }}>
                    Hit <strong>▸ Run live</strong> to extract a dataset from the sample MSEDCL electricity bill via Claude.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>
                      The <code>data-collection</code> agent extracted these as <strong>drafts</strong>. Verify before Phase 5;
                      low-confidence / outlier rows are flagged and sorted first.
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
                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                      {phaseStatus.data_collection === "complete" ? (
                        <div style={{ fontSize: 13, fontWeight: 650, color: C.high }}>✓ phase approved — re-run live above to demo a fresh extraction.</div>
                      ) : (
                        <>
                          <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>
                            {open > 0
                              ? `Gate closed — ${open} item${open > 1 ? "s" : ""} awaiting your decision.`
                              : rejected > 0
                                ? `${rejected} item${rejected > 1 ? "s" : ""} sent back. Re-run the agent with your feedback.`
                                : "All items approved — gate is clear."}
                          </div>
                          {rejected > 0 ? (
                            <button onClick={() => requestChanges("data_collection")} style={btn("#b8860b")}>↺ Send phase back for changes</button>
                          ) : (
                            <button onClick={() => approvePhase("data_collection")} disabled={!collectionGateClear} style={{ ...btn(ACCENT), opacity: collectionGateClear ? 1 : 0.45, cursor: collectionGateClear ? "pointer" : "not-allowed" }}>
                              Approve phase → unlock Validation
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )
              ) : (
                /* OTHER PHASES → artifact summary + approve gate */
                !artifacts[openPhase] ? (
                  <div style={{ fontSize: 13, color: C.sub }}>
                    {running === openPhase ? "Generating the artifact…" : <>Hit <strong>▸ Run live</strong> to run this agent.</>}
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: C.sub, marginBottom: 14 }}>
                      The <code>{rowByKey[openPhase].agentKey}</code> agent emitted this artifact. Review, then approve to cascade into the next phase.
                    </div>
                    <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                      {summarizeArtifact(openPhase, artifacts[openPhase])?.map((b) => (
                        <div key={b.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, borderBottom: `1px solid ${C.border}`, paddingBottom: 7 }}>
                          <span style={{ color: C.sub }}>{b.label}</span>
                          <span style={{ fontWeight: 650, textAlign: "right" }}>{b.value}</span>
                        </div>
                      ))}
                    </div>
                    <details style={{ marginBottom: 14 }}>
                      <summary style={{ fontSize: 12.5, color: C.sub, cursor: "pointer", fontWeight: 600 }}>View raw artifact (JSON)</summary>
                      <pre style={{ fontSize: 11, background: "#f6f8f7", border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, overflow: "auto", maxHeight: 320, marginTop: 8 }}>
                        {JSON.stringify(artifacts[openPhase], null, 2)}
                      </pre>
                    </details>
                    <div style={{ paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
                      {phaseStatus[openPhase] === "complete" ? (
                        <div style={{ fontSize: 13, fontWeight: 650, color: C.high }}>✓ approved</div>
                      ) : (
                        <>
                          <button onClick={() => approvePhase(openPhase)} style={btn(ACCENT)}>Approve phase →</button>
                          <button onClick={() => requestChanges(openPhase)} style={btnGhost}>Request changes</button>
                        </>
                      )}
                    </div>
                  </>
                )
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 22, fontSize: 12, color: C.blocked }}>
          Demo · interactive client-side state over the sample engagement. Every <strong>Run live</strong> / <strong>Re-run live</strong> is
          a real Claude strict-tool-use call to <code>/api/agents/&lt;key&gt;/run</code>; each phase&apos;s input is built from the prior
          phases&apos; outputs. Pre-run artifacts are cached for instant load; no DB.
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
