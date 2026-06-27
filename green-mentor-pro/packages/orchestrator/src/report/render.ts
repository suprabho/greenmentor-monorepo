import { mdToSafeHtml, esc } from "./markdown";
import type { BrsrReportModel, Disclosure, PrincipleBlock } from "./types";

/**
 * Single source of truth for the report HTML — used by BOTH the in-app view and the
 * PDF export, so they can never disagree (the community-engine render.ts lesson).
 * `brsrReportBodyHtml` returns the styled inner markup (with a scoped <style>);
 * `brsrDocumentHTML` wraps it in a full print-ready document.
 */

const REPORT_CSS = `
.gm-report { --accent:#1f8a5b; --ink:#1a2420; --sub:#5d6b64; --border:#e3e8e5; color:var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height:1.55; }
.gm-report h1 { font-size:26px; margin:0 0 4px; }
.gm-report h2.section { font-size:20px; margin:28px 0 10px; padding-bottom:6px; border-bottom:2px solid var(--accent); }
.gm-report h3 { font-size:15.5px; margin:18px 0 6px; }
.gm-report .muted { color:var(--sub); font-size:13px; }
.gm-report table { border-collapse:collapse; width:100%; margin:10px 0; font-size:13px; }
.gm-report th, .gm-report td { border:1px solid var(--border); padding:7px 9px; text-align:left; vertical-align:top; }
.gm-report th { background:#f6f8f7; font-weight:650; }
.gm-report .cards { display:flex; flex-wrap:wrap; gap:10px; margin:12px 0; }
.gm-report .card { border:1px solid var(--border); border-radius:10px; padding:12px 14px; min-width:150px; }
.gm-report .card .k { font-size:12px; color:var(--sub); }
.gm-report .card .v { font-size:20px; font-weight:750; margin-top:3px; }
.gm-report .chip { display:inline-block; font-size:11.5px; font-weight:650; color:var(--accent); background:#e6f4ec; border-radius:6px; padding:2px 7px; margin-right:6px; }
.gm-report .disclosure { border:1px solid var(--border); border-radius:10px; padding:12px 14px; margin:10px 0; break-inside:avoid; }
.gm-report .disclosure .ans { margin-top:6px; }
.gm-report .aside { font-size:12.5px; color:var(--sub); margin-top:6px; }
.gm-report .body :is(h2,h3,h4) { font-size:15px; }
.gm-report ul, .gm-report ol { margin:6px 0 6px 18px; }
`;

function metricCards(m: BrsrReportModel): string {
  if (!m.cover.headlineMetrics.length) return "";
  const cards = m.cover.headlineMetrics
    .map((h) => `<div class="card"><div class="k">${esc(h.label)}</div><div class="v">${esc(h.value)}${h.unit ? ` <span style="font-size:13px;color:var(--sub)">${esc(h.unit)}</span>` : ""}</div>${h.yoy_change ? `<div class="muted">YoY ${esc(h.yoy_change)}</div>` : ""}</div>`)
    .join("");
  const highlights = m.cover.highlights.length
    ? `<ul>${m.cover.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>`
    : "";
  return `<h2 class="section">Executive Summary</h2><div class="cards">${cards}</div>${highlights}`;
}

function sectionsHtml(m: BrsrReportModel): string {
  return m.sections
    .map((s) => `<h2 class="section">${esc(s.title)}</h2><div class="body">${mdToSafeHtml(s.body_markdown)}</div>`)
    .join("");
}

function disclosureHtml(d: Disclosure): string {
  return `<div class="disclosure">
    <div><span class="chip">${esc(d.code || d.question_id || "Disclosure")}</span>${d.status ? `<span class="muted">${esc(d.status)}</span>` : ""}</div>
    <div class="ans body">${mdToSafeHtml(d.answer)}</div>
    ${d.comment ? `<div class="aside"><strong>Comment:</strong> ${esc(d.comment)}</div>` : ""}
    ${d.note ? `<div class="aside"><strong>Note:</strong> ${esc(d.note)}</div>` : ""}
  </div>`;
}

