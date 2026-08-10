/**
 * GICS sub-industry → NIC-2008 crosswalk (for the MSCI ESG Industry Materiality Map).
 *
 * MSCI keys its materiality map by GICS® (2-digit sectors, 8-digit sub-industries
 * — see ./materiality-map.ts); BRSR filings are coded against NIC-2008
 * (lib/brsr/nic-sector.ts). This curated map lets the MSCI materiality taxonomy
 * join our BRSR data by sector — e.g. "which MSCI Key Issues are material for the
 * NIC Section a company files under" — and doubles as a general-purpose
 * GICS ↔ NIC mapping (GICS_BY_NIC_DIVISION is the reverse index).
 *
 * Exactly the 163 GICS sub-industries are mapped; the 11 sectors are deliberately
 * excluded — a 2-digit GICS sector spans many NIC divisions, so a single-division
 * anchor would be meaningless. Each sub-industry maps to a NIC Division (2-digit
 * "industry"), which fixes the Section ("sector") via resolveNic. The `section`
 * field below is the *intended* Section, cross-checked against resolveNic(division)
 * by ./nic-crosswalk.test.ts — there is no DB table or seed script for MSCI (the
 * dataset is committed TypeScript by design), so the vitest suite plays the
 * validation role the seed scripts play for the SASB/Sustainalytics crosswalks.
 * If msci:gen ever changes the sub-industry set, that test fails naming the exact
 * GICS codes to add or remove here.
 *
 * These are well-known industry↔NIC correspondences, so the map is curated (not
 * LLM-derived) and committed as reviewable data. `confidence` flags the judgment
 * calls: "high" = unambiguous; "medium" = a defensible best-fit among a few NIC
 * divisions; "low" = genuinely cross-division (conglomerates, multi-sector
 * holdings, tri-material packaging) where the single choice is a pragmatic anchor
 * for review. GICS® is jointly owned by MSCI & S&P; sub-industry names appear in
 * comments for reviewability only.
 */

export type CrosswalkConfidence = "high" | "medium" | "low";

export interface NicCrosswalkEntry {
  /** 8-digit GICS sub-industry code (matches MSCI_SUBINDUSTRIES gicsCode). */
  gics: string;
  /** Intended NIC Section letter (A–U) — cross-checked against the division. */
  section: string;
  /** NIC Division (2-digit) — the join granularity. */
  division: string;
  confidence: CrosswalkConfidence;
}

