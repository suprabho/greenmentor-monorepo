// Why-text templates + the "what this means" composer for the PDF (Doc 4).
//
// WHY_TEXT is keyed by the rule ID the engine records (applicability.ts). The
// copy is derived from the rule "Result" language in Doc 6 Part 1 — one entry
// per rule, ~30 total. The three append sentences (Q18 boost, CBAM softening,
// CCTS caveat) are added conditionally by buildWhyText(). Content is placeholder-
// quality authored copy; the review workflow can refine it later without touching
// the engine.

import type { FrameworkResult, ReadinessResult, SubAreaKey } from "./types";
import { SUBAREA_LABELS } from "./types";

export const WHY_TEXT: Record<string, string> = {
  // BRSR (full)
  "BRSR-1": "As a listed company in the top 1,000 by market cap, BRSR is a mandatory SEBI disclosure for you.",
  "BRSR-2": "Listed beyond the top 1,000, BRSR is voluntary for you today but increasingly expected by investors — worth adopting ahead of any threshold change.",
  "BRSR-3": "Though unlisted, your major top-250 listed buyer will request BRSR-aligned data from you as part of their value-chain disclosure.",
  "BRSR-4": "At your scale with international exposure, BRSR-aligned reporting is a recognised best practice that strengthens credibility with buyers and lenders.",
  "BRSR-5": "BRSR is a listed-entity obligation; based on your current profile it does not apply to your business.",
  // BRSR Core
  "BRSRC-1": "As a top-250 listed company, BRSR Core with its assured KPIs is a direct mandatory requirement.",
  "BRSRC-2": "Listed in the 251–1,000 band and supplying top-250 listed customers, BRSR Core reaches you both directly and through value-chain expectations.",
  "BRSRC-3": "As a value-chain partner of a top-250 listed buyer, you will be asked for BRSR Core's assured value-chain KPIs.",
  "BRSRC-4": "Depending on your listed buyer's 2% procurement threshold, you may fall within their BRSR Core value-chain assessment.",
  "BRSRC-5": "BRSR Core applies to top-250 listed entities and their key suppliers; it does not currently apply to your business.",
  // CCTS
  "CCTS-1": "Your sector and scale typically fall within BEE's obligated-entity criteria under the Carbon Credit Trading Scheme.",
  "CCTS-2": "Your sector is covered by CCTS; whether you are an obligated entity depends on BEE's notifications for your sub-sector and installed capacity.",
  "CCTS-3": "Your sector is covered by CCTS, but at your scale you are below typical obligation thresholds — monitor as the scheme expands.",
  "CCTS-4": "The Carbon Credit Trading Scheme currently covers specific energy-intensive sectors; your sector is not among them.",
  // CBAM
  "CBAM-1": "You export CBAM-covered goods to the EU, so CBAM reporting applies in the transitional phase, with levies from 2026.",
  "CBAM-2": "CBAM's scope may expand and your MNC customers may pass CBAM costs through the value chain — worth preparing for.",
  "CBAM-3": "You export to the EU but not in CBAM-covered goods today; monitor as the mechanism's product scope expands.",
  "CBAM-4": "CBAM applies only to specific goods exported to the EU; based on your export profile it does not apply.",
  // GRI
  "GRI-1": "As a listed company with international market exposure, investors and buyers increasingly expect GRI-aligned disclosure.",
  "GRI-2": "GRI is recommended for international credibility at your scale and exposure, though it is voluntary rather than legally required.",
  "GRI-3": "GRI is a voluntary framework; at your current scale and without international exposure it is not a priority.",
  "GRI-4": "GRI is a voluntary framework — adopt it based on your specific stakeholder expectations rather than obligation.",
  // GHG
  "GHG-1": "An organizational GHG inventory is the foundation for every ESG report and stakeholder data request that applies to you.",
  "GHG-2": "A GHG inventory is the recommended baseline for any company at your scale and the starting point for wider reporting.",
  "GHG-3": "A basic GHG inventory is a sensible voluntary baseline that future-proofs you if you grow into listed supply chains or exports.",
  // Custom / Buyer ESG
  "CUSTOM-1": "Your major MNC buyers are already asking for ESG data; a reliable custom-response capability is business-critical for you.",
  "CUSTOM-2": "Buyer-specific ESG questionnaires are already part of your reality — being able to answer them well protects the relationship.",
  "CUSTOM-3": "As you serve international customers, buyer-specific ESG requests are likely to begin arriving.",
  "CUSTOM-4": "Custom buyer ESG questionnaires are driven by MNC customer relationships; these do not currently apply to your business.",
};

const Q18_APPEND =
  "The active ESG data requests your team has reported suggest this is becoming a practical expectation, not just a theoretical one.";
const CBAM_APPEND =
  "CBAM applies specifically to steel, aluminium, cement, fertilizers, electricity, and hydrogen-related products. If your EU exports are in a different product category within your sector, this framework may not apply — happy to clarify on a call.";
const CCTS_APPEND =
  "CCTS applicability is determined by BEE's specific notifications, which depend on installed capacity and specific energy consumption thresholds for your sub-sector. Our assessment uses sector and turnover proxies — confirm with our team or refer to the latest BEE notification.";

/** Full why-text for one framework result, including conditional append sentences. */
export function buildWhyText(f: FrameworkResult): string {
  let text = WHY_TEXT[f.whyTextKey] ?? "";
  // CBAM softening when it is Definite (rule CBAM-1 matched).
  if (f.key === "cbam" && f.label === "Definite") text += " " + CBAM_APPEND;
  // CCTS caveat when Likely or Possible.
  if (f.key === "ccts" && (f.label === "Likely" || f.label === "Possible")) text += " " + CCTS_APPEND;
  // Q18 boost acknowledgement.
  if (f.q18BoostApplied) text += " " + Q18_APPEND;
  return text;
}

/**
 * Compose the ≤120-word "what this means" paragraph parametrically (Doc 4):
 * band framing + strongest-area acknowledgement + weakest-area focus + forward
 * look. This replaces the 28 hand-authored templates with a generator that
 * covers every band × weakest combination; copy can be hand-tuned later.
 * The all_doesnt_apply honesty paragraph is handled in the PDF layer, not here.
 */
const BAND_OPENER: Record<string, string> = {
  "Critical Gap":
    "Your assessment points to significant ESG infrastructure still to build — the foundations are the priority.",
  "Foundation Needed":
    "You have the basics in place; the work now is formalising and connecting them into something reportable.",
  "Strengthen & Formalise":
    "Your direction is clear and much is already working — the gains now come from depth and consistency.",
  "Advanced — Optimise & Assure":
    "You are operating at high ESG maturity — the focus shifts to assurance, optimisation and value-chain leadership.",
};

const AREA_FOCUS: Record<SubAreaKey, string> = {
  A: "building measurement and data systems so your numbers are complete and audit-ready",
  B: "putting named ownership, training and the right external support behind your ESG effort",
  C: "formalising policy, Board engagement and supplier governance",
  D: "converting activity into recognised disclosures and being ready for incoming data requests",
};

export function composeWhatThisMeans(readiness: ReadinessResult): string {
  const opener = BAND_OPENER[readiness.band] ?? "";
  const strong = SUBAREA_LABELS[readiness.strongestSubarea];
  const focus = AREA_FOCUS[readiness.weakestSubarea];
  return (
    `${opener} Your strongest area is ${strong.toLowerCase()}, which gives you a base to build from. ` +
    `The most valuable next step is ${focus}. ` +
    `Companies typically move up a readiness band within two to four quarters once they focus their effort there.`
  );
}
