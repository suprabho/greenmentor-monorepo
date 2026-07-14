/**
 * NIC-2008 — India's National Industrial Classification (All Economic
 * Activities), Central Statistical Organisation, Ministry of Statistics &
 * Programme Implementation. This is the sector → industry taxonomy every BRSR
 * filing and MSME registration is coded against.
 *
 * Scraped from the CSO's NIC-2008 "Broad Structure" (Sections, Divisions and
 * Groups). The classification is a five-level hierarchy:
 *
 *   Section (A–U)  →  Division (2-digit)  →  Group (3-digit)
 *                  →  Class (4-digit)     →  Sub-class (5-digit)
 *
 * We enumerate the top three levels here — Sections (the "sectors"), Divisions
 * (the "industries") and Groups — which is the whole of the published Broad
 * Structure. The 4-digit classes (403) and 5-digit sub-classes (1304) are the
 * Detailed Structure; we carry only their documented totals (para 48 of the
 * NIC-2008 introduction), not the individual codes.
 *
 * Self-checking: {@link NIC_TOTALS} counts sections/divisions/groups straight
 * off the data below, so the numbers the UI shows can never drift from what was
 * actually transcribed. The published totals are 21 / 88 / 238.
 *
 * Super-sectors group the 21 sections into the classic three-sector economic
 * model the NIC introduction itself cites (para 3, the ILO's primary /
 * secondary / tertiary split) — used purely as the categorical colour key.
 */

export type SuperSector = "primary" | "secondary" | "tertiary";

export interface NicGroup {
  /** 3-digit code, e.g. "131". */
  code: string;
  title: string;
}

export interface NicDivision {
  /** 2-digit code, e.g. "13". */
  code: string;
  title: string;
  groups: NicGroup[];
}

export interface NicSection {
  /** Section letter, A–U. */
  letter: string;
  title: string;
  superSector: SuperSector;
  divisions: NicDivision[];
}

// Compact source tuples — expanded into the typed shapes above at module load.
type RawGroup = readonly [code: string, title: string];
type RawDivision = readonly [code: string, title: string, groups: readonly RawGroup[]];
type RawSection = readonly [
  letter: string,
  title: string,
  superSector: SuperSector,
  divisions: readonly RawDivision[],
];