function principleHtml(p: PrincipleBlock): string {
  const ess = p.essential.length ? `<h3>Essential Indicators</h3>${p.essential.map(disclosureHtml).join("")}` : "";
  const lead = p.leadership.length ? `<h3>Leadership Indicators</h3>${p.leadership.map(disclosureHtml).join("")}` : "";
  return `<h3 style="margin-top:20px">Principle ${p.principle} — ${esc(p.title)}</h3>${ess}${lead}`;
}

function sectionCHtml(m: BrsrReportModel): string {
  if (!m.principles.length && !m.otherDisclosures.length) return "";
  const principles = m.principles.map(principleHtml).join("");
  const other = m.otherDisclosures.length
    ? `<h3 style="margin-top:20px">Additional framework disclosures</h3>${m.otherDisclosures.map(disclosureHtml).join("")}`
    : "";
  return `<h2 class="section">Section C — Principle-wise Performance</h2>${principles}${other}`;
}

function kpiHtml(m: BrsrReportModel): string {
  const scopeRows = m.scopeTotals
    ? Object.entries(m.scopeTotals).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v == null ? "—" : esc(v)}</td></tr>`).join("")
    : "";
  const kpiRows = m.kpis.map((k) => `<tr><td>${esc(k.label)}</td><td>${esc(k.value)}${k.unit ? ` ${esc(k.unit)}` : ""}</td><td>${esc(k.confidence ?? "—")}</td></tr>`).join("");
  if (!kpiRows && !scopeRows) return "";
  return `<h2 class="section">Key Metrics</h2>
    ${kpiRows ? `<table><thead><tr><th>KPI</th><th>Value</th><th>Confidence</th></tr></thead><tbody>${kpiRows}</tbody></table>` : ""}
    ${scopeRows ? `<h3>GHG emissions (tCO₂e basis, kg)</h3><table><thead><tr><th>Scope</th><th>Value (kg CO₂e)</th></tr></thead><tbody>${scopeRows}</tbody></table>` : ""}`;
}

function methodologyHtml(m: BrsrReportModel): string {
  const assumptions = m.assumptions.length ? `<h3>Assumptions & Limitations</h3><ul>${m.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : "";
  const issues = m.consistencyIssues.length
    ? `<h3>Consistency review</h3><table><thead><tr><th>Where</th><th>Finding</th><th>Severity</th></tr></thead><tbody>${m.consistencyIssues.map((i) => `<tr><td>${esc(i.where)}</td><td>${esc(i.finding)}</td><td>${esc(i.severity)}</td></tr>`).join("")}</tbody></table>`
    : "";
  if (!assumptions && !issues) return "";
  return `<h2 class="section">Methodology & Assurance Notes</h2>${assumptions}${issues}`;
}

export function brsrReportBodyHtml(m: BrsrReportModel): string {
  const header = `<h1>${esc(m.meta.clientName)}</h1>
    <div class="muted">Business Responsibility & Sustainability Report · ${esc(m.meta.financialYear)} · ${m.meta.frameworks.map(esc).join(", ")}${m.meta.generatedAt ? ` · generated ${esc(m.meta.generatedAt)}` : ""}</div>`;
  return `<style>${REPORT_CSS}</style><div class="gm-report">${header}${metricCards(m)}${sectionsHtml(m)}${sectionCHtml(m)}${kpiHtml(m)}${methodologyHtml(m)}</div>`;
}

const PRINT_CSS = `
@page { size: A4; margin: 18mm 16mm 20mm; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
.gm-report h2.section { break-before: page; }
.gm-report h2.section:first-of-type { break-before: avoid; }
.gm-report table, .gm-report tr, .gm-report .disclosure, .gm-report .card { break-inside: avoid; }
`;

export function brsrDocumentHTML(m: BrsrReportModel): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>BRSR Report — ${esc(m.meta.clientName)}</title>
<style>${PRINT_CSS}</style>
</head><body>${brsrReportBodyHtml(m)}</body></html>`;
}
