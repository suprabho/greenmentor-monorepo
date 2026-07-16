/**
 * SASB SICS industry → NIC-2008 crosswalk.
 *
 * SASB classifies companies into 77 SICS industries; BRSR filings are coded
 * against NIC-2008 (lib/brsr/nic-sector.ts). This curated map lets the SASB
 * materiality taxonomy (0021) join our BRSR data by sector — e.g. "which SASB
 * disclosure topics apply to the NIC Section a company files under".
 *
 * Each SICS industry maps to a NIC Division (2-digit "industry"), which fixes the
 * Section ("sector") via resolveNic. The `section` field below is the *intended*
 * Section, cross-checked against resolveNic(division) by scripts/seed-sasb-nic.ts
 * so a mistyped division can't silently land in the wrong sector.
 *
 * These are well-known industry↔NIC correspondences, so the map is curated (not
 * LLM-derived) and committed as reviewable data. `confidence` flags the judgment
 * calls: "high" = unambiguous; "medium" = a defensible best-fit among a few NIC
 * divisions (e.g. apparel spans 13/14/15; internet media spans 62/63); "low" =
 * genuinely cross-division (solar/wind span manufacture + power generation;
 * packaging spans paper/plastic/glass/metal; professional & commercial services
 * span M/N) where the single-division choice is a pragmatic anchor for review.
 */

export type CrosswalkConfidence = "high" | "medium" | "low";

export interface NicCrosswalkEntry {
  /** SICS industry code (matches sasb_industries.code), e.g. "CG-AA". */
  code: string;
  /** Intended NIC Section letter (A–U) — cross-checked against the division. */
  section: string;
  /** NIC Division (2-digit) — the join granularity. */
  division: string;
  confidence: CrosswalkConfidence;
}

