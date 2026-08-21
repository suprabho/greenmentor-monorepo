"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PeerRunResult, { type PeerResultData } from "./PeerRunResult";
import TopicsRunResult, { type TopicsResultData } from "./TopicsRunResult";

/**
 * Test bench tab for the Agent Studio — runs a package against the live runtime
 * without leaving the editor.
 *
 * peer-research gets a company picker over the BRSR corpus (the same filings
 * behind the BRSR intelligence reports) plus a free, no-LLM candidate preview;
 * peer-material-topics-extraction gets a multi-select cohort picker over the
 * same corpus (note: the picker lists profiled filings, while the topics tool
 * needs the topics stage — a picked company can still come back in
 * `peers_missing`); every other agent gets a JSON input box. All post to the
 * existing /api/agents/[key]/run demo path, which binds the app's callable-tool
 * handlers — so runs here are grounded, not stubbed.
 */

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";
const MUTED = "#8a958f";

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

const MAX_COHORT = 15;

export default function TestRunPanel({ agentKey }: { agentKey: string }) {
  const isPeer = agentKey === "peer-research";
  const isTopics = agentKey === "peer-material-topics-extraction";
  const usesPicker = isPeer || isTopics;

  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<CompanyItem | null>(null);
  const [cohort, setCohort] = useState<CompanyItem[]>([]);
  const [maxPeers, setMaxPeers] = useState(8);

  const [json, setJson] = useState("{\n  \n}");

  const [busy, setBusy] = useState<null | "run" | "preview">(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: PeerResultData; meta: RunMeta | null; mode: "run" | "preview" } | null>(null);
  const [topicsResult, setTopicsResult] = useState<{ data: TopicsResultData; meta: RunMeta | null; mode: "run" | "preview" } | null>(null);
  const [genericOut, setGenericOut] = useState<string | null>(null);

  // Company lookup, debounced. Runs once on mount too, so the picker opens with
  // a browsable list rather than an empty box.
  const loadCompanies = useCallback(async (q: string) => {
    setPicking(true);
    try {
      const res = await fetch(`/api/brsr/companies?q=${encodeURIComponent(q)}&limit=25`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setCompanies(data.companies ?? []);
      setError(null);
    } catch (e) {
      setCompanies([]);
      setError(e instanceof Error ? e.message : "company lookup failed");
    } finally {
      setPicking(false);
    }
  }, []);

  useEffect(() => {
    if (!usesPicker) return;
    const t = setTimeout(() => void loadCompanies(query), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [usesPicker, query, loadCompanies]);

  const addToCohort = (c: CompanyItem) =>
    setCohort((prev) =>
      prev.some((p) => p.symbol === c.symbol) || prev.length >= MAX_COHORT ? prev : [...prev, c],
    );
  const removeFromCohort = (symbol: string) =>
    setCohort((prev) => prev.filter((p) => p.symbol !== symbol));

  // Elapsed-seconds ticker while a run is in flight (a grounded run with web
  // search can take a minute — silence would read as a hang).
  const startedAt = useRef(0);
  useEffect(() => {
    if (!busy) return;
    startedAt.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const preview = async () => {
    if (isPeer ? !selected : !cohort.length) return;
    setBusy("preview");
    setError(null);
    setResult(null);
    setTopicsResult(null);
    try {
      const url = isPeer
        ? `/api/brsr/peer-preview?symbol=${encodeURIComponent(selected!.symbol)}`
        : `/api/brsr/topics-preview?symbols=${encodeURIComponent(cohort.map((c) => c.symbol).join(","))}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      if (isPeer) setResult({ data, meta: null, mode: "preview" });
      else setTopicsResult({ data, meta: null, mode: "preview" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "preview failed");
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    setBusy("run");
    setError(null);
    setResult(null);
    setTopicsResult(null);
    setGenericOut(null);
    const started = Date.now();
    try {
      let input: unknown;
      if (isPeer) {
        if (!selected) throw new Error("pick a company first");
        input = { company: { symbol: selected.symbol, name: selected.name }, max_peers: maxPeers };
      } else if (isTopics) {
        if (!cohort.length) throw new Error("pick at least one company first");
        input = { peers: cohort.map((c) => ({ symbol: c.symbol, name: c.name })) };
      } else {
        try {
          input = JSON.parse(json);
        } catch {
          throw new Error("input is not valid JSON");
        }
      }
      const res = await fetch(`/api/agents/${agentKey}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      const meta: RunMeta = {
        model: data?.meta?.model,
        stopReason: data?.meta?.stopReason ?? null,
        seconds: Math.round((Date.now() - started) / 1000),
      };
      if (isPeer) setResult({ data: data.output ?? {}, meta, mode: "run" });
      else if (isTopics) setTopicsResult({ data: data.output ?? {}, meta, mode: "run" });
      else setGenericOut(JSON.stringify(data.output ?? data, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "run failed");
    } finally {
      setBusy(null);
    }
  };

  const canRun = !busy && (isPeer ? !!selected : isTopics ? cohort.length > 0 : true);

  return (
    <div>
      {isPeer ? (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>
            Company — from the BRSR corpus
          </div>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            placeholder="Search by NSE symbol or company name…"
            style={{ width: "100%", boxSizing: "border-box", fontSize: 13.5, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fbfcfb", color: "#1a2420" }}
          />

          {selected ? (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, border: `1px solid ${ACCENT}55`, background: "#f2f8f5", borderRadius: 8, padding: "9px 12px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a2420" }}>
                  {selected.name} <span style={{ color: MUTED, fontWeight: 600, fontSize: 11.5 }}>{selected.symbol}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#5d6b64" }}>
                  {[selected.industry ?? selected.sector, selected.revenueInrCr != null ? `₹${selected.revenueInrCr.toLocaleString("en-IN")} cr` : null, `FY ${selected.fy}`]
                    .filter(Boolean)
                    .join(" · ")}
                  {!selected.hasMarketsData && (
                    <span title="No Section A markets data on this filing — the market dimension will come from web research" style={{ marginLeft: 6, color: "#a8710a" }}>
                      · no markets data
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ ...btn(false, true), padding: "5px 10px", fontSize: 12 }}>
                Change
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 8, maxHeight: 240, overflow: "auto", border: `1px solid ${BORDER}`, borderRadius: 8 }}>
              {picking && <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>Loading…</div>}
              {!picking && companies.length === 0 && (
                <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>
                  No profiled BRSR companies matched. The corpus is populated by the platform&apos;s
                  scrape worker (<code>brsr:scrape --stage=profile</code>).
                </div>
              )}
              {companies.map((c) => (
                <button
                  key={c.symbol}
                  onClick={() => setSelected(c)}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: `1px solid ${BORDER}`, padding: "9px 12px", cursor: "pointer" }}
                >
                  <div style={{ fontSize: 13, fontWeight: 650, color: "#1a2420" }}>
                    {c.name} <span style={{ color: MUTED, fontWeight: 600, fontSize: 11 }}>{c.symbol}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#5d6b64" }}>
                    {[c.industry ?? c.sector, c.revenueInrCr != null ? `₹${c.revenueInrCr.toLocaleString("en-IN")} cr` : null]
                      .filter(Boolean)
                      .join(" · ")}
                    {c.hasMarketsData && <span style={{ color: ACCENT }}> · markets ✓</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <label style={{ fontSize: 12.5, color: "#5d6b64", fontWeight: 600 }}>Max peers</label>
            <input
              type="number"
              min={1}
              max={15}
              value={maxPeers}
              onChange={(e) => setMaxPeers(Math.min(15, Math.max(1, Number(e.target.value) || 8)))}
              style={{ width: 64, fontSize: 13, padding: "6px 8px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "#fbfcfb" }}
            />
          </div>
        </>
      ) : isTopics ? (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>
            Peer cohort — from the BRSR corpus, up to {MAX_COHORT}
          </div>

          {cohort.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {cohort.map((c) => (
                <span
                  key={c.symbol}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#1a2420", background: "#f2f8f5", border: `1px solid ${ACCENT}55`, borderRadius: 7, padding: "4px 8px" }}
                >
                  {c.symbol}
                  <button
                    onClick={() => removeFromCohort(c.symbol)}
                    title={`Remove ${c.name}`}
                    style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by NSE symbol or company name, click to add…"
            style={{ width: "100%", boxSizing: "border-box", fontSize: 13.5, padding: "9px 12px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fbfcfb", color: "#1a2420" }}
          />

          <div style={{ marginTop: 8, maxHeight: 240, overflow: "auto", border: `1px solid ${BORDER}`, borderRadius: 8 }}>
            {picking && <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>Loading…</div>}
            {!picking && companies.length === 0 && (
              <div style={{ padding: 12, fontSize: 12.5, color: MUTED }}>
                No profiled BRSR companies matched. The corpus is populated by the platform&apos;s
                scrape worker (<code>brsr:scrape</code>); material topics need its <code>--stage=topics</code> pass.
              </div>
            )}
            {companies.map((c) => {
              const inCohort = cohort.some((p) => p.symbol === c.symbol);
              const full = !inCohort && cohort.length >= MAX_COHORT;
              return (
                <button
                  key={c.symbol}
                  onClick={() => (inCohort ? removeFromCohort(c.symbol) : addToCohort(c))}
                  disabled={full}
                  style={{ display: "block", width: "100%", textAlign: "left", background: inCohort ? "#f2f8f5" : "none", border: "none", borderBottom: `1px solid ${BORDER}`, padding: "9px 12px", cursor: full ? "not-allowed" : "pointer", opacity: full ? 0.5 : 1 }}
                >
                  <div style={{ fontSize: 13, fontWeight: 650, color: "#1a2420" }}>
                    {inCohort && <span style={{ color: ACCENT, marginRight: 6 }}>✓</span>}
                    {c.name} <span style={{ color: MUTED, fontWeight: 600, fontSize: 11 }}>{c.symbol}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#5d6b64" }}>
                    {[c.industry ?? c.sector, `FY ${c.fy}`].filter(Boolean).join(" · ")}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 8, fontSize: 11, color: MUTED }}>
            The picker lists profiled filings; a company whose filing hasn&apos;t had material topics
            extracted yet will come back under <code>peers_missing</code>.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: MUTED, textTransform: "uppercase", marginBottom: 6 }}>
            Input JSON — must match $defs.input on the I/O schema tab
          </div>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            style={{ width: "100%", height: 260, boxSizing: "border-box", resize: "vertical", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, lineHeight: 1.55, color: "#1a2420", background: "#fbfcfb", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14 }}
          />
        </>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={run} disabled={!canRun} style={btn(true, canRun)}>
          {busy === "run" ? `Running… ${elapsed}s` : "Run agent"}
        </button>
        {isPeer && (
          <button onClick={preview} disabled={!selected || !!busy} style={btn(false, !!selected && !busy)}>
            {busy === "preview" ? "Loading…" : "Preview candidates (no LLM)"}
          </button>
        )}
        {isTopics && (
          <button onClick={preview} disabled={!cohort.length || !!busy} style={btn(false, cohort.length > 0 && !busy)}>
            {busy === "preview" ? "Loading…" : "Preview disclosed topics (no LLM)"}
          </button>
        )}
        {busy === "run" && (
          <span style={{ fontSize: 12, color: MUTED }}>
            {isTopics ? "grounding + dedupe can take a minute" : "grounding + web research can take a minute"}
          </span>
        )}
        {error && <span style={{ fontSize: 12.5, fontWeight: 600, color: "#c2410c" }}>{error}</span>}
      </div>

      {result && <PeerRunResult data={result.data} meta={result.meta} mode={result.mode} />}
      {topicsResult && <TopicsRunResult data={topicsResult.data} meta={topicsResult.meta} mode={topicsResult.mode} />}
      {genericOut && (
        <pre style={{ marginTop: 14, background: "#f6f8f7", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14, fontSize: 12, lineHeight: 1.55, overflow: "auto", maxHeight: 520 }}>
          {genericOut}
        </pre>
      )}
    </div>
  );
}
