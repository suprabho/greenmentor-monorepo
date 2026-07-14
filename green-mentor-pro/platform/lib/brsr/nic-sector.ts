/**
 * NIC-2008 sector/industry resolution for the BRSR scraper.
 *
 * BRSR Section A reports each company's products/services with a NIC-2008 code
 * and its share of turnover (lib/brsr/xbrl.ts extractProductTurnover). To label
 * a filing with a *sector* (NIC Section) and *industry* (NIC Division) we resolve
 * each code onto the classification and weight the sections by turnover.
 *
 * The canonical NIC-2008 tree (21 sections / 88 divisions / 238 groups) lives in
 * community-engine/lib/nic/classification.ts and drives the /nic page. The
 * scraper is a separate app that cannot import it, and sector/industry labelling
 * only needs the Division → Section level, so the two tables below are the
 * Division (2-digit) and Section (letter) rows of that tree, transcribed from it
 * verbatim. Regenerate from the canonical RAW literal if NIC-2008 is ever
 * revised; the counts self-check against the published Broad Structure (21/88).
 *
 * "sector" == NIC Section (A–U); "industry" == NIC Division (2-digit).
 * super-sector == the ILO primary/secondary/tertiary split, as in the tree.
 */

export type SuperSector = "primary" | "secondary" | "tertiary";

/** [sectionLetter, superSector, sectionTitle] */
const SECTIONS: readonly [string, SuperSector, string][] = [
  ["A", "primary", "Agriculture, forestry and fishing"],
  ["B", "primary", "Mining and quarrying"],
  ["C", "secondary", "Manufacturing"],
  ["D", "secondary", "Electricity, gas, steam and air conditioning supply"],
  ["E", "secondary", "Water supply; sewerage, waste management and remediation activities"],
  ["F", "secondary", "Construction"],
  ["G", "tertiary", "Wholesale and retail trade; repair of motor vehicles and motorcycles"],
  ["H", "tertiary", "Transportation and storage"],
  ["I", "tertiary", "Accommodation and Food service activities"],
  ["J", "tertiary", "Information and communication"],
  ["K", "tertiary", "Financial and insurance activities"],
  ["L", "tertiary", "Real estate activities"],
  ["M", "tertiary", "Professional, scientific and technical activities"],
  ["N", "tertiary", "Administrative and support service activities"],
  ["O", "tertiary", "Public administration and defence; compulsory social security"],
  ["P", "tertiary", "Education"],
  ["Q", "tertiary", "Human health and social work activities"],
  ["R", "tertiary", "Arts, entertainment and recreation"],
  ["S", "tertiary", "Other service activities"],
  ["T", "tertiary", "Activities of households as employers; undifferentiated goods- and services producing activities of households for own use"],
  ["U", "tertiary", "Activities of extraterritorial organizations and bodies"],
];

