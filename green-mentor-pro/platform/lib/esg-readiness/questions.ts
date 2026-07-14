// Question, option and scoring definitions — the source of truth for the
// questionnaire (lead-gen-amitava/Document 2) and the values the logic engine
// (Document 6) reads. Answer values are stable CODES; display labels live here
// too so the wizard and the PDF render identical wording.

export interface Option {
  code: string;
  label: string;
  /** Points for scored single-selects; +1 per selection for multi-selects. */
  score?: number;
}

// ---------------------------------------------------------------------------
// Q1 — primary sector (19 options, not scored)
// ---------------------------------------------------------------------------

export const SECTORS: Option[] = [
  { code: "steel", label: "Steel, iron & ferrous metals" },
  { code: "aluminium", label: "Aluminium & non-ferrous metals" },
  { code: "cement", label: "Cement & construction materials" },
  { code: "fertilizers", label: "Fertilizers" },
  { code: "chemicals", label: "Chemicals & petrochemicals" },
  { code: "oil_gas", label: "Oil & gas" },
  { code: "power", label: "Power generation" },
  { code: "pharma", label: "Pharmaceuticals & life sciences" },
  { code: "automotive", label: "Automotive & components" },
  { code: "textiles", label: "Textiles, apparel & leather" },
  { code: "food", label: "Food, beverage & agriculture" },
  { code: "paper", label: "Paper, pulp & packaging" },
  { code: "it", label: "IT, ITeS & technology services" },
  { code: "bfsi", label: "Financial services (BFSI)" },
  { code: "realestate", label: "Real estate & infrastructure" },
  { code: "engineering", label: "Engineering & capital goods" },
  { code: "hospitality", label: "Hospitality, retail & consumer" },
  { code: "logistics", label: "Logistics & transportation" },
  { code: "other", label: "Other" },
];

// Q2 — conditional sub-sector options per Q1 (Doc 2). "other" → free text.
export const SUBSECTORS: Record<string, string[]> = {
  steel: ["Integrated steel plant", "Secondary steel", "Mining", "Ferro-alloys", "Processing & rolling"],
  aluminium: ["Primary aluminium", "Secondary aluminium", "Bauxite mining", "Downstream products"],
  cement: ["Cement manufacturing", "Ready-mix concrete", "Bricks & blocks", "Aggregates", "Other building materials"],
  fertilizers: ["Urea", "Complex fertilizers", "Specialty fertilizers", "Distribution"],
  chemicals: ["Bulk chemicals", "Specialty chemicals", "Agrochemicals", "Petrochemicals", "Dyes & pigments"],
  oil_gas: ["Exploration", "Refining", "Distribution", "LNG", "City gas"],
  power: ["Thermal", "Renewable", "Nuclear", "Hydro", "Transmission & distribution"],
  pharma: ["API manufacturing", "Formulations", "CRAMS/CDMO", "Biotech", "Medical devices"],
  automotive: ["OEM", "Tier-1 supplier", "Tier-2 supplier", "Aftermarket", "EV-specific"],
  textiles: ["Spinning", "Weaving", "Garment manufacturing", "Leather & footwear", "Home textiles"],
  food: ["Packaged foods", "Dairy", "Sugar", "Beverages", "Agri-inputs", "Animal feed"],
  paper: ["Pulp & paper", "Corrugated packaging", "Flexible packaging", "Rigid plastic packaging"],
  it: ["IT services", "Product", "GCC", "BPO", "SaaS"],
  bfsi: ["Banking", "NBFC", "Insurance", "AMC", "Fintech"],
  realestate: ["Residential", "Commercial", "Industrial", "Roads", "Ports", "Renewables infrastructure"],
  engineering: ["Industrial machinery", "Electrical equipment", "Defence", "Heavy engineering"],
  hospitality: ["Hotels", "QSR", "Retail", "Consumer durables", "FMCG", "E-commerce"],
  logistics: ["Trucking", "Shipping", "Aviation", "Warehousing", "3PL/4PL"],
};

/** Sectors within scope of the Carbon Credit Trading Scheme (Doc 6 §A3). */
export const CCTS_SECTORS = new Set([
  "steel",
  "aluminium",
  "cement",
  "fertilizers",
  "chemicals",
  "oil_gas",
  "power",
  "paper",
]);

