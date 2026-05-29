import { useState, useRef } from "react";
import { T, SS, pill, tag } from "../theme.js";
import { Btn } from "../components/ui.jsx";
import { ingestionApi, emptyMetadata, fieldValue } from "../lib/ingestion.js";

// ─────────────────────────────────────────────────────────────────────────────
// EMISSION-FACTOR INGESTION
// Drives the EFDB extraction pipeline against the /efdb backend:
//   upload → confirm-metadata → select sections → extracting → review → done
// Admin-only — requires the EFDB JWT obtained from Settings → "Log in to EFDB".
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const GWP_BASES        = ["AR4", "AR5", "AR6", "GWP20", "GWP100", "Not stated"];
const GEOGRAPHY_TYPES  = ["global", "national", "regional", "sub-national", "grid-zone"];
const SYSTEM_BOUNDARIES= ["gate-to-gate", "cradle-to-gate", "cradle-to-grave", "well-to-tank", "tank-to-wheel", "well-to-wheel", "use-phase"];
const CALC_METHODS     = ["fuel-based", "activity-based", "spend-based", "mass-balance", "supplier-specific", "average-data"];
const DATA_ORIGINS     = ["primary", "secondary"];

// Fields shown in the per-record inline edit panel (source-schema keys).
const EDIT_FIELDS = [
  { key: "activity_name",        label: "Activity name" },
  { key: "emission_category",    label: "Emission category" },
  { key: "sub_category",         label: "Sub-category" },
  { key: "ghg_scope",            label: "GHG scope (1/2/3)" },
  { key: "ef_value",             label: "EF value", type: "number" },
  { key: "ghg_species",          label: "GHG species" },
  { key: "numerator_unit",       label: "Numerator unit" },
  { key: "denominator_unit",     label: "Denominator unit" },
  { key: "country_iso",          label: "Country (ISO3)" },
  { key: "geography_type",       label: "Geography type" },
  { key: "reference_year",       label: "Reference year", type: "number" },
  { key: "valid_from",           label: "Valid from (YYYY-MM-DD)" },
  { key: "valid_to",             label: "Valid to (YYYY-MM-DD)" },
  { key: "gwp_basis",            label: "GWP basis" },
  { key: "source_organization",  label: "Source organization" },
  { key: "data_origin",          label: "Data origin" },
  { key: "calculation_method",   label: "Calc method" },
  { key: "system_boundary",      label: "System boundary" },
  { key: "notes",                label: "Notes" },
];

const STEPS = [
  { id: "confirm-metadata", label: "Confirm context" },
  { id: "selecting",        label: "Select sections" },
  { id: "extracting",       label: "Extracting" },
  { id: "review",           label: "Review" },
];

// Small labelled text/number/select input matching the dark theme.
function Field({ label, value, onChange, type = "text", options, placeholder, maxLength }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: T.dim, marginBottom: 4, fontFamily: T.mono }}>{label}</div>
      {options ? (
        <select style={{ ...SS.input, fontFamily: T.body }} value={value ?? ""} onChange={e => onChange(e.target.value || null)}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          style={SS.input}
          maxLength={maxLength}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={e => onChange(type === "number" ? (e.target.value !== "" ? Number(e.target.value) : null) : (e.target.value || null))}
        />
      )}
    </div>
  );
}