const RAW: readonly RawSection[] = [
  ["A", "Agriculture, forestry and fishing", "primary", [
    ["01", "Crop and animal production, hunting and related service activities", [
      ["011", "Growing of non-perennial crops"],
      ["012", "Growing of perennial crops"],
      ["013", "Plant propagation"],
      ["014", "Animal production"],
      ["015", "Mixed farming"],
      ["016", "Support activities to agriculture and post-harvest crop activities"],
      ["017", "Hunting, trapping and related service activities"],
    ]],
    ["02", "Forestry and logging", [
      ["021", "Silviculture and other forestry activities"],
      ["022", "Logging"],
      ["023", "Gathering of non-wood forest products"],
      ["024", "Support services to forestry"],
    ]],
    ["03", "Fishing and aquaculture", [
      ["031", "Fishing"],
      ["032", "Aquaculture"],
    ]],
  ]],

  ["B", "Mining and quarrying", "primary", [
    ["05", "Mining of coal and lignite", [
      ["051", "Mining of hard coal"],
      ["052", "Mining of lignite"],
    ]],
    ["06", "Extraction of crude petroleum and natural gas", [
      ["061", "Extraction of crude petroleum"],
      ["062", "Extraction of natural gas"],
    ]],
    ["07", "Mining of metal ores", [
      ["071", "Mining of iron ores"],
      ["072", "Mining of non-ferrous metal ores"],
    ]],
    ["08", "Other mining and quarrying", [
      ["081", "Quarrying of stone, sand and clay"],
      ["089", "Mining and quarrying n.e.c."],
    ]],
    ["09", "Mining support service activities", [
      ["091", "Support activities for petroleum and natural gas mining"],
      ["099", "Support activities for other mining and quarrying"],
    ]],
  ]],

  ["C", "Manufacturing", "secondary", [
    ["10", "Manufacture of food products", [
      ["101", "Processing and preserving of meat"],
      ["102", "Processing and preserving of fish, crustaceans and molluscs"],
      ["103", "Processing and preserving of fruit and vegetables"],
      ["104", "Manufacture of vegetable and animal oils and fats"],
      ["105", "Manufacture of dairy products"],
      ["106", "Manufacture of grain mill products, starches and starch products"],
      ["107", "Manufacture of other food products"],
      ["108", "Manufacture of prepared animal feeds"],
    ]],
    ["11", "Manufacture of beverages", [
      ["110", "Manufacture of beverages"],
    ]],
    ["12", "Manufacture of tobacco products", [
      ["120", "Manufacture of tobacco products"],
    ]],
    ["13", "Manufacture of textiles", [
      ["131", "Spinning, weaving and finishing of textiles"],
      ["139", "Manufacture of other textiles"],
    ]],
    ["14", "Manufacture of wearing apparel", [
      ["141", "Manufacture of wearing apparel, except fur apparel"],
      ["142", "Manufacture of articles of fur"],
      ["143", "Manufacture of knitted and crocheted apparel"],
    ]],
    ["15", "Manufacture of leather and related products", [
      ["151", "Tanning and dressing of leather; manufacture of luggage, handbags, saddlery and harness; dressing and dyeing of fur"],
      ["152", "Manufacture of footwear"],
    ]],
    ["16", "Manufacture of wood and products of wood and cork, except furniture; manufacture of articles of straw and plaiting materials", [
      ["161", "Sawmilling and planing of wood"],
      ["162", "Manufacture of products of wood, cork, straw and plaiting materials"],
    ]],
    ["17", "Manufacture of paper and paper products", [
      ["170", "Manufacture of paper and paper products"],
    ]],
    ["18", "Printing and reproduction of recorded media", [
      ["181", "Printing and service activities related to printing"],
      ["182", "Reproduction of recorded media"],
    ]],
    ["19", "Manufacture of coke and refined petroleum products", [
      ["191", "Manufacture of coke oven products"],
      ["192", "Manufacture of refined petroleum products"],
    ]],
    ["20", "Manufacture of chemicals and chemical products", [
      ["201", "Manufacture of basic chemicals, fertilizer and nitrogen compounds, plastics and synthetic rubber in primary forms"],
      ["202", "Manufacture of other chemical products"],
      ["203", "Manufacture of man-made fibres"],
    ]],
    ["21", "Manufacture of pharmaceuticals, medicinal chemical and botanical products", [
      ["210", "Manufacture of pharmaceuticals, medicinal chemical and botanical products"],
    ]],
    ["22", "Manufacture of rubber and plastics products", [
      ["221", "Manufacture of rubber products"],
      ["222", "Manufacture of plastics products"],
    ]],
    ["23", "Manufacture of other non-metallic mineral products", [
      ["231", "Manufacture of glass and glass products"],
      ["239", "Manufacture of non-metallic mineral products n.e.c."],
    ]],
    ["24", "Manufacture of basic metals", [
      ["241", "Manufacture of basic iron and steel"],
      ["242", "Manufacture of basic precious and other non-ferrous metals"],
      ["243", "Casting of metals"],
    ]],
    ["25", "Manufacture of fabricated metal products, except machinery and equipment", [
      ["251", "Manufacture of structural metal products, tanks, reservoirs and steam generators"],
      ["252", "Manufacture of weapons and ammunition"],
      ["259", "Manufacture of other fabricated metal products; metalworking service activities"],
    ]],
    ["26", "Manufacture of computer, electronic and optical products", [
      ["261", "Manufacture of electronic components"],
      ["262", "Manufacture of computers and peripheral equipment"],
      ["263", "Manufacture of communication equipment"],
      ["264", "Manufacture of consumer electronics"],
      ["265", "Manufacture of measuring, testing, navigating and control equipment; watches and clocks"],
      ["266", "Manufacture of irradiation, electromedical and electrotherapeutic equipment"],
      ["267", "Manufacture of optical instruments and equipment"],
      ["268", "Manufacture of magnetic and optical media"],
    ]],
    ["27", "Manufacture of electrical equipment", [
      ["271", "Manufacture of electric motors, generators, transformers and electricity distribution and control apparatus"],
      ["272", "Manufacture of batteries and accumulators"],
      ["273", "Manufacture of wiring and wiring devices"],
      ["274", "Manufacture of electric lighting equipment"],
      ["275", "Manufacture of domestic appliances"],
      ["279", "Manufacture of other electrical equipment"],
    ]],
    ["28", "Manufacture of machinery and equipment n.e.c.", [
      ["281", "Manufacture of general purpose machinery"],
      ["282", "Manufacture of special-purpose machinery"],
    ]],
    ["29", "Manufacture of motor vehicles, trailers and semi-trailers", [
      ["291", "Manufacture of motor vehicles"],
      ["292", "Manufacture of bodies (coachwork) for motor vehicles; manufacture of trailers and semi-trailers"],
      ["293", "Manufacture of parts and accessories for motor vehicles"],
    ]],
    ["30", "Manufacture of other transport equipment", [
      ["301", "Building of ships and boats"],
      ["302", "Manufacture of railway locomotives and rolling stock"],
      ["303", "Manufacture of air and spacecraft and related machinery"],
      ["304", "Manufacture of military fighting vehicles"],
      ["309", "Manufacture of transport equipment n.e.c."],
    ]],
    ["31", "Manufacture of furniture", [
      ["310", "Manufacture of furniture"],
    ]],
    ["32", "Other manufacturing", [
      ["321", "Manufacture of jewellery, bijouterie and related articles"],
      ["322", "Manufacture of musical instruments"],
      ["323", "Manufacture of sports goods"],
      ["324", "Manufacture of games and toys"],
      ["325", "Manufacture of medical and dental instruments and supplies"],
      ["329", "Other manufacturing n.e.c."],
    ]],
    ["33", "Repair and installation of machinery and equipment", [
      ["331", "Repair of fabricated metal products, machinery and equipment"],
      ["332", "Installation of industrial machinery and equipment"],
    ]],
  ]],

  ["D", "Electricity, gas, steam and air conditioning supply", "secondary", [
    ["35", "Electricity, gas, steam and air conditioning supply", [
      ["351", "Electric power generation, transmission and distribution"],
      ["352", "Manufacture of gas; distribution of gaseous fuels through mains"],
      ["353", "Steam and air conditioning supply"],
    ]],
  ]],

  ["E", "Water supply; sewerage, waste management and remediation activities", "secondary", [
    ["36", "Water collection, treatment and supply", [
      ["360", "Water collection, treatment and supply"],
    ]],
    ["37", "Sewerage", [
      ["370", "Sewerage"],
    ]],
    ["38", "Waste collection, treatment and disposal activities; materials recovery", [
      ["381", "Waste collection"],
      ["382", "Waste treatment and disposal"],
      ["383", "Materials recovery"],
    ]],
    ["39", "Remediation activities and other waste management services", [
      ["390", "Remediation activities and other waste management services"],
    ]],
  ]],

  ["F", "Construction", "secondary", [
    ["41", "Construction of buildings", [
      ["410", "Construction of buildings"],
    ]],
    ["42", "Civil engineering", [
      ["421", "Construction of roads and railways"],
      ["422", "Construction of utility projects"],
      ["429", "Construction of other civil engineering projects"],
    ]],
    ["43", "Specialized construction activities", [
      ["431", "Demolition and site preparation"],
      ["432", "Electrical, plumbing and other construction installation activities"],
      ["433", "Building completion and finishing"],
      ["439", "Other specialized construction activities"],
    ]],
  ]],

  ["G", "Wholesale and retail trade; repair of motor vehicles and motorcycles", "tertiary", [
    ["45", "Wholesale and retail trade and repair of motor vehicles and motorcycles", [
      ["451", "Sale of motor vehicles"],
      ["452", "Maintenance and repair of motor vehicles"],
      ["453", "Sale of motor vehicle parts and accessories"],
      ["454", "Sale, maintenance and repair of motorcycles and related parts and accessories"],
    ]],
    ["46", "Wholesale trade, except of motor vehicles and motorcycles", [
      ["461", "Wholesale on a fee or contract basis"],
      ["462", "Wholesale of agricultural raw materials and live animals"],
      ["463", "Wholesale of food, beverages and tobacco"],
      ["464", "Wholesale of household goods"],
      ["465", "Wholesale of machinery, equipment and supplies"],
      ["466", "Other specialized wholesale"],
      ["469", "Non-specialized wholesale trade"],
    ]],
    ["47", "Retail trade, except of motor vehicles and motorcycles", [
      ["471", "Retail sale in non-specialized stores"],
      ["472", "Retail sale of food, beverages and tobacco in specialized stores"],
      ["473", "Retail sale of automotive fuel in specialized stores"],
      ["474", "Retail sale of information and communications equipment in specialized stores"],
      ["475", "Retail sale of other household equipment in specialized stores"],
      ["476", "Retail sale of cultural and recreation goods in specialized stores"],
      ["477", "Retail sale of other goods in specialized stores"],
      ["478", "Retail sale via stalls and markets"],
      ["479", "Retail trade not in stores, stalls or markets"],
    ]],
  ]],

  ["H", "Transportation and storage", "tertiary", [
    ["49", "Land transport and transport via pipelines", [
      ["491", "Transport via railways"],
      ["492", "Other land transport"],
      ["493", "Transport via pipeline"],
    ]],
    ["50", "Water transport", [
      ["501", "Sea and coastal water transport"],
      ["502", "Inland water transport"],
    ]],
    ["51", "Air transport", [
      ["511", "Passenger air transport"],
      ["512", "Freight air transport"],
    ]],
    ["52", "Warehousing and support activities for transportation", [
      ["521", "Warehousing and storage"],
      ["522", "Support activities for transportation"],
    ]],
    ["53", "Postal and courier activities", [
      ["531", "Postal activities"],
      ["532", "Courier activities"],
    ]],
  ]],

  ["I", "Accommodation and Food service activities", "tertiary", [
    ["55", "Accommodation", [
      ["551", "Short term accommodation activities"],
      ["552", "Camping grounds, recreational vehicle parks and trailer parks"],
      ["559", "Other accommodation"],
    ]],
    ["56", "Food and beverage service activities", [
      ["561", "Restaurants and mobile food service activities"],
      ["562", "Event catering and other food service activities"],
      ["563", "Beverage serving activities"],
    ]],
  ]],

  ["J", "Information and communication", "tertiary", [
    ["58", "Publishing activities", [
      ["581", "Publishing of books, periodicals and other publishing activities"],
      ["582", "Software publishing"],
    ]],
    ["59", "Motion picture, video and television programme production, sound recording and music publishing activities", [
      ["591", "Motion picture, video and television programme activities"],
      ["592", "Sound recording and music publishing activities"],
    ]],
    ["60", "Broadcasting and programming activities", [
      ["601", "Radio broadcasting"],
      ["602", "Television programming and broadcasting activities"],
    ]],
    ["61", "Telecommunications", [
      ["611", "Wired telecommunications activities"],
      ["612", "Wireless telecommunications activities"],
      ["613", "Satellite telecommunications activities"],
      ["619", "Other telecommunications activities"],
    ]],
    ["62", "Computer programming, consultancy and related activities", [
      ["620", "Computer programming, consultancy and related activities"],
    ]],
    ["63", "Information service activities", [
      ["631", "Data processing, hosting and related activities; web portals"],
      ["639", "Other information service activities"],
    ]],
  ]],

  ["K", "Financial and insurance activities", "tertiary", [
    ["64", "Financial service activities, except insurance and pension funding", [
      ["641", "Monetary intermediation"],
      ["642", "Activities of holding companies"],
      ["643", "Trusts, funds and other financial vehicles"],
      ["649", "Other financial service activities, except insurance and pension funding activities"],
    ]],
    ["65", "Insurance, reinsurance and pension funding, except compulsory social security", [
      ["651", "Insurance"],
      ["652", "Reinsurance"],
      ["653", "Pension funding"],
    ]],
    ["66", "Other financial activities", [
      ["661", "Activities auxiliary to financial service activities, except insurance and pension funding"],
      ["662", "Activities auxiliary to insurance and pension funding"],
      ["663", "Fund management activities"],
    ]],
  ]],

  ["L", "Real estate activities", "tertiary", [
    ["68", "Real estate activities", [
      ["681", "Real estate activities with own or leased property"],
      ["682", "Real estate activities on a fee or contract basis"],
    ]],
  ]],

  ["M", "Professional, scientific and technical activities", "tertiary", [
    ["69", "Legal and accounting activities", [
      ["691", "Legal activities"],
      ["692", "Accounting, bookkeeping and auditing activities; tax consultancy"],
    ]],
    ["70", "Activities of head offices; management consultancy activities", [
      ["701", "Activities of head offices"],
      ["702", "Management consultancy activities"],
    ]],
    ["71", "Architecture and engineering activities; technical testing and analysis", [
      ["711", "Architectural and engineering activities and related technical consultancy"],
      ["712", "Technical testing and analysis"],
    ]],
    ["72", "Scientific research and development", [
      ["721", "Research and experimental development on natural sciences and engineering"],
      ["722", "Research and experimental development on social sciences and humanities"],
    ]],
    ["73", "Advertising and market research", [
      ["731", "Advertising"],
      ["732", "Market research and public opinion polling"],
    ]],
    ["74", "Other professional, scientific and technical activities", [
      ["741", "Specialized design activities"],
      ["742", "Photographic activities"],
      ["749", "Other professional, scientific and technical activities n.e.c."],
    ]],
    ["75", "Veterinary activities", [
      ["750", "Veterinary activities"],
    ]],
  ]],

  ["N", "Administrative and support service activities", "tertiary", [
    ["77", "Rental and leasing activities", [
      ["771", "Renting and leasing of motor vehicles"],
      ["772", "Renting and leasing of personal and household goods"],
      ["773", "Renting and leasing of other machinery, equipment and tangible goods n.e.c."],
      ["774", "Leasing of nonfinancial intangible assets"],
    ]],
    ["78", "Employment activities", [
      ["781", "Activities of employment placement agencies"],
      ["782", "Temporary employment agency activities"],
      ["783", "Human resources provision and management of human resources functions"],
    ]],
    ["79", "Travel agency, tour operator and other reservation service activities", [
      ["791", "Travel agency and tour operator activities"],
      ["799", "Other reservation service activities"],
    ]],
    ["80", "Security and investigation activities", [
      ["801", "Private security activities"],
      ["802", "Security systems service activities"],
      ["803", "Investigation activities"],
    ]],
    ["81", "Services to buildings and landscape activities", [
      ["811", "Combined facilities support activities"],
      ["812", "Cleaning activities"],
      ["813", "Landscape care and maintenance service activities"],
    ]],
    ["82", "Office administrative, office support and other business support activities", [
      ["821", "Office administrative and support activities"],
      ["822", "Activities of call centres"],
      ["823", "Organization of conventions and trade shows"],
      ["829", "Business support service activities n.e.c."],
    ]],
  ]],

  ["O", "Public administration and defence; compulsory social security", "tertiary", [
    ["84", "Public administration and defence; compulsory social security", [
      ["841", "Administration of the State and the economic and social policy of the community"],
      ["842", "Provision of services to the community as a whole"],
      ["843", "Compulsory social security activities"],
    ]],
  ]],

  ["P", "Education", "tertiary", [
    ["85", "Education", [
      ["851", "Primary education"],
      ["852", "Secondary education"],
      ["853", "Higher education"],
      ["854", "Other education"],
      ["855", "Educational support services"],
    ]],
  ]],

  ["Q", "Human health and social work activities", "tertiary", [
    ["86", "Human health activities", [
      ["861", "Hospital activities"],
      ["862", "Medical and dental practice activities"],
      ["869", "Other human health activities"],
    ]],
    ["87", "Residential care activities", [
      ["871", "Nursing care facilities"],
      ["872", "Residential care activities for mental retardation, mental health and substance abuse"],
      ["873", "Residential care activities for the elderly and disabled"],
      ["879", "Other residential care activities n.e.c."],
    ]],
    ["88", "Social work activities without accommodation", [
      ["881", "Social work activities without accommodation for the elderly and disabled"],
      ["889", "Other social work activities without accommodation n.e.c."],
    ]],
  ]],

  ["R", "Arts, entertainment and recreation", "tertiary", [
    ["90", "Creative, arts and entertainment activities", [
      ["900", "Creative, arts and entertainment activities"],
    ]],
    ["91", "Libraries, archives, museums and other cultural activities", [
      ["910", "Libraries, archives, museums and other cultural activities"],
    ]],
    ["92", "Gambling and betting activities", [
      ["920", "Gambling and betting activities"],
    ]],
    ["93", "Sports activities and amusement and recreation activities", [
      ["931", "Sports activities"],
      ["932", "Other amusement and recreation activities"],
    ]],
  ]],

  ["S", "Other service activities", "tertiary", [
    ["94", "Activities of membership organizations", [
      ["941", "Activities of business, employers and professional membership organizations"],
      ["942", "Activities of trade unions"],
      ["949", "Activities of other membership organizations"],
    ]],
    ["95", "Repair of computers and personal and household goods", [
      ["951", "Repair of computers and communication equipment"],
      ["952", "Repair of personal and household goods"],
    ]],
    ["96", "Other personal service activities", [
      ["960", "Other personal service activities"],
    ]],
  ]],

  ["T", "Activities of households as employers; undifferentiated goods- and services producing activities of households for own use", "tertiary", [
    ["97", "Activities of households as employers of domestic personnel", [
      ["970", "Activities of households as employers of domestic personnel"],
    ]],
    ["98", "Undifferentiated goods- and services-producing activities of private households for own use", [
      ["981", "Undifferentiated goods-producing activities of private households for own use"],
      ["982", "Undifferentiated service-producing activities of private households for own use"],
    ]],
  ]],

  ["U", "Activities of extraterritorial organizations and bodies", "tertiary", [
    ["99", "Activities of extraterritorial organizations and bodies", [
      ["990", "Activities of extraterritorial organizations and bodies"],
    ]],
  ]],
];