// [gics, section, division, confidence] — one row per GICS sub-industry (163),
// in materiality-data.ts order so the two files diff positionally.
const RAW: readonly [string, string, string, CrosswalkConfidence][] = [
  // ── Energy (GICS 10) ──
  ["10101010", "B", "09", "high"], //   Oil & Gas Drilling — mining support service activities
  ["10101020", "B", "09", "medium"], // Oil & Gas Equipment & Services — O&G field services (equipment mfg spans 28)
  ["10102010", "B", "06", "medium"], // Integrated Oil & Gas — crude/gas extraction (refining arm spans 19)
  ["10102020", "B", "06", "high"], //   Oil & Gas Exploration & Production — extraction of crude petroleum & gas
  ["10102030", "C", "19", "high"], //   Oil & Gas Refining & Marketing — refined petroleum products
  ["10102040", "H", "49", "medium"], // Oil & Gas Storage & Transportation — pipelines (storage spans 52)
  ["10102050", "B", "05", "high"], //   Coal & Consumable Fuels — mining of coal and lignite
  // ── Materials (GICS 15) ──
  ["15101010", "C", "20", "high"], //   Commodity Chemicals — manufacture of chemicals
  ["15101020", "C", "20", "high"], //   Diversified Chemicals — manufacture of chemicals
  ["15101030", "C", "20", "high"], //   Fertilizers & Agricultural Chemicals — fertilizers/agrochemicals
  ["15101040", "C", "20", "high"], //   Industrial Gases — manufacture of basic chemicals
  ["15101050", "C", "20", "high"], //   Specialty Chemicals — manufacture of chemicals
  ["15102010", "C", "23", "high"], //   Construction Materials — cement/concrete (non-metallic minerals)
  ["15103010", "C", "25", "low"], //    Metal, Glass & Plastic Containers — metal packaging (genuinely spans 22/23/25)
  ["15103020", "C", "17", "medium"], // Paper & Plastic Packaging Products & Materials — paper packaging (spans 22)
  ["15104010", "C", "24", "high"], //   Aluminum — basic metals
  ["15104020", "B", "07", "high"], //   Diversified Metals & Mining — mining of metal ores
  ["15104025", "B", "07", "high"], //   Copper — mining of metal ores
  ["15104030", "B", "07", "high"], //   Gold — mining of metal ores
  ["15104040", "B", "07", "high"], //   Precious Metals & Minerals — mining of metal ores
  ["15104045", "B", "07", "high"], //   Silver — mining of metal ores
  ["15104050", "C", "24", "high"], //   Steel — basic metals
  ["15105010", "C", "16", "medium"], // Forest Products — wood products (upstream forestry spans A 02)
  ["15105020", "C", "17", "high"], //   Paper Products — paper and paper products
  // ── Industrials (GICS 20) ──
  ["20101010", "C", "30", "high"], //   Aerospace & Defense — air/spacecraft (other transport equipment)
  ["20102010", "C", "23", "medium"], // Building Products — non-metallic minerals (spans wood 16 / metal 25)
  ["20103010", "F", "42", "medium"], // Construction & Engineering — civil engineering (spans 41/43, design M 71)
  ["20104010", "C", "27", "high"], //   Electrical Components & Equipment — electrical equipment
  ["20104020", "C", "27", "high"], //   Heavy Electrical Equipment — electrical equipment
  ["20105010", "M", "70", "low"], //    Industrial Conglomerates — head offices (genuinely cross-division;
  //                                    Sustainalytics anchors its "Conglomerates" at K 64 — deliberate divergence)
  ["20106010", "C", "28", "medium"], // Construction Machinery & Heavy Transportation Equipment — machinery n.e.c.
  //                                    (heavy trucks/railcars span 29/30; sibling "HeavyMachineryandTrucks" is medium)
  ["20106015", "C", "28", "high"], //   Agricultural & Farm Machinery — machinery and equipment n.e.c.
  ["20106020", "C", "28", "high"], //   Industrial Machinery & Supplies & Components — machinery n.e.c.
  ["20107010", "G", "46", "high"], //   Trading Companies & Distributors — wholesale trade
  ["20201010", "C", "18", "high"], //   Commercial Printing — printing and reproduction
  ["20201050", "N", "81", "medium"], // Environmental & Facilities Services — facilities support (env. spans E 38/39)
  ["20201060", "N", "82", "medium"], // Office Services & Supplies — office support (supplies mfg spans C)
  ["20201070", "N", "82", "medium"], // Diversified Support Services — business support n.e.c.
  ["20201080", "N", "80", "high"], //   Security & Alarm Services — security and investigation activities
  ["20202010", "N", "78", "high"], //   Human Resource & Employment Services — employment activities
  ["20202020", "M", "70", "medium"], // Research & Consulting Services — management consultancy (spans 72/73)
  ["20202030", "J", "63", "medium"], // Data Processing & Outsourced Services — data processing/hosting (BPO spans N 82)
  ["20301010", "H", "52", "medium"], // Air Freight & Logistics — support activities for transportation (spans 51/53)
  ["20302010", "H", "51", "high"], //   Passenger Airlines — air transport
  ["20303010", "H", "50", "high"], //   Marine Transportation — water transport
  ["20304010", "H", "49", "high"], //   Rail Transportation — land transport (railways)
  ["20304030", "H", "49", "high"], //   Cargo Ground Transportation — land transport (road freight)
  ["20304040", "H", "49", "high"], //   Passenger Ground Transportation — land transport (road passenger)
  ["20305010", "H", "52", "high"], //   Airport Services — service activities incidental to air transportation
  ["20305020", "H", "52", "high"], //   Highways & Railtracks — toll roads/rail infra ops (NIC 5221;
  //                                    Sustainalytics anchors "HighwaysandRailroads" at 49 — deliberate divergence)
  ["20305030", "H", "52", "high"], //   Marine Ports & Services — service activities incidental to water transport
  // ── Consumer Discretionary (GICS 25) ──
  ["25101010", "C", "29", "high"], //   Automotive Parts & Equipment — parts/accessories for motor vehicles
  ["25101020", "C", "22", "high"], //   Tires & Rubber — rubber products
  ["25102010", "C", "29", "high"], //   Automobile Manufacturers — manufacture of motor vehicles
  ["25102020", "C", "30", "high"], //   Motorcycle Manufacturers — motorcycles (other transport equipment, NIC 3091)
  ["25201010", "C", "26", "high"], //   Consumer Electronics — consumer electronics (computer/electronic products)
  ["25201020", "C", "31", "high"], //   Home Furnishings — manufacture of furniture
  ["25201030", "F", "41", "high"], //   Homebuilding — construction of buildings
  ["25201040", "C", "27", "high"], //   Household Appliances — domestic appliances (electrical equipment)
  ["25201050", "C", "32", "medium"], // Housewares & Specialties — other manufacturing (spans plastic 22 / metal 25)
  ["25202010", "C", "32", "high"], //   Leisure Products — games/toys/sports goods (other manufacturing)
  ["25203010", "C", "14", "medium"], // Apparel, Accessories & Luxury Goods — wearing apparel (spans 13/15, jewellery 32)
  ["25203020", "C", "15", "high"], //   Footwear — leather and related products incl. footwear
  ["25203030", "C", "13", "high"], //   Textiles — manufacture of textiles
  ["25301010", "R", "92", "high"], //   Casinos & Gaming — gambling and betting activities
  ["25301020", "I", "55", "medium"], // Hotels, Resorts & Cruise Lines — accommodation (cruise lines span H 50)
  ["25301030", "R", "93", "high"], //   Leisure Facilities — sports/amusement/recreation
  ["25301040", "I", "56", "high"], //   Restaurants — food and beverage service activities
  ["25302010", "P", "85", "high"], //   Education Services — education
  ["25302020", "S", "96", "medium"], // Specialized Consumer Services — other personal service activities
  ["25501010", "G", "46", "high"], //   Distributors — wholesale trade
  ["25503030", "G", "47", "high"], //   Broadline Retail — retail trade
  ["25504010", "G", "47", "high"], //   Apparel Retail — retail trade
  ["25504020", "G", "47", "high"], //   Computer & Electronics Retail — retail trade
  ["25504030", "G", "47", "high"], //   Home Improvement Retail — retail trade
  ["25504040", "G", "47", "high"], //   Other Specialty Retail — retail trade
  ["25504050", "G", "45", "high"], //   Automotive Retail — sale of motor vehicles
  ["25504060", "G", "47", "high"], //   Homefurnishing Retail — retail trade
  // ── Consumer Staples (GICS 30) ──
  ["30101010", "G", "47", "high"], //   Drug Retail — retail sale of pharmaceutical goods
  ["30101020", "G", "46", "high"], //   Food Distributors — wholesale trade
  ["30101030", "G", "47", "high"], //   Food Retail — retail trade
  ["30101040", "G", "47", "high"], //   Consumer Staples Merchandise Retail — retail trade
  ["30201010", "C", "11", "high"], //   Brewers — manufacture of beverages
  ["30201020", "C", "11", "high"], //   Distillers & Vintners — manufacture of beverages
  ["30201030", "C", "11", "high"], //   Soft Drinks & Non-alcoholic Beverages — manufacture of beverages
  ["30202010", "A", "01", "medium"], // Agricultural Products & Services — crop/animal production (spans processing 10)
  ["30202030", "C", "10", "high"], //   Packaged Foods & Meats — manufacture of food products
  ["30203010", "C", "12", "high"], //   Tobacco — manufacture of tobacco products
  ["30301010", "C", "20", "medium"], // Household Products — soap/cleaning preparations (chemicals; spans 32)
  ["30302010", "C", "20", "medium"], // Personal Care Products — cosmetics/toiletries (chemicals, NIC 2023)
  // ── Health Care (GICS 35) ──
  ["35101010", "C", "32", "medium"], // Health Care Equipment — medical instruments (electromedical spans 26)
  ["35101020", "C", "32", "high"], //   Health Care Supplies — medical/dental instruments and supplies (NIC 3250)
  ["35102010", "G", "46", "high"], //   Health Care Distributors — wholesale of pharmaceutical goods
  ["35102015", "Q", "86", "high"], //   Health Care Services — human health activities
  ["35102020", "Q", "86", "high"], //   Health Care Facilities — human health activities (hospitals)
  ["35102030", "K", "65", "medium"], // Managed Health Care — health insurance (delivery spans Q 86)
  ["35103010", "J", "62", "medium"], // Health Care Technology — health IT/software (spans 63)
  ["35201010", "M", "72", "medium"], // Biotechnology — scientific R&D (commercial biotech mfg spans 21)
  ["35202010", "C", "21", "high"], //   Pharmaceuticals — manufacture of pharmaceuticals
  ["35203010", "M", "72", "medium"], // Life Sciences Tools & Services — CRO/R&D services (instruments span 26;
  //                                    Sustainalytics anchors "LaboratoryEquipmentandServices" at C 26 — deliberate divergence)
  // ── Financials (GICS 40) ──
  ["40101010", "K", "64", "high"], //   Diversified Banks — financial service activities
  ["40101015", "K", "64", "high"], //   Regional Banks — financial service activities
  ["40201020", "K", "64", "medium"], // Diversified Financial Services — financial services n.e.c.
  ["40201030", "K", "64", "low"], //    Multi-Sector Holdings — holding companies (NIC 6420; genuinely cross-sector)
  ["40201040", "K", "64", "medium"], // Specialized Finance — other credit granting / financial services n.e.c.
  ["40201050", "K", "64", "high"], //   Commercial & Residential Mortgage Finance — other credit granting
  ["40201060", "K", "66", "medium"], // Transaction & Payment Processing Services — financial auxiliaries (spans J 63)
  ["40202010", "K", "64", "high"], //   Consumer Finance — other credit granting
  ["40203010", "K", "66", "high"], //   Asset Management & Custody Banks — fund management (other financial)
  ["40203020", "K", "66", "high"], //   Investment Banking & Brokerage — security dealing (other financial)
  ["40203030", "K", "66", "high"], //   Diversified Capital Markets — auxiliary financial activities
  ["40203040", "K", "66", "high"], //   Financial Exchanges & Data — administration of financial markets
  ["40204010", "K", "64", "medium"], // Mortgage REITs — credit institutions, not property operation (spans L 68)
  ["40301010", "K", "66", "high"], //   Insurance Brokers — activities auxiliary to insurance
  ["40301020", "K", "65", "high"], //   Life & Health Insurance — insurance and pension funding
  ["40301030", "K", "65", "high"], //   Multi-line Insurance — insurance and pension funding
  ["40301040", "K", "65", "high"], //   Property & Casualty Insurance — insurance and pension funding
  ["40301050", "K", "65", "high"], //   Reinsurance — reinsurance
  // ── Information Technology (GICS 45) ──
  ["45102010", "J", "62", "high"], //   IT Consulting & Other Services — computer programming, consultancy
  ["45102030", "J", "63", "medium"], // Internet Services & Infrastructure — hosting/data centres (spans 62)
  ["45103010", "J", "62", "medium"], // Application Software — software development (publishing spans 58)
  ["45103020", "J", "62", "medium"], // Systems Software — software development (publishing spans 58)
  ["45201020", "C", "26", "high"], //   Communications Equipment — communication equipment
  ["45202030", "C", "26", "high"], //   Technology Hardware, Storage & Peripherals — computers and peripherals
  ["45203010", "C", "26", "high"], //   Electronic Equipment & Instruments — computer/electronic products
  ["45203015", "C", "26", "high"], //   Electronic Components — electronic components
  ["45203020", "C", "26", "high"], //   Electronic Manufacturing Services — electronic components/assemblies
  ["45203030", "G", "46", "high"], //   Technology Distributors — wholesale trade
  ["45301010", "C", "28", "medium"], // Semiconductor Materials & Equipment — machinery n.e.c. (materials span 20/26)
  ["45301020", "C", "26", "high"], //   Semiconductors — electronic components
  // ── Communication Services (GICS 50) ──
  ["50101010", "J", "61", "high"], //   Alternative Carriers — telecommunications
  ["50101020", "J", "61", "high"], //   Integrated Telecommunication Services — telecommunications
  ["50102010", "J", "61", "high"], //   Wireless Telecommunication Services — telecommunications
  ["50201010", "M", "73", "high"], //   Advertising — advertising and market research
  ["50201020", "J", "60", "high"], //   Broadcasting — programming and broadcasting activities
  ["50201030", "J", "61", "high"], //   Cable & Satellite — cable/satellite distribution (NIC 611)
  ["50201040", "J", "58", "high"], //   Publishing — publishing activities
  ["50202010", "J", "59", "high"], //   Movies & Entertainment — film/video/TV production
  ["50202020", "J", "58", "high"], //   Interactive Home Entertainment — software/games publishing (NIC 5820)
  ["50203010", "J", "63", "medium"], // Interactive Media & Services — web portals (spans 62)
  // ── Utilities (GICS 55) ──
  ["55101010", "D", "35", "high"], //   Electric Utilities — electricity supply
  ["55102010", "D", "35", "high"], //   Gas Utilities — gas supply/distribution
  ["55103010", "D", "35", "medium"], // Multi-Utilities — electricity/gas (water arm spans E 36)
  ["55104010", "E", "36", "high"], //   Water Utilities — water collection, treatment and supply
  ["55105010", "D", "35", "high"], //   Independent Power Producers & Energy Traders — electricity supply
  ["55105020", "D", "35", "high"], //   Renewable Electricity — electricity supply
  // ── Real Estate (GICS 60) ──
  ["60101010", "L", "68", "high"], //   Diversified REITs — real estate activities
  ["60102510", "L", "68", "high"], //   Industrial REITs — real estate activities
  ["60103010", "L", "68", "medium"], // Hotel & Resort REITs — real estate (operation spans I 55)
  ["60104010", "L", "68", "high"], //   Office REITs — real estate activities
  ["60105010", "L", "68", "high"], //   Health Care REITs — real estate activities
  ["60106010", "L", "68", "high"], //   Multi-Family Residential REITs — real estate activities
  ["60106020", "L", "68", "high"], //   Single-Family Residential REITs — real estate activities
  ["60107010", "L", "68", "high"], //   Retail REITs — real estate activities
  ["60108010", "L", "68", "high"], //   Other Specialized REITs — real estate activities
  ["60108020", "L", "68", "high"], //   Self-Storage REITs — real estate activities
  ["60108030", "L", "68", "medium"], // Telecom Tower REITs — real estate (Indian towercos file under J 61)
  ["60108040", "L", "68", "medium"], // Timber REITs — real estate (forestry operation spans A 02)
  ["60108050", "L", "68", "medium"], // Data Center REITs — real estate (hosting operation spans J 63)
  ["60201010", "L", "68", "high"], //   Diversified Real Estate Activities — real estate activities
  ["60201020", "L", "68", "high"], //   Real Estate Operating Companies — real estate activities
  ["60201030", "L", "68", "high"], //   Real Estate Development — real estate activities (construction spans F 41)
  ["60201040", "L", "68", "high"], //   Real Estate Services — real estate on a fee/contract basis
];

export const MSCI_NIC_CROSSWALK: readonly NicCrosswalkEntry[] = RAW.map(
  ([gics, section, division, confidence]) => ({ gics, section, division, confidence }),
);

export const CROSSWALK_BY_GICS: ReadonlyMap<string, NicCrosswalkEntry> = new Map(
  MSCI_NIC_CROSSWALK.map((e) => [e.gics, e]),
);

/** Reverse index: NIC Division (2-digit) → GICS sub-industry codes mapped to it. */
export const GICS_BY_NIC_DIVISION: ReadonlyMap<string, readonly string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const e of MSCI_NIC_CROSSWALK) {
    const list = m.get(e.division);
    if (list) list.push(e.gics);
    else m.set(e.division, [e.gics]);
  }
  return m;
})();