function MetadataForm({ m, set, clarifyingAnswers, onAnswer }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Source organization" value={m.source_organization} onChange={v => set({ source_organization: v })} placeholder="e.g. CEA / BEIS" />
        <Field label="Source database (optional)" value={m.source_database} onChange={v => set({ source_database: v })} placeholder="e.g. CO2 Baseline Database v19" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Publication year" type="number" value={m.publication_year} onChange={v => set({ publication_year: v })} placeholder="2023" />
        <Field label="Reference year (data)" type="number" value={m.reference_year} onChange={v => set({ reference_year: v })} placeholder="2023" />
        <Field label="Country (ISO-3)" value={m.country_iso} onChange={v => set({ country_iso: v ? v.toUpperCase() : null })} placeholder="IND" maxLength={3} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Valid from (YYYY-MM-DD)" value={m.valid_from} onChange={v => set({ valid_from: v })} placeholder="2023-01-01" />
        <Field label="Valid to (YYYY-MM-DD)" value={m.valid_to} onChange={v => set({ valid_to: v })} placeholder="open-ended" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="GWP basis" value={m.gwp_basis} onChange={v => set({ gwp_basis: v })} options={GWP_BASES} />
        <Field label="GHG scope" value={m.ghg_scope} onChange={v => set({ ghg_scope: v })} options={["1", "2", "3"]} />
        <Field label="Geography type" value={m.geography_type} onChange={v => set({ geography_type: v })} options={GEOGRAPHY_TYPES} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="System boundary" value={m.system_boundary} onChange={v => set({ system_boundary: v })} options={SYSTEM_BOUNDARIES} />
        <Field label="Calculation method" value={m.calculation_method} onChange={v => set({ calculation_method: v })} options={CALC_METHODS} />
        <Field label="Data origin" value={m.data_origin} onChange={v => set({ data_origin: v })} options={DATA_ORIGINS} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: T.dim, marginBottom: 4, fontFamily: T.mono }}>Notes (applied to every record)</div>
        <textarea style={{ ...SS.input, fontFamily: T.body, resize: "vertical", minHeight: 48 }} rows={2}
          value={m.notes ?? ""} placeholder="e.g. India only · Gross CV basis · Excludes biogenic CO₂"
          onChange={e => set({ notes: e.target.value || null })} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: T.dim, marginBottom: 4, fontFamily: T.mono }}>Guidance notes</div>
        <textarea style={{ ...SS.input, fontFamily: T.body, resize: "vertical", minHeight: 60 }} rows={3}
          value={m.guidance_notes ?? ""} placeholder="Free-form guidance for the extractor…"
          onChange={e => set({ guidance_notes: e.target.value || null })} />
      </div>

      {m.clarifying_questions && m.clarifying_questions.length > 0 && (
        <div style={{ ...SS.card, marginBottom: 0, background: T.infoBg, border: `1px solid ${T.infoLine}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.info, marginBottom: 4 }}>Claude has clarifying questions about this document</div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>Your answers are added as context for every extracted record.</div>
          {m.clarifying_questions.map((q, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: T.text, marginBottom: 4 }}>{q}</div>
              <textarea style={{ ...SS.input, fontFamily: T.body }} rows={2} value={clarifyingAnswers[i] ?? ""}
                placeholder="Your answer…" onChange={e => onAnswer(i, e.target.value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IngestEF({ efdbToken }) {
  const [step, setStep]                       = useState("upload");
  const [mode, setMode]                        = useState("file"); // file | url
  const [url, setUrl]                          = useState("");
  const [scan, setScan]                        = useState(null);
  const [meta, setMeta]                        = useState(emptyMetadata());
  const [clarifyingAnswers, setClarifyingAnswers] = useState({});
  const [selected, setSelected]                = useState([]);
  const [sessionStatus, setSessionStatus]      = useState(null);
  const [records, setRecords]                  = useState([]);
  const [reviewPage, setReviewPage]            = useState(1);
  const [totalRecords, setTotalRecords]        = useState(0);
  const [approved, setApproved]                = useState(new Set());
  const [rejected, setRejected]                = useState(new Set());
  const [editingIndex, setEditingIndex]        = useState(null);
  const [editDraft, setEditDraft]              = useState({});
  const [summary, setSummary]                  = useState(null);
  const [loading, setLoading]                  = useState(false);
  const [error, setError]                      = useState("");
  const pollRef = useRef(null);
  const fileRef = useRef(null);

  const setMetaPatch = patch => setMeta(prev => ({ ...prev, ...patch }));
  const totalPages   = Math.ceil(totalRecords / PAGE_SIZE) || 1;

  function resetAll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setStep("upload"); setMode("file"); setUrl(""); setScan(null);
    setMeta(emptyMetadata()); setClarifyingAnswers({}); setSelected([]);
    setSessionStatus(null); setRecords([]); setReviewPage(1); setTotalRecords(0);
    setApproved(new Set()); setRejected(new Set()); setEditingIndex(null);
    setEditDraft({}); setSummary(null); setError("");
  }

  function applyScan(result) {
    setScan(result);
    // Auto-select data sheets, skip cover/notes pages (read for metadata only)
    setSelected(result.sections_found.filter(s => s.page_range !== "cover/notes").map(s => s.index));
    setMeta(result.document_metadata ? { ...emptyMetadata(), ...result.document_metadata } : emptyMetadata());
    setClarifyingAnswers({});
    setStep("confirm-metadata");
  }

  async function handleFileUpload(file) {
    if (!file) return;
    setLoading(true); setError("");
    try { applyScan(await ingestionApi.uploadAndScan(efdbToken, file)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleUrlScan() {
    if (!url.trim()) return;
    setLoading(true); setError("");
    try { applyScan(await ingestionApi.urlScan(efdbToken, url.trim())); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Fold clarifying-question answers into guidance_notes before extraction.
  function buildFinalMetadata() {
    const questions = meta.clarifying_questions ?? [];
    const qa = questions
      .map((q, i) => clarifyingAnswers[i]?.trim() ? `Q: ${q}\nA: ${clarifyingAnswers[i].trim()}` : null)
      .filter(Boolean);
    if (qa.length === 0) return meta;
    const combined = [meta.guidance_notes ?? "", "---", ...qa].filter(Boolean).join("\n");
    return { ...meta, guidance_notes: combined };
  }

  async function handleStartExtraction() {
    if (!scan || selected.length === 0) return;
    setLoading(true); setError("");
    try {
      await ingestionApi.startExtraction(efdbToken, scan.session_id, selected, buildFinalMetadata());
      setStep("extracting");
      pollRef.current = setInterval(async () => {
        try {
          const status = await ingestionApi.getSession(efdbToken, scan.session_id);
          setSessionStatus(status);
          if (status.status === "in_review") {
            clearInterval(pollRef.current); pollRef.current = null;
            await loadReviewPage(1);
            setStep("review");
          } else if (status.status === "failed") {
            clearInterval(pollRef.current); pollRef.current = null;
            setError(status.error_message || "Extraction failed");
            setStep("selecting");
          }
        } catch (e) {
          clearInterval(pollRef.current); pollRef.current = null;
          setError(e.message); setStep("selecting");
        }
      }, 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadReviewPage(page) {
    if (!scan) return;
    const data = await ingestionApi.getRecords(efdbToken, scan.session_id, page, PAGE_SIZE);
    setRecords(data.records || []);
    setTotalRecords(data.total || 0);
    setReviewPage(page);
  }

  async function toggleApprove(index) {
    if (!scan) return;
    if (approved.has(index)) {
      await ingestionApi.reviewRecord(efdbToken, scan.session_id, index, "pending");
      setApproved(prev => { const s = new Set(prev); s.delete(index); return s; });
    } else {
      await ingestionApi.reviewRecord(efdbToken, scan.session_id, index, "approve");
      setApproved(prev => new Set(prev).add(index));
      setRejected(prev => { const s = new Set(prev); s.delete(index); return s; });
    }
  }

  async function toggleReject(index) {
    if (!scan) return;
    if (rejected.has(index)) {
      await ingestionApi.reviewRecord(efdbToken, scan.session_id, index, "pending");
      setRejected(prev => { const s = new Set(prev); s.delete(index); return s; });
    } else {
      await ingestionApi.reviewRecord(efdbToken, scan.session_id, index, "reject");
      setRejected(prev => new Set(prev).add(index));
      setApproved(prev => { const s = new Set(prev); s.delete(index); return s; });
    }
  }

  async function handleBulkApprove() {
    if (!scan) return;
    setLoading(true); setError("");
    try {
      await ingestionApi.bulkReview(efdbToken, scan.session_id, "approve_all");
      setApproved(new Set(Array.from({ length: totalRecords }, (_, i) => i)));
      setRejected(new Set());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleCommit() {
    if (!scan) return;
    setLoading(true); setError("");
    try {
      setSummary(await ingestionApi.commit(efdbToken, scan.session_id));
      setStep("done");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function openEdit(absIndex, record) {
    const draft = {};
    for (const [k, entry] of Object.entries(record)) draft[k] = fieldValue(entry);
    setEditDraft(draft);
    setEditingIndex(absIndex);
  }

  async function saveEdit(absIndex, andApprove) {
    if (!scan) return;
    setLoading(true); setError("");
    try {
      await ingestionApi.reviewRecord(efdbToken, scan.session_id, absIndex, andApprove ? "approve" : "pending", editDraft);
      if (andApprove) {
        setApproved(prev => new Set(prev).add(absIndex));
        setRejected(prev => { const s = new Set(prev); s.delete(absIndex); return s; });
      }
      await loadReviewPage(reviewPage);
      setEditingIndex(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  // ── Auth gate ───────────────────────────────────────────────────────────
  if (!efdbToken) {
    return (
      <div style={{ ...SS.card, textAlign: "center", padding: "44px 22px" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: T.head, marginBottom: 6 }}>EFDB admin login required</div>
        <div style={{ fontSize: 12, color: T.muted, maxWidth: 440, margin: "0 auto", lineHeight: 1.7 }}>
          Emission-factor ingestion writes to the EFDB and is admin-only. Log in to EFDB on the
          <b style={{ color: T.accent }}> Settings</b> page, then return here.
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Step indicator */}
      {step !== "upload" && step !== "done" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          {STEPS.map((s, i) => {
            const currentIdx = STEPS.findIndex(x => x.id === step);
            const isActive = s.id === step, isDone = i < currentIdx;
            return (
              <span key={s.id} style={pill(
                isActive ? T.accentGlow : "transparent",
                isActive ? T.accent : isDone ? T.muted : T.dim,
                { fontSize: 11, border: `1px solid ${isActive ? T.accent : T.line}` },
              )}>{i + 1}. {s.label}</span>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ ...SS.card, marginBottom: 14, background: T.dangerBg, border: `1px solid ${T.dangerLine}`, color: T.danger, fontSize: 12, fontFamily: T.mono }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <div style={SS.card}>
          <div style={SS.label}>Ingest emission factors</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 16, lineHeight: 1.7 }}>
            Upload a source document (PDF, Excel, or CSV) or paste a public URL. Claude scans it for
            emission-factor tables, you confirm the document context, then review every extracted record
            before it is committed to EFDB.
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["file", "url"].map(mInner => (
              <Btn key={mInner} sz="sm" v={mode === mInner ? "primary" : "ghost"} onClick={() => setMode(mInner)}>
                {mInner === "file" ? "↑ File" : "🔗 URL"}
              </Btn>
            ))}
          </div>

          {mode === "file" ? (
            <div
              style={{ ...SS.card, marginBottom: 0, border: `2px dashed ${T.line}`, textAlign: "center", padding: "36px 20px", cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}
              onClick={() => !loading && fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv" style={{ display: "none" }} disabled={loading} onChange={e => handleFileUpload(e.target.files[0])} />
              {loading ? (
                <>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.accent, margin: "0 auto 10px", animation: "pulse 1s infinite" }} />
                  <div style={{ fontSize: 13, color: T.accent, fontFamily: T.mono }}>Scanning document…</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>↑</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: T.head, marginBottom: 6 }}>Click to upload a source</div>
                  <div style={{ fontSize: 12, color: T.muted }}>PDF · Excel (.xlsx) · CSV</div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input style={SS.input} value={url} placeholder="https://cea.nic.in/…/co2-baseline-database.pdf" onChange={e => setUrl(e.target.value)} />
              <Btn disabled={loading || !url.trim()} onClick={handleUrlScan}>{loading ? "Scanning…" : "Scan URL"}</Btn>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Confirm document metadata ── */}
      {step === "confirm-metadata" && scan && (
        <div style={SS.card}>
          <div style={SS.label}>Confirm document context</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 16, lineHeight: 1.7 }}>
            Claude auto-detected the following from the document. Review and correct any value — these are
            applied to <b style={{ color: T.text }}>every extracted record</b>.
          </div>
          <MetadataForm m={meta} set={setMetaPatch} clarifyingAnswers={clarifyingAnswers}
            onAnswer={(i, v) => setClarifyingAnswers(prev => ({ ...prev, [i]: v }))} />
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Btn onClick={() => setStep("selecting")}>Confirm &amp; select sections →</Btn>
            <Btn v="ghost" onClick={resetAll}>Cancel</Btn>
          </div>
        </div>
      )}

      {/* ── Step 3: Select sections ── */}
      {step === "selecting" && scan && (
        <div style={SS.card}>
          <div style={SS.label}>Select sections to extract</div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
            {scan.page_count} pages · {scan.sections_found.length} section{scan.sections_found.length !== 1 ? "s" : ""} found
            {scan.has_scanned_pages && " · contains scanned (image) pages"}
          </div>

          <div style={{ ...SS.card, marginBottom: 14, background: T.warnBg, border: `1px solid ${T.warnLine}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: T.warn, fontSize: 14 }}>⚠</span>
            <div style={{ fontSize: 12 }}>
              <b style={{ color: T.warn }}>Estimated cost: ~${scan.estimated_cost_usd.toFixed(2)}</b>
              <span style={{ color: T.muted, marginLeft: 8 }}>(~{scan.estimated_tokens.toLocaleString()} tokens)</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scan.sections_found.map(section => {
              const isCover = section.page_range === "cover/notes";
              const checked = selected.includes(section.index);
              return (
                <div key={section.index}
                  style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 7, border: `1px solid ${checked && !isCover ? T.accent : T.line}`, background: checked && !isCover ? T.accentGlow : "transparent", opacity: isCover ? 0.6 : 1, cursor: isCover ? "default" : "pointer" }}
                  onClick={() => {
                    if (isCover) return;
                    setSelected(prev => prev.includes(section.index) ? prev.filter(i => i !== section.index) : [...prev, section.index]);
                  }}>
                  {!isCover && <input type="checkbox" checked={checked} readOnly style={{ marginTop: 3, accentColor: T.accent }} />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{section.title}</span>
                      {isCover
                        ? <span style={tag(T.warnBg, T.warn)}>Cover / Notes — metadata only</span>
                        : <>
                            <span style={{ fontSize: 11, color: T.dim, fontFamily: T.mono }}>{section.page_range}</span>
                            {section.row_count_estimate > 0 && <span style={tag(T.infoBg, T.info)}>~{section.row_count_estimate} rows</span>}
                          </>}
                    </div>
                    {!isCover && section.description && <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{section.description}</div>}
                    {!isCover && section.column_headers.length > 0 && (
                      <div style={{ fontSize: 10, color: T.dim, marginTop: 3, fontFamily: T.mono }}>Columns: {section.column_headers.join(", ")}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Btn disabled={selected.length === 0 || loading} onClick={handleStartExtraction}>
              {loading ? "Starting…" : `Extract ${selected.length} section${selected.length !== 1 ? "s" : ""}`}
            </Btn>
            <Btn v="ghost" onClick={() => setStep("confirm-metadata")}>← Back</Btn>
          </div>
        </div>
      )}

      {/* ── Step 4: Extracting ── */}
      {step === "extracting" && (
        <div style={{ ...SS.card, textAlign: "center", padding: "48px 22px" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.accent, margin: "0 auto 14px", animation: "pulse 1s infinite" }} />
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: T.head, marginBottom: 6 }}>Extracting emission factors…</div>
          <div style={{ fontSize: 12, color: T.muted }}>Claude is reading the document. Large files can take a few minutes.</div>
          {sessionStatus && <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 10 }}>status: {sessionStatus.status}</div>}
        </div>
      )}

      {/* ── Step 5: Review ── */}
      {step === "review" && (
        <>
          <div style={{ ...SS.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: T.head }}>Review extracted records</div>
              <div style={{ fontSize: 11, color: T.dim, fontFamily: T.mono, marginTop: 3 }}>
                {totalRecords} extracted · {approved.size} approved · {rejected.size} rejected · page {reviewPage}/{totalPages}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn sz="sm" v="ghost" disabled={loading} onClick={handleBulkApprove}>{loading ? "Approving…" : "Approve all"}</Btn>
              <Btn sz="sm" disabled={loading || approved.size === 0} onClick={handleCommit}>{loading ? "Committing…" : `Commit ${approved.size} records`}</Btn>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {records.map((record, i) => {
              const absIndex = (reviewPage - 1) * PAGE_SIZE + i;
              const isApproved = approved.has(absIndex), isRejected = rejected.has(absIndex);
              const fld = k => fieldValue(record[k]);
              const efRaw = fld("ef_value");
              const efNum = efRaw == null || efRaw === "" || isNaN(Number(efRaw)) ? null : Number(efRaw);
              const numUnit = fld("numerator_unit"), denUnit = fld("denominator_unit");
              const border = isApproved ? T.accent : isRejected ? T.danger : T.border;
              const bg     = isApproved ? T.accentGlow : isRejected ? T.dangerBg : T.card;

              return (
                <div key={absIndex} style={{ ...SS.card, marginBottom: 0, border: `1px solid ${border}`, background: bg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{fld("activity_name") ?? "—"}</span>
                        {record.has_outlier_values && <span style={tag(T.warnBg, T.warn)}>Outlier value</span>}
                        {record.has_unit_mismatch && <span style={tag(T.warnBg, T.warn)}>Unit mismatch</span>}
                        {efNum == null && <span style={tag(T.dangerBg, T.danger)}>No EF value</span>}
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
                        <span style={{ fontFamily: T.mono, fontWeight: 700, color: efNum != null ? T.text : T.dim }}>{efNum != null ? efNum.toFixed(6) : "—"}</span>
                        {fld("ghg_species") && <span style={{ color: T.muted }}>{fld("ghg_species")}</span>}
                        {(numUnit || denUnit) && <span style={{ color: T.muted }}>{numUnit ?? "?"} / {denUnit ?? "?"}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        {fld("country_iso") && <span style={tag(T.infoBg, T.info)}>{fld("country_iso")}</span>}
                        {fld("ghg_scope") && <span style={tag(T.infoBg, T.info)}>Scope {fld("ghg_scope")}</span>}
                        {fld("gwp_basis") && <span style={tag(T.warnBg, T.warn)}>{fld("gwp_basis")}</span>}
                        {fld("emission_category") && <span style={tag(T.successBg, T.accent)}>{fld("emission_category")}</span>}
                        {fld("reference_year") && <span style={{ fontSize: 10, color: T.dim, fontFamily: T.mono }}>{fld("reference_year")}</span>}
                        {fld("source_organization") && <span style={{ fontSize: 10, color: T.dim }}>· {fld("source_organization")}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <Btn sz="sm" v="ghost" onClick={() => editingIndex === absIndex ? setEditingIndex(null) : openEdit(absIndex, record)}>
                        {editingIndex === absIndex ? "Close" : "Edit"}
                      </Btn>
                      <Btn sz="sm" v={isApproved ? "primary" : "ghost"} onClick={() => toggleApprove(absIndex)}>{isApproved ? "✓ Approved" : "Approve"}</Btn>
                      <Btn sz="sm" v={isRejected ? "danger" : "ghost"} onClick={() => toggleReject(absIndex)}>{isRejected ? "✗ Rejected" : "Reject"}</Btn>
                    </div>
                  </div>

                  {editingIndex === absIndex && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 320, overflow: "auto", paddingRight: 4 }}>
                        {EDIT_FIELDS.map(({ key, label, type }) => (
                          <Field key={key} label={label} type={type} value={editDraft[key] ?? null}
                            onChange={v => setEditDraft(prev => ({ ...prev, [key]: v }))} />
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <Btn sz="sm" disabled={loading} onClick={() => saveEdit(absIndex, true)}>{loading ? "Saving…" : "✓ Save & Approve"}</Btn>
                        <Btn sz="sm" v="ghost" disabled={loading} onClick={() => saveEdit(absIndex, false)}>Save only</Btn>
                        <Btn sz="sm" v="ghost" onClick={() => setEditingIndex(null)}>Cancel</Btn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 14 }}>
              <Btn sz="sm" v="ghost" disabled={reviewPage <= 1} onClick={() => loadReviewPage(reviewPage - 1)}>← Prev</Btn>
              <span style={{ fontSize: 12, color: T.muted, fontFamily: T.mono }}>page {reviewPage} / {totalPages}</span>
              <Btn sz="sm" v="ghost" disabled={reviewPage >= totalPages} onClick={() => loadReviewPage(reviewPage + 1)}>Next →</Btn>
            </div>
          )}
        </>
      )}

      {/* ── Step 6: Done ── */}
      {step === "done" && summary && (
        <div style={{ ...SS.card, textAlign: "center", padding: "40px 22px" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: T.head, marginBottom: 16 }}>Import complete</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 18 }}>
            {[["Committed", summary.approved, T.accent, T.successBg], ["Rejected", summary.rejected, T.danger, T.dangerBg], ["Conflicts", summary.conflicts_flagged, T.warn, T.warnBg]].map(([label, n, c, bg]) => (
              <div key={label} style={{ padding: "14px 22px", borderRadius: 8, background: bg, border: `1px solid ${c}33` }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: c, fontFamily: T.head }}>{n}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          {summary.conflicts_flagged > 0 && (
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 16 }}>
              {summary.conflicts_flagged} conflict{summary.conflicts_flagged !== 1 ? "s" : ""} flagged — review in the EFDB database.
            </div>
          )}
          <Btn onClick={resetAll}>Ingest another document</Btn>
        </div>
      )}
    </>
  );
}