/** Sectors within CBAM's covered goods (Doc 6 §A4). */
export const CBAM_SECTORS = new Set(["steel", "aluminium", "cement", "fertilizers", "power"]);

// ---------------------------------------------------------------------------
// Q3 — turnover bands. Lower-bound (₹ Cr) drives the threshold comparisons the
// applicability rules use (≥250, ≥1000, =500–1000, <500, ≥50, <250).
// ---------------------------------------------------------------------------

export const TURNOVER_BANDS: { code: string; label: string; lowerCr: number }[] = [
  { code: "under_50", label: "Under ₹50 Cr", lowerCr: 0 },
  { code: "50_250", label: "₹50–250 Cr", lowerCr: 50 },
  { code: "250_500", label: "₹250–500 Cr", lowerCr: 250 },
  { code: "500_1000", label: "₹500–1,000 Cr", lowerCr: 500 },
  { code: "1000_5000", label: "₹1,000–5,000 Cr", lowerCr: 1000 },
  { code: "above_5000", label: "Above ₹5,000 Cr", lowerCr: 5000 },
];

export function turnoverLowerCr(code: string): number {
  return TURNOVER_BANDS.find((b) => b.code === code)?.lowerCr ?? 0;
}

// ---------------------------------------------------------------------------
// Q4–Q7 — profiling single-selects (not scored). Codes are referenced by the
// applicability rules in applicability.ts.
// ---------------------------------------------------------------------------

export const Q4_LISTED: Option[] = [
  { code: "top_250", label: "Yes — among the top 250 by market cap" },
  { code: "251_1000", label: "Yes — ranked 251–1,000 by market cap" },
  { code: "beyond_1000", label: "Yes — beyond top 1,000" },
  { code: "unlisted", label: "No, unlisted" },
];

export const Q5_EXPORTS: Option[] = [
  { code: "eu", label: "Yes — to the EU" },
  { code: "non_eu", label: "Yes — to other international markets, not EU" },
  { code: "both", label: "Yes — to both EU and other international markets" },
  { code: "none", label: "No exports" },
];

export const Q6_LISTED_BUYER: Option[] = [
  { code: "major_top250", label: "Yes — to top 250 listed company/companies, as a major share of our revenue" },
  { code: "minor_top250", label: "Yes — to top 250 listed, but a minor share" },
  { code: "beyond_top250", label: "Yes — to listed companies beyond top 250" },
  { code: "no", label: "No" },
  { code: "not_sure", label: "Not sure" },
];

export const Q7_MNC: Option[] = [
  { code: "major", label: "Yes — they're a major customer (significant share of our revenue)" },
  { code: "minor", label: "Yes — minor share" },
  { code: "no", label: "No" },
  { code: "not_sure", label: "Not sure" },
];

// ---------------------------------------------------------------------------
// Q8–Q18 — scored questions. Single-selects map to {0, 1.5, 3, 4}; the two
// multi-selects award +1 per option (cap 4) with a mutually-exclusive "none".
// ---------------------------------------------------------------------------

export const Q8_SYSTEMS: Option[] = [
  { code: "erp", label: "ERP for finance / procurement (SAP, Oracle, Tally, Zoho, MS Dynamics, etc.)", score: 1 },
  { code: "hrms", label: "Digital HRMS (employee records, payroll, training, attendance)", score: 1 },
  { code: "ehs", label: "EHS management system (incidents, audits, safety data)", score: 1 },
  { code: "energy", label: "Energy / utility tracking system (electricity, fuel, water tracked digitally)", score: 1 },
  { code: "supplier", label: "Supplier / vendor management system (digital, not just Excel)", score: 1 },
  { code: "document", label: "Document / evidence management system (digital filing, audit trails)", score: 1 },
  { code: "none", label: "None of the above — we primarily use spreadsheets and emails", score: 0 },
];

export const Q9_SCOPE12: Option[] = [
  { code: "no", label: "No, not measured", score: 0 },
  { code: "partial", label: "Partially — only some sites or some fuels", score: 1.5 },
  { code: "annual", label: "Yes — measured annually", score: 3 },
  { code: "continuous", label: "Yes — measured monthly or continuously, with audit trail", score: 4 },
];