// [code, section, division, confidence] — one row per SICS industry (77 total).
const RAW: readonly [string, string, string, CrosswalkConfidence][] = [
  // Consumer Goods
  ["CG-AA", "C", "14", "medium"], // Apparel, Accessories & Footwear — wearing apparel (spans 13/15)
  ["CG-AM", "C", "27", "high"], //   Appliance Manufacturing — domestic appliances (electrical equipment)
  ["CG-BF", "C", "23", "medium"], // Building Products & Furnishings — non-metallic minerals (furnishings → 31)
  ["CG-EC", "G", "47", "medium"], // E-Commerce — retail sale via internet (spans platform 63)
  ["CG-HP", "C", "20", "high"], //   Household & Personal Products — soap/cleaning/cosmetics (chemicals)
  ["CG-MR", "G", "47", "high"], //   Multiline and Specialty Retailers & Distributors — retail trade
  ["CG-TS", "C", "32", "high"], //   Toys & Sporting Goods — games/toys/sports goods (other manufacturing)
  // Extractives & Minerals Processing
  ["EM-CM", "C", "23", "high"], //   Construction Materials — cement/concrete (non-metallic minerals)
  ["EM-CO", "B", "05", "high"], //   Coal Operations — mining of coal and lignite
  ["EM-EP", "B", "06", "high"], //   Oil & Gas – Exploration & Production — crude petroleum & natural gas
  ["EM-IS", "C", "24", "high"], //   Iron & Steel Producers — basic metals
  ["EM-MD", "H", "49", "medium"], // Oil & Gas – Midstream — transport via pipelines (spans storage 52)
  ["EM-MM", "B", "07", "high"], //   Metals & Mining — mining of metal ores
  ["EM-RM", "C", "19", "high"], //   Oil & Gas – Refining & Marketing — refined petroleum products
  ["EM-SV", "B", "09", "high"], //   Oil & Gas – Services — mining support service activities
  // Food & Beverage
  ["FB-AB", "C", "11", "high"], //   Alcoholic Beverages — manufacture of beverages
  ["FB-AG", "A", "01", "medium"], // Agricultural Products — crop/animal production (spans processing 10)
  ["FB-FR", "G", "47", "high"], //   Food Retailers & Distributors — retail trade
  ["FB-MP", "C", "10", "high"], //   Meat, Poultry & Dairy — manufacture of food products
  ["FB-NB", "C", "11", "high"], //   Non-Alcoholic Beverages — manufacture of beverages
  ["FB-PF", "C", "10", "high"], //   Processed Foods — manufacture of food products
  ["FB-RN", "I", "56", "high"], //   Restaurants — food and beverage service activities
  ["FB-TB", "C", "12", "high"], //   Tobacco — manufacture of tobacco products
  // Financials
  ["FN-AC", "K", "66", "high"], //   Asset Management & Custody Activities — fund management (other financial)
  ["FN-CB", "K", "64", "high"], //   Commercial Banks — financial service activities
  ["FN-CF", "K", "64", "high"], //   Consumer Finance — other credit granting
  ["FN-EX", "K", "66", "high"], //   Security & Commodity Exchanges — admin of financial markets
  ["FN-IB", "K", "66", "high"], //   Investment Banking & Brokerage — security dealing (other financial)
  ["FN-IN", "K", "65", "high"], //   Insurance — insurance, reinsurance and pension funding
  ["FN-MF", "K", "64", "high"], //   Mortgage Finance — other credit granting
  // Health Care
  ["HC-BP", "C", "21", "high"], //   Biotechnology & Pharmaceuticals — manufacture of pharmaceuticals
  ["HC-DI", "G", "46", "high"], //   Health Care Distributors — wholesale of pharmaceutical goods
  ["HC-DR", "G", "47", "high"], //   Drug Retailers — retail sale of pharmaceutical goods
  ["HC-DY", "Q", "86", "high"], //   Health Care Delivery — human health activities
  ["HC-MC", "K", "65", "medium"], // Managed Care — health insurance plans (spans health 86)
  ["HC-MS", "C", "32", "medium"], // Medical Equipment & Supplies — medical instruments (spans electromedical 26)
  // Infrastructure
  ["IF-EN", "F", "42", "medium"], // Engineering & Construction Services — civil engineering (spans design 71)
  ["IF-EU", "D", "35", "high"], //   Electric Utilities & Power Generators — electricity supply
  ["IF-GU", "D", "35", "high"], //   Gas Utilities & Distributors — gas supply/distribution
  ["IF-HB", "F", "41", "high"], //   Home Builders — construction of buildings
  ["IF-RE", "L", "68", "high"], //   Real Estate — real estate activities
  ["IF-RS", "L", "68", "high"], //   Real Estate Services — real estate on a fee/contract basis
  ["IF-WM", "E", "38", "high"], //   Waste Management — waste collection, treatment and disposal
  ["IF-WU", "E", "36", "high"], //   Water Utilities & Services — water collection, treatment and supply
  // Renewable Resources & Alternative Energy
  ["RR-BI", "C", "20", "medium"], // Biofuels — manufacture of biofuels (chemicals)
  ["RR-FC", "C", "27", "high"], //   Fuel Cells & Industrial Batteries — batteries/accumulators (electrical eq.)
  ["RR-FM", "A", "02", "high"], //   Forestry Management — forestry and logging
  ["RR-PP", "C", "17", "high"], //   Pulp & Paper Products — manufacture of paper and paper products
  ["RR-ST", "C", "26", "low"], //    Solar Technology & Project Developers — PV cells (spans generation 35)
  ["RR-WT", "C", "28", "low"], //    Wind Technology & Project Developers — turbines (spans generation 35)
  // Resource Transformation
  ["RT-AE", "C", "30", "high"], //   Aerospace & Defence — air/spacecraft (other transport equipment)
  ["RT-CH", "C", "20", "high"], //   Chemicals — manufacture of chemicals
  ["RT-CP", "C", "22", "low"], //    Containers & Packaging — plastics (spans paper 17 / glass·metal 23·25)
  ["RT-EE", "C", "27", "medium"], // Electrical & Electronic Equipment — electrical equipment (spans 26)
  ["RT-IG", "C", "28", "high"], //   Industrial Machinery & Goods — machinery and equipment n.e.c.
  // Services
  ["SV-AD", "M", "73", "high"], //   Advertising & Marketing — advertising
  ["SV-CA", "R", "92", "high"], //   Casinos & Gaming — gambling and betting activities
  ["SV-ED", "P", "85", "high"], //   Education
  ["SV-HL", "I", "55", "high"], //   Hotels & Lodging — accommodation
  ["SV-LF", "R", "93", "high"], //   Leisure Facilities — sports/amusement/recreation
  ["SV-ME", "J", "59", "medium"], // Media & Entertainment — film/video/TV production (spans 58/60)
  ["SV-PS", "N", "82", "low"], //    Professional & Commercial Services — business support (spans M divisions)
  // Technology & Communications
  ["TC-ES", "C", "26", "high"], //   Electronic Manufacturing Services & ODM — electronic components
  ["TC-HW", "C", "26", "high"], //   Hardware — computers and peripheral equipment
  ["TC-IM", "J", "63", "medium"], // Internet Media & Services — web portals (spans 62)
  ["TC-SC", "C", "26", "high"], //   Semiconductors — electronic components
  ["TC-SI", "J", "62", "high"], //   Software & IT Services — computer programming, consultancy
  ["TC-TL", "J", "61", "high"], //   Telecommunication Services — telecommunications
  // Transportation
  ["TR-AF", "H", "52", "medium"], // Air Freight & Logistics — support activities for transportation
  ["TR-AL", "H", "51", "high"], //   Airlines — air transport
  ["TR-AP", "C", "29", "high"], //   Auto Parts — parts and accessories for motor vehicles
  ["TR-AU", "C", "29", "high"], //   Automobiles — manufacture of motor vehicles
  ["TR-CL", "H", "50", "high"], //   Cruise Lines — sea passenger transport (water transport)
  ["TR-CR", "N", "77", "high"], //   Car Rental & Leasing — rental and leasing of motor vehicles
  ["TR-MT", "H", "50", "high"], //   Marine Transportation — water transport
  ["TR-RA", "H", "49", "high"], //   Rail Transportation — land transport (railways)
  ["TR-RO", "H", "49", "high"], //   Road Transportation — land transport (road freight)
];

export const SASB_NIC_CROSSWALK: readonly NicCrosswalkEntry[] = RAW.map(
  ([code, section, division, confidence]) => ({ code, section, division, confidence }),
);

export const CROSSWALK_BY_CODE: ReadonlyMap<string, NicCrosswalkEntry> = new Map(
  SASB_NIC_CROSSWALK.map((e) => [e.code, e]),
);