export const NIC_SECTIONS: NicSection[] = RAW.map(([letter, title, superSector, divisions]) => ({
  letter,
  title,
  superSector,
  divisions: divisions.map(([code, dTitle, groups]) => ({
    code,
    title: dTitle,
    groups: groups.map(([gCode, gTitle]) => ({ code: gCode, title: gTitle })),
  })),
}));

/** Number of 3-digit groups under a section (summed across its divisions). */
export function groupCount(section: NicSection): number {
  return section.divisions.reduce((n, d) => n + d.groups.length, 0);
}

/**
 * Headline counts. Sections / divisions / groups are derived from the data
 * above so they stay honest; classes and sub-classes are the documented
 * NIC-2008 totals for the 4- and 5-digit levels (not enumerated here).
 */
export const NIC_TOTALS = {
  sections: NIC_SECTIONS.length,
  divisions: NIC_SECTIONS.reduce((n, s) => n + s.divisions.length, 0),
  groups: NIC_SECTIONS.reduce((n, s) => n + groupCount(s), 0),
  /** 4-digit classes — documented total (NIC-2008 introduction, para 48). */
  classes: 403,
  /** 5-digit sub-classes — documented total (NIC-2008 introduction, para 48). */
  subClasses: 1304,
} as const;

/** As published by the CSO — the UI compares these against the derived counts. */
export const NIC_PUBLISHED = { sections: 21, divisions: 88, groups: 238 } as const;