export const Q10_SCOPE3: Option[] = [
  { code: "no", label: "No", score: 0 },
  { code: "started", label: "Started, for 1–2 categories only", score: 1.5 },
  { code: "several", label: "Yes, for several relevant categories", score: 3 },
  { code: "comprehensive", label: "Yes, comprehensive across all relevant Scope 3 categories", score: 4 },
];

export const Q11_OWNER: Option[] = [
  { code: "no", label: "No", score: 0 },
  { code: "part_time", label: "Yes — part-time / additional responsibility for someone", score: 1.5 },
  { code: "one_ft", label: "Yes — one full-time individual", score: 3 },
  { code: "team", label: "Yes — a full team", score: 4 },
];

export const Q12_TRAINING: Option[] = [
  { code: "none", label: "No one trained", score: 0 },
  { code: "informal", label: "1–2 people trained informally (webinars, short courses)", score: 1.5 },
  { code: "small_team", label: "A small team trained formally (certifications, structured programmes)", score: 3 },
  { code: "org_wide", label: "ESG training is part of organisational learning, multiple functions and levels", score: 4 },
];

export const Q13_CONSULTANTS: Option[] = [
  { code: "no", label: "No", score: 0 },
  { code: "informal", label: "Engaged informally — one-off conversations, free consultations", score: 1.5 },
  { code: "project", label: "Yes — for a specific project (BRSR, GHG inventory, supplier audit)", score: 3 },
  { code: "retainer", label: "Yes — ongoing retainer or multi-year engagement", score: 4 },
];

export const Q14_SUPPLIER_DATA: Option[] = [
  { code: "no_master", label: "No formal vendor master", score: 0 },
  { code: "master_no_esg", label: "Vendor master exists, but no ESG data on suppliers", score: 1.5 },
  { code: "some_esg", label: "Vendor master + some ESG attributes for key suppliers", score: 3 },
  { code: "full_profiles", label: "Full supplier ESG profiles maintained digitally", score: 4 },
];

export const Q15_POLICY: Option[] = [
  { code: "no", label: "No", score: 0 },
  { code: "draft", label: "In draft", score: 1.5 },
  { code: "generic", label: "Yes — generic, no specific targets", score: 3 },
  { code: "targets", label: "Yes — with specific targets, KPIs, and time-bound commitments", score: 4 },
];

export const Q16_BOARD: Option[] = [
  { code: "no", label: "No / not on the agenda", score: 0 },
  { code: "briefly", label: "Briefly mentioned, not a recurring item", score: 1.5 },
  { code: "discussed", label: "Discussed in 1–2 meetings as a substantive topic", score: 3 },
  { code: "regular", label: "Regular agenda item with dedicated reporting to the Board", score: 4 },
];

export const Q17_OUTPUTS: Option[] = [
  { code: "brsr", label: "BRSR or BRSR Core mandatory disclosure", score: 1 },
  { code: "voluntary_report", label: "Voluntary sustainability report (GRI, CDP, integrated report, ESG report)", score: 1 },
  { code: "ghg_inventory", label: "Organizational GHG inventory (Scope 1, 2, and/or 3)", score: 1 },
  { code: "buyer_questionnaire", label: "Response to a major buyer ESG questionnaire (EcoVadis, CDP Supply Chain, customer form)", score: 1 },
  { code: "third_party_audit", label: "Third-party ESG audit or assurance", score: 1 },
  { code: "none", label: "None of the above", score: 0 },
];

export const Q18_REQUESTS: Option[] = [
  { code: "none", label: "None", score: 0 },
  { code: "one_two", label: "1–2", score: 1.5 },
  { code: "three_five", label: "3–5", score: 3 },
  { code: "more_than_five", label: "More than 5", score: 4 },
];

/** Map a single-select answer code to its score, using the option list. */
export function scoreSingle(options: Option[], code: string): number {
  return options.find((o) => o.code === code)?.score ?? 0;
}

/**
 * Score a multi-select (Q8, Q17): +1 per selected option, capped at 4, with
 * "none" forcing 0 regardless of any other selection (Doc 2 / Doc 6 §2.1).
 */
export function scoreMulti(selected: string[]): number {
  if (!selected || selected.length === 0) return 0;
  if (selected.includes("none")) return 0;
  return Math.min(selected.length, 4);
}
