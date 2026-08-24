"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PeerRunResult, { type PeerResultData, type PeerRow } from "../agents/PeerRunResult";
import TopicsRunResult, { type TopicsResultData } from "../agents/TopicsRunResult";
import FrameworkRunResult, { type FrameworkResultData } from "../agents/FrameworkRunResult";
import LongListResult, { type LongListResultData, type LongListMeta } from "./LongListResult";

/**
 * Materiality Long List orchestrator — chains the three phase-0 research agents
 * plus the materiality-long-list distiller into one wizard:
 *
 *   1. pick the subject company (BRSR corpus) and options
 *   2. run nic-framework-materiality AND peer-research in parallel — the
 *      framework view doesn't depend on the peer set, so neither waits
 *   3. HITL: the user trims/extends the peer cohort (the topics agent needs
 *      NSE symbols, so unlisted/symbol-less peers are shown but not selectable)
 *   4. run peer-material-topics-extraction over the selected cohort
 *   5. run materiality-long-list over both tables → the 20-25 topic register
 *
 * Every run posts to the existing /api/agents/[key]/run demo path (grounded,
 * no persistence) — state lives in this component, like the Studio test bench,
 * so a refresh starts over. Re-picking peers resets steps 4-5, the same
 * downstream-reset rule as community-engine's recap-topic step.
 */

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";
const MUTED = "#8a958f";
const INK = "#1a2420";

const MAX_COHORT = 15;

const FRAMEWORK_KEYS = ["sasb", "sustainalytics", "msci"] as const;
const FRAMEWORK_LABEL: Record<string, string> = {
  sasb: "SASB",
  sustainalytics: "Sustainalytics",
  msci: "MSCI",
};

interface CompanyItem {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  revenueInrCr: number | null;
  fy: string;
  hasMarketsData: boolean;
}

type RunMeta = { model?: string; stopReason?: string | null; seconds?: number };

interface Run<T> {
  status: "idle" | "running" | "done" | "error";
  data?: T;
  meta?: RunMeta;
  error?: string;
  startedAt?: number;
}

const IDLE: Run<never> = { status: "idle" };

interface SelectedPeer {
  symbol: string;
  name: string | null;
}

const btn = (primary: boolean, enabled: boolean): React.CSSProperties => ({
  background: primary ? ACCENT : "#fff",
  color: primary ? "#fff" : "#5d6b64",
  border: primary ? "none" : `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: primary ? "8px 16px" : "8px 14px",
  fontSize: 13.5,
  fontWeight: 650,
  cursor: enabled ? "pointer" : "not-allowed",
  opacity: enabled ? 1 : 0.45,
});

async function callAgent<T>(key: string, input: unknown): Promise<{ output: T; meta: RunMeta }> {
  const res = await fetch(`/api/agents/${key}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return { output: (data.output ?? {}) as T, meta: data.meta ?? {} };
}

/** The distiller's input schema carries slim copies of the two tables — strip
 *  everything it doesn't ask for so additionalProperties:false can't trip. */
function slimFrameworkTable(d: FrameworkResultData) {
  return {
    topics: (d.topics ?? []).map((t) => ({
      name: t.name ?? "",
      description: t.description ?? "",
      pillar: t.pillar ?? "E",
      frameworks: (t.frameworks ?? []).map((f) => ({ framework: f.framework ?? "sasb", as_named: f.as_named ?? "" })),
      convergence: t.convergence ?? 1,
      msci_weight_pct: t.msci_weight_pct ?? null,
    })),
    frameworks_covered: (d.frameworks_covered ?? []).map((f) => ({
      framework: f.framework ?? "sasb",
      matched_count: f.matched_count ?? 0,
      match_level: f.match_level ?? null,
    })),
    methodology: d.methodology ?? null,
    caveats: d.caveats ?? null,
  };
}

function slimPeerTable(d: TopicsResultData) {
  return {
    topics: (d.topics ?? []).map((t) => ({
      name: t.name ?? "",
      description: t.description ?? "",
      pillar: t.pillar ?? "E",
      peers: (t.peers ?? []).map((p) => ({ symbol: p.symbol ?? "", name: p.name ?? null, as_disclosed: p.as_disclosed ?? "" })),
      frequency: t.frequency ?? (t.peers?.length || 1),
      risk_opportunity: t.risk_opportunity ?? null,
    })),
    peers_missing: d.peers_missing ?? null,
    methodology: d.methodology ?? null,
    caveats: d.caveats ?? null,
  };
}

function StepHeader({ n, title, status, note }: { n: number; title: string; status?: string; note?: string }) {
  const done = status === "done";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <div style={{ width: 24, height: 24, borderRadius: 7, background: done ? "#e8f5ee" : "#eef1f0", color: done ? ACCENT : "#5d6b64", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 750, flexShrink: 0 }}>
        {done ? "✓" : n}
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 750, color: INK }}>{title}</div>
      {note && <div style={{ fontSize: 11.5, color: MUTED }}>{note}</div>}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
      {children}
    </div>
  );
}

