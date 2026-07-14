// 2-page A4 HTML for the ESG Readiness PDF (Doc 4). Self-contained inline CSS so
// the same markup renders identically in Playwright (pdf.ts) and, if ever
// needed, an in-app preview. Brand: GreenMentor green #009C62, teal #014A50.

import type { ReportModel } from "./payload";

const GREEN = "#009C62";
const TEAL = "#014A50";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const ICON: Record<string, { glyph: string; color: string }> = {
  filled_green: { glyph: "●", color: GREEN },
  filled_amber: { glyph: "●", color: "#FFB020" },
  half_grey: { glyph: "◐", color: "#878787" },
  empty_grey: { glyph: "○", color: "#C0C0C0" },
};

const BAND_COLOR: Record<string, string> = {
  red: "#CF222E",
  amber: "#FFB020",
  "yellow-green": "#07D862",
  green: GREEN,
};

function frameworkRow(f: ReportModel["frameworks"][number]): string {
  const icon = ICON[f.icon] ?? ICON.empty_grey;
  const conf = f.label === "Doesn't apply currently" ? `${f.confidence}%` : `${f.confidence}% confidence`;
  return `
    <div class="fw">
      <div class="fw-head">
        <span class="fw-name"><span style="color:${icon.color}">${icon.glyph}</span> ${esc(f.name)}</span>
        <span class="fw-label">${esc(f.label)} (${conf})</span>
      </div>
      <div class="fw-why">${esc(f.whyText)}</div>
    </div>`;
}

function subareaBar(s: ReportModel["readiness"]["subareas"][number]): string {
  const pct = Math.round((s.score / s.max) * 100);
  return `
    <div class="sa">
      <span class="sa-label">${esc(s.label)}</span>
      <span class="sa-track"><span class="sa-fill" style="width:${pct}%"></span></span>
      <span class="sa-score">${s.score} / ${s.max}</span>
    </div>`;
}

function peerBlock(p: ReportModel["peerBenefits"][number]): string {
  return `
    <div class="peer">
      <div class="peer-cat">${esc(p.label)}:</div>
      <div class="peer-body">${esc(p.body)} <span class="cite">[${esc(p.citation)}]</span></div>
    </div>`;
}