/** [divisionCode (2-digit), sectionLetter, divisionTitle] */
const DIVISIONS: readonly [string, string, string][] = [
  ["01", "A", "Crop and animal production, hunting and related service activities"],
  ["02", "A", "Forestry and logging"],
  ["03", "A", "Fishing and aquaculture"],
  ["05", "B", "Mining of coal and lignite"],
  ["06", "B", "Extraction of crude petroleum and natural gas"],
  ["07", "B", "Mining of metal ores"],
  ["08", "B", "Other mining and quarrying"],
  ["09", "B", "Mining support service activities"],
  ["10", "C", "Manufacture of food products"],
  ["11", "C", "Manufacture of beverages"],
  ["12", "C", "Manufacture of tobacco products"],
  ["13", "C", "Manufacture of textiles"],
  ["14", "C", "Manufacture of wearing apparel"],
  ["15", "C", "Manufacture of leather and related products"],
  ["16", "C", "Manufacture of wood and products of wood and cork, except furniture; manufacture of articles of straw and plaiting materials"],
  ["17", "C", "Manufacture of paper and paper products"],
  ["18", "C", "Printing and reproduction of recorded media"],
  ["19", "C", "Manufacture of coke and refined petroleum products"],
  ["20", "C", "Manufacture of chemicals and chemical products"],
  ["21", "C", "Manufacture of pharmaceuticals, medicinal chemical and botanical products"],
  ["22", "C", "Manufacture of rubber and plastics products"],
  ["23", "C", "Manufacture of other non-metallic mineral products"],
  ["24", "C", "Manufacture of basic metals"],
  ["25", "C", "Manufacture of fabricated metal products, except machinery and equipment"],
  ["26", "C", "Manufacture of computer, electronic and optical products"],
  ["27", "C", "Manufacture of electrical equipment"],
  ["28", "C", "Manufacture of machinery and equipment n.e.c."],
  ["29", "C", "Manufacture of motor vehicles, trailers and semi-trailers"],
  ["30", "C", "Manufacture of other transport equipment"],
  ["31", "C", "Manufacture of furniture"],
  ["32", "C", "Other manufacturing"],
  ["33", "C", "Repair and installation of machinery and equipment"],
  ["35", "D", "Electricity, gas, steam and air conditioning supply"],
  ["36", "E", "Water collection, treatment and supply"],
  ["37", "E", "Sewerage"],
  ["38", "E", "Waste collection, treatment and disposal activities; materials recovery"],
  ["39", "E", "Remediation activities and other waste management services"],
  ["41", "F", "Construction of buildings"],
  ["42", "F", "Civil engineering"],
  ["43", "F", "Specialized construction activities"],
  ["45", "G", "Wholesale and retail trade and repair of motor vehicles and motorcycles"],
  ["46", "G", "Wholesale trade, except of motor vehicles and motorcycles"],
  ["47", "G", "Retail trade, except of motor vehicles and motorcycles"],
  ["49", "H", "Land transport and transport via pipelines"],
  ["50", "H", "Water transport"],
  ["51", "H", "Air transport"],
  ["52", "H", "Warehousing and support activities for transportation"],
  ["53", "H", "Postal and courier activities"],
  ["55", "I", "Accommodation"],
  ["56", "I", "Food and beverage service activities"],
  ["58", "J", "Publishing activities"],
  ["59", "J", "Motion picture, video and television programme production, sound recording and music publishing activities"],
  ["60", "J", "Broadcasting and programming activities"],
  ["61", "J", "Telecommunications"],
  ["62", "J", "Computer programming, consultancy and related activities"],
  ["63", "J", "Information service activities"],
  ["64", "K", "Financial service activities, except insurance and pension funding"],
  ["65", "K", "Insurance, reinsurance and pension funding, except compulsory social security"],
  ["66", "K", "Other financial activities"],
  ["68", "L", "Real estate activities"],
  ["69", "M", "Legal and accounting activities"],
  ["70", "M", "Activities of head offices; management consultancy activities"],
  ["71", "M", "Architecture and engineering activities; technical testing and analysis"],
  ["72", "M", "Scientific research and development"],
  ["73", "M", "Advertising and market research"],
  ["74", "M", "Other professional, scientific and technical activities"],
  ["75", "M", "Veterinary activities"],
  ["77", "N", "Rental and leasing activities"],
  ["78", "N", "Employment activities"],
  ["79", "N", "Travel agency, tour operator and other reservation service activities"],
  ["80", "N", "Security and investigation activities"],
  ["81", "N", "Services to buildings and landscape activities"],
  ["82", "N", "Office administrative, office support and other business support activities"],
  ["84", "O", "Public administration and defence; compulsory social security"],
  ["85", "P", "Education"],
  ["86", "Q", "Human health activities"],
  ["87", "Q", "Residential care activities"],
  ["88", "Q", "Social work activities without accommodation"],
  ["90", "R", "Creative, arts and entertainment activities"],
  ["91", "R", "Libraries, archives, museums and other cultural activities"],
  ["92", "R", "Gambling and betting activities"],
  ["93", "R", "Sports activities and amusement and recreation activities"],
  ["94", "S", "Activities of membership organizations"],
  ["95", "S", "Repair of computers and personal and household goods"],
  ["96", "S", "Other personal service activities"],
  ["97", "T", "Activities of households as employers of domestic personnel"],
  ["98", "T", "Undifferentiated goods- and services-producing activities of private households for own use"],
  ["99", "U", "Activities of extraterritorial organizations and bodies"],
];

const SECTION_BY_LETTER = new Map(SECTIONS.map(([letter, superSector, title]) => [letter, { letter, superSector, title }]));
const DIVISION_BY_CODE = new Map(DIVISIONS.map(([code, section, title]) => [code, { code, section, title }]));

// The transcribed tables must match the NIC-2008 published Broad Structure.
if (SECTIONS.length !== 21 || DIVISIONS.length !== 88) {
  throw new Error(`NIC tables corrupt: ${SECTIONS.length} sections / ${DIVISIONS.length} divisions (want 21 / 88)`);
}

export type NicResolution = {
  /** Digits-only code as parsed from the filing. */
  code: string;
  /** NIC Division (2-digit) = "industry". */
  divisionCode: string;
  divisionTitle: string;
  /** NIC Section (A–U) = "sector". */
  sectionLetter: string;
  sectionTitle: string;
  superSector: SuperSector;
};