function RunStatus({ run, now, label }: { run: Run<unknown>; now: number; label: string }) {
  if (run.status === "idle") return null;
  const elapsed = run.startedAt ? Math.max(0, Math.round((now - run.startedAt) / 1000)) : 0;
  return (
    <span style={{ fontSize: 12.5, fontWeight: 600, color: run.status === "error" ? "#c2410c" : run.status === "done" ? ACCENT : "#5d6b64" }}>
      {run.status === "running" && `${label} — running… ${elapsed}s`}
      {run.status === "done" && `${label} ✓${run.meta?.seconds != null ? ` ${run.meta.seconds}s` : ""}`}
      {run.status === "error" && `${label} failed: ${run.error}`}
    </span>
  );
}

function Collapsible({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details style={{ marginTop: 10 }}>
      <summary style={{ fontSize: 12.5, fontWeight: 650, color: "#5d6b64", cursor: "pointer" }}>{summary}</summary>
      {children}
    </details>
  );
}

export default function MaterialityWizard() {
  // ---- step 1: subject & options ----
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [subject, setSubject] = useState<CompanyItem | null>(null);
  const [frameworks, setFrameworks] = useState<string[]>([...FRAMEWORK_KEYS]);
  const [maxPeers, setMaxPeers] = useState(10);
  const [notes, setNotes] = useState("");

  // ---- runs ----
  const [frameworkRun, setFrameworkRun] = useState<Run<FrameworkResultData>>(IDLE);
  const [peerRun, setPeerRun] = useState<Run<PeerResultData>>(IDLE);
  const [topicsRun, setTopicsRun] = useState<Run<TopicsResultData>>(IDLE);
  const [distillRun, setDistillRun] = useState<Run<LongListResultData>>(IDLE);

  // ---- step 3: cohort ----
  const [selected, setSelected] = useState<SelectedPeer[]>([]);
  const [peerQuery, setPeerQuery] = useState("");
  const [peerCompanies, setPeerCompanies] = useState<CompanyItem[]>([]);
  const [peerPicking, setPeerPicking] = useState(false);
  /** The cohort the current topics/distill results were computed over — a
   *  selection edit after a run makes them stale, shown until re-run. */
  const [ranCohortKey, setRanCohortKey] = useState<string | null>(null);

  // One shared 1s clock drives every in-flight elapsed counter.
  const [now, setNow] = useState(() => Date.now());
  const anyRunning = [frameworkRun, peerRun, topicsRun, distillRun].some((r) => r.status === "running");
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyRunning]);

  // Debounced company lookup for the subject picker.
  const loadCompanies = useCallback(async (q: string, into: (c: CompanyItem[]) => void, busy: (b: boolean) => void) => {
    busy(true);
    try {
      const res = await fetch(`/api/brsr/companies?q=${encodeURIComponent(q)}&limit=25`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      into(data.companies ?? []);
    } catch {
      into([]);
    } finally {
      busy(false);
    }
  }, []);

  useEffect(() => {
    if (subject) return;
    const t = setTimeout(() => void loadCompanies(query, setCompanies, setPicking), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [subject, query, loadCompanies]);

  useEffect(() => {
    if (!peerQuery) {
      setPeerCompanies([]);
      return;
    }
    const t = setTimeout(() => void loadCompanies(peerQuery, setPeerCompanies, setPeerPicking), 250);
    return () => clearTimeout(t);
  }, [peerQuery, loadCompanies]);

  // ---- step 2: parallel research ----
  const startResearch = () => {
    if (!subject || !frameworks.length) return;
    // A re-run restarts the whole flow — everything downstream depends on both.
    setTopicsRun(IDLE);
    setDistillRun(IDLE);
    setSelected([]);
    setRanCohortKey(null);

    setFrameworkRun({ status: "running", startedAt: Date.now() });
    void callAgent<FrameworkResultData>("nic-framework-materiality", {
      symbol: subject.symbol,
      frameworks,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    })
      .then(({ output, meta }) => setFrameworkRun({ status: "done", data: output, meta }))
      .catch((e) => setFrameworkRun({ status: "error", error: e instanceof Error ? e.message : "run failed" }));

    setPeerRun({ status: "running", startedAt: Date.now() });
    void callAgent<PeerResultData>("peer-research", {
      company: { symbol: subject.symbol, name: subject.name },
      max_peers: maxPeers,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    })
      .then(({ output, meta }) => {
        setPeerRun({ status: "done", data: output, meta });
        // Pre-select every selectable peer — the HITL step is then a trim, not a rebuild.
        setSelected(
          (output.peers ?? [])
            .filter((p): p is PeerRow & { symbol: string } => !!p.symbol && p.nse_listed !== false)
            .slice(0, MAX_COHORT)
            .map((p) => ({ symbol: p.symbol, name: p.name ?? null })),
        );
      })
      .catch((e) => setPeerRun({ status: "error", error: e instanceof Error ? e.message : "run failed" }));
  };

  const retryFramework = () => {
    if (!subject || !frameworks.length) return;
    setDistillRun(IDLE);
    setFrameworkRun({ status: "running", startedAt: Date.now() });
    void callAgent<FrameworkResultData>("nic-framework-materiality", {
      symbol: subject.symbol,
      frameworks,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    })
      .then(({ output, meta }) => setFrameworkRun({ status: "done", data: output, meta }))
      .catch((e) => setFrameworkRun({ status: "error", error: e instanceof Error ? e.message : "run failed" }));
  };

  // ---- step 3: cohort edits reset downstream ----
  const cohortKey = selected.map((p) => p.symbol).sort().join(",");
  const editCohort = (next: SelectedPeer[]) => setSelected(next.slice(0, MAX_COHORT));
  const togglePeer = (peer: SelectedPeer) =>
    editCohort(
      selected.some((p) => p.symbol === peer.symbol)
        ? selected.filter((p) => p.symbol !== peer.symbol)
        : [...selected, peer],
    );
  const cohortStale = ranCohortKey !== null && ranCohortKey !== cohortKey;

  // ---- step 4: peer topics ----
  const runTopics = () => {
    if (!selected.length) return;
    setDistillRun(IDLE);
    setRanCohortKey(cohortKey);
    setTopicsRun({ status: "running", startedAt: Date.now() });
    void callAgent<TopicsResultData>("peer-material-topics-extraction", {
      peers: selected.map((p) => ({ symbol: p.symbol, name: p.name })),
    })
      .then(({ output, meta }) => setTopicsRun({ status: "done", data: output, meta }))
      .catch((e) => setTopicsRun({ status: "error", error: e instanceof Error ? e.message : "run failed" }));
  };

  // ---- step 5: distill ----
  const runDistill = () => {
    if (frameworkRun.status !== "done" || topicsRun.status !== "done" || !frameworkRun.data || !topicsRun.data) return;
    setDistillRun({ status: "running", startedAt: Date.now() });
    void callAgent<LongListResultData>("materiality-long-list", {
      subject: subject ? { symbol: subject.symbol, name: subject.name } : null,
      framework_topics: slimFrameworkTable(frameworkRun.data),
      peer_topics: slimPeerTable(topicsRun.data),
      peers_analysed: selected.length,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    })
      .then(({ output, meta }) => setDistillRun({ status: "done", data: output, meta }))
      .catch((e) => setDistillRun({ status: "error", error: e instanceof Error ? e.message : "run failed" }));
  };

  const researchStarted = frameworkRun.status !== "idle" || peerRun.status !== "idle";
  const researchDone = frameworkRun.status === "done" && peerRun.status === "done";
  const peerRows = peerRun.data?.peers ?? [];
  const agentSymbols = new Set(peerRows.map((p) => p.symbol).filter(Boolean) as string[]);
  const manualPicks = selected.filter((p) => !agentSymbols.has(p.symbol));

  return (
    <div>
      {/* ---- Step 1 — subject ---- */}
      <Card>
        <StepHeader n={1} title="Subject company" status={subject ? "done" : undefined} note="from the BRSR corpus" />

        {subject ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${ACCENT}55`, background: "#f2f8f5", borderRadius: 8, padding: "9px 12px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>
                {subject.name} <span style={{ color: MUTED, fontWeight: 600, fontSize: 11.5 }}>{subject.symbol}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "#5d6b64" }}>
                {[subject.industry ?? subject.sector, subject.revenueInrCr != null ? `₹${subject.revenueInrCr.toLocaleString("en-IN")} cr` : null, `FY ${subject.fy}`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <button
              onClick={() => { setSubject(null); setQuery(""); }}
              disabled={anyRunning}
              style={{ ...btn(false, !anyRunning), padding: "5px 10px", fontSize: 12 }}
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by NSE symbol or company name…"
              style={{ width: "100%", boxSizing: "border-box", fontSize: 13.5, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fbfcfb", color: INK }}
            />
            <div style={{ marginTop: 8, maxHeight: 240, overflow: "auto", border: `1px solid ${BORDER}`, borderRadius: 8 }}>
              {picking && <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>Loading…</div>}
              {!picking && companies.length === 0 && (
                <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>No profiled BRSR companies matched.</div>
              )}
              {companies.map((c) => (
                <button
                  key={c.symbol}
                  onClick={() => setSubject(c)}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${BORDER}`, padding: "9px 12px", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 13, fontWeight: 650, color: INK }}>
                    {c.name} <span style={{ color: MUTED, fontWeight: 600, fontSize: 11 }}>{c.symbol}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#5d6b64" }}>
                    {[c.industry ?? c.sector, c.revenueInrCr != null ? `₹${c.revenueInrCr.toLocaleString("en-IN")} cr` : null].filter(Boolean).join(" · ")}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 14 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>
              Frameworks
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FRAMEWORK_KEYS.map((f) => {
                const on = frameworks.includes(f);
                return (
                  <button
                    key={f}
                    onClick={() => setFrameworks((prev) => (on ? prev.filter((x) => x !== f) : [...prev, f]))}
                    disabled={researchStarted}
                    style={{ background: on ? "#f2f8f5" : "#fff", color: on ? ACCENT : "#5d6b64", border: `1px solid ${on ? `${ACCENT}55` : BORDER}`, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 650, cursor: researchStarted ? "not-allowed" : "pointer", opacity: researchStarted ? 0.6 : 1 }}
                  >
                    {on ? "✓ " : ""}
                    {FRAMEWORK_LABEL[f]}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>
              Max peers
            </div>
            <input
              type="number"
              min={1}
              max={15}
              value={maxPeers}
              disabled={researchStarted}
              onChange={(e) => setMaxPeers(Math.min(15, Math.max(1, Number(e.target.value) || 10)))}
              style={{ width: 64, fontSize: 13, padding: "6px 8px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "#fbfcfb" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>
              Notes (optional)
            </div>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. focus on specialty chemicals peers"
              style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "6px 10px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "#fbfcfb", color: INK }}
            />
          </div>
        </div>
        {frameworks.includes("msci") && (
          <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "#7a3fa8", background: "#f4ecfa", border: "1px solid #dcc8ea", borderRadius: 8, padding: "7px 11px" }}>
            MSCI is proprietary reference data — a long list containing its signals is internal-use only.
            Deselect it for a freely shareable table.
          </div>
        )}
      </Card>

      {/* ---- Step 2 — parallel research ---- */}
      <Card>
        <StepHeader
          n={2}
          title="Framework materiality + peer research"
          status={researchDone ? "done" : undefined}
          note="the two runs don't depend on each other, so they go in parallel"
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={startResearch} disabled={!subject || !frameworks.length || anyRunning} style={btn(true, !!subject && frameworks.length > 0 && !anyRunning)}>
            {researchStarted ? "Re-run research (resets everything below)" : "Run research"}
          </button>
          <RunStatus run={frameworkRun} now={now} label="Frameworks" />
          <RunStatus run={peerRun} now={now} label="Peers" />
        </div>
        {(frameworkRun.status === "running" || peerRun.status === "running") && (
          <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>
            peer research includes web search and can take a minute or two
          </div>
        )}
        {frameworkRun.status === "error" && (
          <button onClick={retryFramework} disabled={anyRunning} style={{ ...btn(false, !anyRunning), marginTop: 10 }}>
            Retry framework run only
          </button>
        )}
        {frameworkRun.status === "done" && frameworkRun.data && (
          <Collapsible summary={`Framework table — ${frameworkRun.data.topics?.length ?? 0} topics`}>
            <FrameworkRunResult data={frameworkRun.data} meta={frameworkRun.meta ?? null} mode="run" />
          </Collapsible>
        )}
        {peerRun.status === "done" && peerRun.data && (
          <Collapsible summary={`Peer research — ${peerRun.data.peers?.length ?? 0} peers proposed`}>
            <PeerRunResult data={peerRun.data} meta={peerRun.meta ?? null} mode="run" />
          </Collapsible>
        )}
      </Card>

      {/* ---- Step 3 — pick the cohort (HITL) ---- */}
      {peerRun.status === "done" && (
        <Card>
          <StepHeader
            n={3}
            title="Select the peers to analyse"
            status={topicsRun.status === "done" && !cohortStale ? "done" : undefined}
            note={`up to ${MAX_COHORT} — topics extraction needs NSE-listed peers with BRSR filings`}
          />

          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
            {peerRows.map((p) => {
              const selectable = !!p.symbol && p.nse_listed !== false;
              const isOn = !!p.symbol && selected.some((s) => s.symbol === p.symbol);
              const full = selectable && !isOn && selected.length >= MAX_COHORT;
              return (
                <button
                  key={p.symbol ?? p.name}
                  onClick={() => selectable && !full && togglePeer({ symbol: p.symbol!, name: p.name ?? null })}
                  disabled={!selectable || full}
                  title={!selectable ? "No NSE symbol / not NSE-listed — no BRSR filing to extract topics from" : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: isOn ? "#f2f8f5" : "none", border: "none", borderBottom: `1px solid ${BORDER}`, padding: "9px 12px", cursor: selectable && !full ? "pointer" : "not-allowed", opacity: selectable ? (full ? 0.5 : 1) : 0.45 }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${isOn ? ACCENT : "#c4cdc8"}`, background: isOn ? ACCENT : "#fff", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                    {isOn ? "✓" : ""}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 650, color: INK }}>
                      {p.name} <span style={{ color: MUTED, fontWeight: 600, fontSize: 11 }}>{p.symbol ?? "—"}</span>
                      {!selectable && <span style={{ marginLeft: 6, fontSize: 10.5, color: "#a8710a" }}>no BRSR filing</span>}
                    </span>
                    {p.rationale && (
                      <span style={{ display: "block", fontSize: 11.5, color: "#5d6b64", lineHeight: 1.45 }}>{p.rationale}</span>
                    )}
                  </span>
                  {p.scores?.overall != null && (
                    <span style={{ fontSize: 12.5, fontWeight: 750, color: p.scores.overall >= 70 ? ACCENT : p.scores.overall >= 40 ? "#a8710a" : "#b23b3b", flexShrink: 0 }}>
                      {p.scores.overall}
                    </span>
                  )}
                </button>
              );
            })}
            {peerRows.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>The peer-research run proposed no peers.</div>}
          </div>

          {manualPicks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {manualPicks.map((p) => (
                <span key={p.symbol} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: INK, background: "#f2f8f5", border: `1px solid ${ACCENT}55`, borderRadius: 7, padding: "4px 8px" }}>
                  {p.symbol} <span style={{ fontWeight: 500, color: "#5d6b64" }}>added manually</span>
                  <button onClick={() => togglePeer(p)} title={`Remove ${p.name ?? p.symbol}`} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>
              Add a peer the agent missed
            </div>
            <input
              value={peerQuery}
              onChange={(e) => setPeerQuery(e.target.value)}
              placeholder="Search the BRSR corpus, click to add…"
              style={{ width: "100%", boxSizing: "border-box", fontSize: 13, padding: "8px 11px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fbfcfb", color: INK }}
            />
            {peerQuery && (
              <div style={{ marginTop: 6, maxHeight: 180, overflow: "auto", border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                {peerPicking && <div style={{ padding: 10, fontSize: 12.5, color: MUTED }}>Loading…</div>}
                {!peerPicking && peerCompanies.length === 0 && (
                  <div style={{ padding: 10, fontSize: 12.5, color: MUTED }}>No profiled BRSR companies matched.</div>
                )}
                {peerCompanies.map((c) => {
                  const isOn = selected.some((s) => s.symbol === c.symbol);
                  const full = !isOn && selected.length >= MAX_COHORT;
                  return (
                    <button
                      key={c.symbol}
                      onClick={() => !full && togglePeer({ symbol: c.symbol, name: c.name })}
                      disabled={full}
                      style={{ display: "block", width: "100%", textAlign: "left", background: isOn ? "#f2f8f5" : "none", border: "none", borderBottom: `1px solid ${BORDER}`, padding: "8px 11px", cursor: full ? "not-allowed" : "pointer", opacity: full ? 0.5 : 1 }}
                    >
                      <span style={{ fontSize: 12.5, fontWeight: 650, color: INK }}>
                        {isOn && <span style={{ color: ACCENT, marginRight: 6 }}>✓</span>}
                        {c.name} <span style={{ color: MUTED, fontWeight: 600, fontSize: 11 }}>{c.symbol}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: "#3d4a44" }}>
            {selected.length} of {MAX_COHORT} selected
            {cohortStale && (
              <span style={{ marginLeft: 8, color: "#a8710a" }}>
                — cohort changed since the last extraction; results below are stale until you re-run
              </span>
            )}
          </div>
        </Card>
      )}

      {/* ---- Step 4 — peer topics ---- */}
      {peerRun.status === "done" && (
        <Card>
          <StepHeader n={4} title="Extract the peers' material topics" status={topicsRun.status === "done" && !cohortStale ? "done" : undefined} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={runTopics} disabled={!selected.length || anyRunning} style={btn(true, selected.length > 0 && !anyRunning)}>
              {topicsRun.status === "done" ? "Re-run extraction" : "Extract material topics"}
            </button>
            <RunStatus run={topicsRun} now={now} label="Topics" />
          </div>
          {topicsRun.status === "done" && topicsRun.data && (
            <Collapsible summary={`Peer topics table — ${topicsRun.data.topics?.length ?? 0} topics across ${(topicsRun.data.peers_covered ?? []).length} peers`}>
              <TopicsRunResult data={topicsRun.data} meta={topicsRun.meta ?? null} mode="run" />
            </Collapsible>
          )}
          {(topicsRun.data?.peers_missing?.length ?? 0) > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#a8710a" }}>
              No topics-extracted filing for: {topicsRun.data!.peers_missing!.join(", ")} — they still count in the
              &ldquo;of {selected.length} peers&rdquo; denominator.
            </div>
          )}
        </Card>
      )}

      {/* ---- Step 5 — distill ---- */}
      {topicsRun.status === "done" && (
        <Card>
          <StepHeader n={5} title="Distill the materiality long list" status={distillRun.status === "done" && !cohortStale ? "done" : undefined} note="collate · dedupe · normalize · distill to 20-25 topics" />
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={runDistill} disabled={frameworkRun.status !== "done" || anyRunning || cohortStale} style={btn(true, frameworkRun.status === "done" && !anyRunning && !cohortStale)}>
              {distillRun.status === "done" ? "Re-distill" : "Distill long list"}
            </button>
            <RunStatus run={distillRun} now={now} label="Long list" />
            {frameworkRun.status !== "done" && (
              <span style={{ fontSize: 12, color: "#a8710a" }}>waiting on the framework run — retry it in step 2</span>
            )}
            {cohortStale && <span style={{ fontSize: 12, color: "#a8710a" }}>re-run step 4 for the new cohort first</span>}
          </div>
          {distillRun.status === "done" && distillRun.data && (
            <LongListResult data={distillRun.data} meta={(distillRun.meta as LongListMeta) ?? null} />
          )}
        </Card>
      )}
    </div>
  );
}