export function reportHTML(m: ReportModel): string {
  const bandColor = BAND_COLOR[m.readiness.bandColor] ?? GREEN;
  const bp = m.bestPractices
    .map(
      (b) =>
        `<li>${esc(b.text)} <span class="cite">[${esc(b.citation)}]</span></li>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #1E1E1E; font-size: 10.5px; line-height: 1.45; margin: 0; }
  .page { padding: 0; }
  .page + .page { page-break-before: always; }
  h1,h2,h3 { margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${TEAL}; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { font-weight: 800; font-size: 14px; color: ${TEAL}; }
  .title { text-align: right; }
  .title .t { font-weight: 700; font-size: 12px; color: ${TEAL}; letter-spacing: .04em; }
  .meta { text-align: right; font-size: 9.5px; color: #5D5D5D; margin-top: 4px; }
  .meta b { color: #1E1E1E; font-weight: 600; }
  .sec-h { font-size: 11.5px; font-weight: 700; color: ${TEAL}; letter-spacing: .04em; text-transform: uppercase; margin: 14px 0 8px; }
  .fw { margin-bottom: 8px; }
  .fw-head { display: flex; justify-content: space-between; align-items: baseline; }
  .fw-name { font-weight: 600; font-size: 11px; }
  .fw-label { font-size: 10px; color: #5D5D5D; }
  .fw-why { font-size: 9.5px; color: #5D5D5D; margin-top: 1px; padding-left: 14px; }
  .readiness-head { display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px; }
  .band { font-weight: 700; font-size: 13px; color: ${bandColor}; }
  .total { font-weight: 700; font-size: 13px; }
  .sa { display: flex; align-items: center; gap: 8px; margin: 5px 0; }
  .sa-label { width: 130px; font-size: 10px; }
  .sa-track { flex: 1; height: 7px; background: #E9E9E9; border-radius: 4px; overflow: hidden; }
  .sa-fill { display: block; height: 100%; background: ${GREEN}; border-radius: 4px; }
  .sa-score { width: 52px; text-align: right; font-size: 9.5px; color: #5D5D5D; }
  .wtm { font-size: 10px; margin-top: 6px; }
  .bp { margin: 0; padding-left: 16px; }
  .bp li { margin-bottom: 5px; font-size: 10px; }
  .cite { color: #878787; font-size: 8.5px; }
  .peer { margin-bottom: 7px; }
  .peer-cat { font-weight: 600; font-size: 10px; }
  .peer-body { font-size: 9.5px; color: #333; }
  .gm { background: #ECFCEA; border-radius: 8px; padding: 12px 14px; margin-top: 10px; }
  .gm p { margin: 0 0 6px; font-size: 9.5px; }
  .gm ul { margin: 6px 0; padding-left: 16px; }
  .gm li { font-size: 9.5px; margin-bottom: 3px; }
  .cta { display: inline-block; margin-top: 6px; font-weight: 700; color: ${TEAL}; font-size: 10px; }
  .foot { margin-top: 12px; border-top: 1px solid #E2E8F0; padding-top: 6px; font-size: 9px; color: #878787; }
</style></head>
<body>
  <!-- PAGE 1 — Applicability & Readiness -->
  <div class="page">
    <div class="header">
      <div class="brand">GreenMentor</div>
      <div>
        <div class="title"><span class="t">YOUR ESG READINESS REPORT</span></div>
        <div class="meta">
          <div>Prepared for: <b>${esc(m.companyName)}</b></div>
          <div>Sector: ${esc(m.sector)} · ${esc(m.subsector)}</div>
          <div>Turnover band: ${esc(m.turnoverBand)}</div>
          <div>Date: ${esc(m.reportDate)}</div>
        </div>
      </div>
    </div>

    <div class="sec-h">Framework Applicability</div>
    ${m.frameworks.map(frameworkRow).join("")}

    <div class="readiness-head">
      <span class="sec-h" style="margin:14px 0 8px">Readiness</span>
      <span><span class="band">${esc(m.readiness.bandName)}</span> &nbsp; <span class="total">${m.readiness.totalScore} / ${m.readiness.maxScore}</span></span>
    </div>
    ${m.readiness.subareas.map(subareaBar).join("")}

    <div class="sec-h" style="margin-top:12px">What this means</div>
    <div class="wtm">${esc(m.readiness.whatThisMeans)}</div>
  </div>

  <!-- PAGE 2 — Best Practices, Peer Benefits, How GreenMentor Can Help -->
  <div class="page">
    <div class="header">
      <div class="brand">GreenMentor</div>
      <div class="title"><span class="t">YOUR ESG READINESS REPORT · p 2</span><div class="meta"><b>${esc(m.companyName)}</b></div></div>
    </div>

    ${
      bp
        ? `<div class="sec-h">Best Practices for Your Sector</div>
    <p style="font-size:10px;margin:0 0 6px">Companies in ${esc(m.sector)} at the "${esc(m.readiness.bandName)}" stage typically focus on:</p>
    <ul class="bp">${bp}</ul>`
        : ""
    }

    ${
      m.peerBenefits.length
        ? `<div class="sec-h">How ESG-Ready Peers in Your Sector Benefit</div>
    ${m.peerBenefits.map(peerBlock).join("")}`
        : ""
    }

    <div class="sec-h">How GreenMentor Can Help</div>
    <div class="gm">
      <p>GreenMentor is an end-to-end sustainability ecosystem for mid-market and SME companies in India.</p>
      <ul>
        <li><b>Advisory</b> — Scoping, materiality, target-setting, data validation</li>
        <li><b>Software (LongSight)</b> — Modular ESG data platform. BRSR Core, BRSR, GRI, SASB, supplier questionnaires. White-label option for consulting firms.</li>
        <li><b>Training (Green Academy)</b> — Live &amp; recorded: GHG accounting, BRSR fundamentals, CBAM for exporters, ESG for boards</li>
        <li><b>Community</b> — 2,000+ ESG professionals network, 50+ specialists on demand</li>
      </ul>
      <p>Pricing and scope depend on your size, sector, and timelines — happy to walk through specifics on a short call.</p>
      <span class="cta">[ Book a 20-min walkthrough — calendly.com/greenmentor ]</span>
      <p style="margin-top:6px">Or we'll reach out at the number you provided within 3 business days.</p>
    </div>

    <div class="foot">sustainability@greenmentor.co · greenmentor.co</div>
  </div>
</body></html>`;
}