export interface SuperSectorMeta {
  label: string;
  /** Categorical hue — validated dataviz slots 1/2/3 (blue / aqua / yellow). */
  hue: string;
  blurb: string;
}

/**
 * The three-sector economic model the NIC introduction cites (ILO, para 3),
 * used as the categorical colour key. Hues are validated dataviz categorical
 * slots 1–3; worst-adjacent CVD ΔE 47.2 (well clear of the ≥12 target). Aqua
 * and yellow fall below 3:1 on white, so every mark carries a direct value
 * label and a table view (the relief rule) — identity is never colour-alone.
 */
export const SUPER_SECTORS: Record<SuperSector, SuperSectorMeta> = {
  primary: {
    label: "Primary",
    hue: "#2a78d6",
    blurb: "Drawing raw materials from nature — agriculture, forestry, fishing and mining.",
  },
  secondary: {
    label: "Secondary",
    hue: "#1baf7a",
    blurb: "Turning materials into goods and power — manufacturing, utilities and construction.",
  },
  tertiary: {
    label: "Tertiary",
    hue: "#eda100",
    blurb: "Services — trade, transport, finance, health, public administration and more.",
  },
};

export const SUPER_SECTOR_ORDER: readonly SuperSector[] = ["primary", "secondary", "tertiary"];

export interface SuperSectorRollup {
  sector: SuperSector;
  sections: number;
  divisions: number;
  groups: number;
}

/** Sections / divisions / groups rolled up to each super-sector, in canonical order. */
export function superSectorRollup(): SuperSectorRollup[] {
  return SUPER_SECTOR_ORDER.map((sector) => {
    const members = NIC_SECTIONS.filter((s) => s.superSector === sector);
    return {
      sector,
      sections: members.length,
      divisions: members.reduce((n, s) => n + s.divisions.length, 0),
      groups: members.reduce((n, s) => n + groupCount(s), 0),
    };
  });
}