/**
 * Resolve a BRSR-reported NIC code to its Division + Section. Filings report
 * 2–8 digit codes; only the leading 2 (the Division) fix sector/industry.
 *
 * Leading-zero recovery: NIC codes are canonically 5-digit and Sections A/B use
 * Divisions 01–09, so some filers drop the leading zero (e.g. "1113" for crops,
 * canonically "01113"). When the first two digits aren't a real Division we
 * retry against a zero-padded code. A 4-digit class in Divisions 10–99 (e.g.
 * APEX's "1020" → Division 10) hits on the first try and is never repadded.
 */
export function resolveNic(rawCode: string | number | null | undefined): NicResolution | null {
  const digits = String(rawCode ?? "").replace(/\D/g, "");
  if (digits.length < 2) return null;
  let division = DIVISION_BY_CODE.get(digits.slice(0, 2));
  if (!division && digits.length < 5) division = DIVISION_BY_CODE.get(("0" + digits).slice(0, 2));
  if (!division) return null;
  const section = SECTION_BY_LETTER.get(division.section);
  if (!section) return null; // unreachable while the tables self-check; keeps types honest
  return {
    code: digits,
    divisionCode: division.code,
    divisionTitle: division.title,
    sectionLetter: section.letter,
    sectionTitle: section.title,
    superSector: section.superSector,
  };
}

/** One product/service row from BRSR Section A (NIC code + its turnover share). */
export type TurnoverRow = { nicCode: string; turnover: number };

export type SectorShare = {
  sectionLetter: string;
  sectionTitle: string;
  superSector: SuperSector;
  weight: number; // 0..1, fraction of *mapped* turnover
};

export type IndustryShare = {
  divisionCode: string;
  divisionTitle: string;
  sectionLetter: string;
  weight: number; // 0..1, fraction of *mapped* turnover
};

export type TurnoverWeightedSector = {
  /** Turnover-weighted dominant Section, or null if nothing resolved. */
  primarySection: { letter: string; title: string; superSector: SuperSector } | null;
  /** Turnover-weighted dominant Division, or null if nothing resolved. */
  primaryDivision: { code: string; title: string; sectionLetter: string } | null;
  sectionShares: SectorShare[]; // descending weight
  industryShares: IndustryShare[]; // descending weight
  /** Fraction of total reported turnover whose NIC code resolved (0..1). */
  mappedCoverage: number;
  /** Number of product rows that failed to resolve. */
  unmappedRows: number;
};

/**
 * Turnover-weight the resolved Sections/Divisions across a filing's product rows.
 *
 * Shares are normalized over the *mapped* turnover, so they're invariant to
 * whether filers report turnover as a fraction (0.94) or a percent (94) — and to
 * the fact that the "90% of turnover" table never sums to 1. `mappedCoverage`
 * reports how much of the total reported turnover actually resolved, so callers
 * can flag thinly-mapped filings. Rows with non-positive turnover are ignored.
 */
export function turnoverWeightedSector(rows: TurnoverRow[]): TurnoverWeightedSector {
  const sectionWeight = new Map<string, number>();
  const divisionWeight = new Map<string, number>();
  let totalWeight = 0;
  let mappedWeight = 0;
  let unmappedRows = 0;

  for (const row of rows) {
    const w = Number(row.turnover);
    if (!Number.isFinite(w) || w <= 0) continue;
    totalWeight += w;
    const res = resolveNic(row.nicCode);
    if (!res) {
      unmappedRows++;
      continue;
    }
    mappedWeight += w;
    sectionWeight.set(res.sectionLetter, (sectionWeight.get(res.sectionLetter) ?? 0) + w);
    divisionWeight.set(res.divisionCode, (divisionWeight.get(res.divisionCode) ?? 0) + w);
  }

  const sectionShares: SectorShare[] = [...sectionWeight.entries()]
    .map(([letter, w]) => {
      const s = SECTION_BY_LETTER.get(letter)!;
      return { sectionLetter: letter, sectionTitle: s.title, superSector: s.superSector, weight: w / mappedWeight };
    })
    .sort((a, b) => b.weight - a.weight);

  const industryShares: IndustryShare[] = [...divisionWeight.entries()]
    .map(([code, w]) => {
      const d = DIVISION_BY_CODE.get(code)!;
      return { divisionCode: code, divisionTitle: d.title, sectionLetter: d.section, weight: w / mappedWeight };
    })
    .sort((a, b) => b.weight - a.weight);

  const top = sectionShares[0];
  const topDiv = industryShares[0];
  return {
    primarySection: top ? { letter: top.sectionLetter, title: top.sectionTitle, superSector: top.superSector } : null,
    primaryDivision: topDiv
      ? { code: topDiv.divisionCode, title: topDiv.divisionTitle, sectionLetter: topDiv.sectionLetter }
      : null,
    sectionShares,
    industryShares,
    mappedCoverage: totalWeight > 0 ? mappedWeight / totalWeight : 0,
    unmappedRows,
  };
}
