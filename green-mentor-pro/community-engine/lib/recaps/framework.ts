/**
 * The fixed 10-category conceptual framework a weekly recap is organized
 * under. The framework is a LENS, not a template: the model derives concrete
 * news-driven topics from the week's sources and tags each with exactly one
 * category — categories with no real news that week simply don't appear.
 *
 * `whyItMatters` and `anchorSources` render into the generation prompt so the
 * model frames each topic educationally (what a practitioner should track and
 * why), grounded in the authoritative standards/bodies for that category.
 */

export type RecapCategoryId =
  | "ghg-accounting"
  | "esg-regulations"
  | "sustainability-careers"
  | "industry-lens"
  | "climate-finance"
  | "sustainability-tech"
  | "iso-ehs"
  | "social-governance"
  | "circular-economy"
  | "esg-emerging-markets";

export interface RecapCategory {
  id: RecapCategoryId;
  name: string;
  /** 1-2 sentences rendered into the prompt: the educational stakes. */
  whyItMatters: string;
  /** Authoritative standards/bodies that anchor the category (prompt context only). */
  anchorSources: string[];
}

export const RECAP_FRAMEWORK: RecapCategory[] = [
  {
    id: "ghg-accounting",
    name: "GHG Accounting & Carbon Measurement",
    whyItMatters:
      "Measurement rules are hardening: the GHG Protocol's Scope 3 revisions push minimum-boundary coverage and primary activity-based data over spend-based estimates, and SBTi validation is the benchmark for audit-grade decarbonization claims.",
    anchorSources: ["GHG Protocol (Scope 3 Standard revisions)", "SBTi Corporate Net-Zero Standard"],
  },
  {
    id: "esg-regulations",
    name: "ESG Regulations & Compliance",
    whyItMatters:
      "Disclosure regimes are diverging: the EU is simplifying ESRS/CSRD data points under the Omnibus while California's SB 253 drives hard reporting deadlines despite US federal pushback — companies must navigate jurisdictional fragmentation.",
    anchorSources: ["EFRAG draft simplified ESRS", "CARB SB 253 implementation", "EU CSRD/Omnibus"],
  },
  {
    id: "sustainability-careers",
    name: "Careers in Sustainability",
    whyItMatters:
      "The profession is shifting from generalist ESG toward hardcore financial integration and quantitative climate-risk skills, reflected in the CFA Sustainable Investing Certificate rebrand and GARP's SCR qualification.",
    anchorSources: ["CFA Institute Sustainable Investing Certificate", "GARP SCR Certificate"],
  },
  {
    id: "industry-lens",
    name: "Industry Lens (Sector-Specific Impacts)",
    whyItMatters:
      "Sector-specific mechanisms are biting: CBAM moves heavy industry exporters to the EU from reporting into a taxation phase, while TNFD pushes agriculture and heavy industry beyond carbon into nature and biodiversity risk mapping.",
    anchorSources: ["EU CBAM portal", "TNFD Knowledge Hub"],
  },
  {
    id: "climate-finance",
    name: "Climate Finance & Carbon Markets",
    whyItMatters:
      "Carbon-market integrity is the story: Article 6 host-country authorizations attack double counting, Verra's VCS v5 renders old-vintage offsets high-risk, and investors use ICVCM Core Carbon Principles to scrub phantom credits from balance sheets.",
    anchorSources: ["Article 6 of the Paris Agreement", "Verra VCS Version 5", "ICVCM Core Carbon Principles"],
  },
  {
    id: "sustainability-tech",
    name: "Sustainability Technology & Digital ESG",
    whyItMatters:
      "Assurance standards like ISSA 5000 force ESG software toward strict data lineage and audit controls, while AI integration and ERP connectivity reshape the carbon-management platform market — and AI's own footprint draws scrutiny.",
    anchorSources: ["ISSA 5000", "Verdantix Green Quadrant (enterprise carbon management)"],
  },
  {
    id: "iso-ehs",
    name: "ISO, EHS & Management Systems",
    whyItMatters:
      "The ISO 14001:2026 revision embeds the climate-change amendment, life-cycle supply-chain controls, and biodiversity tracking into mainstream environmental management systems.",
    anchorSources: ["ISO 14001:2026 revision"],
  },
  {
    id: "social-governance",
    name: "Social & Governance",
    whyItMatters:
      "Human rights due diligence is becoming hard law (CSDDD) with real litigation exposure, and board governance is shifting toward data-driven whistleblower systems and climate-competency expectations.",
    anchorSources: ["EU CSDDD", "OECD Anti-Corruption and Integrity Outlook"],
  },
  {
    id: "circular-economy",
    name: "Circular Economy & Sustainable Supply Chains",
    whyItMatters:
      "Product-level traceability is arriving: the EU Digital Product Passport mandates scannable circularity identities, and India's EPR trading platform links waste certificates directly to GST and customs data.",
    anchorSources: ["EU Digital Product Passport", "India CPCB EPR trading platform (EPRETP)"],
  },
  {
    id: "esg-emerging-markets",
    name: "ESG in Emerging Markets (Global South)",
    whyItMatters:
      "SEBI's BRSR Core reasonable-assurance mandate is the strictest data audit standard active in the Global South, and ISSB S1/S2 adoption dictates how emerging-market firms report to attract FDI and stay in Western supply chains.",
    anchorSources: ["SEBI BRSR Core assurance mandates", "ISSB S1 & S2"],
  },
];

export const RECAP_CATEGORY_IDS = RECAP_FRAMEWORK.map((c) => c.id);

export function findRecapCategory(id: string): RecapCategory | undefined {
  return RECAP_FRAMEWORK.find((c) => c.id === id);
}
