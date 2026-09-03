/**
 * Country → flag emoji for the job share card's location row.
 *
 * `community_jobs.country` is free text the admin types ("India", "UAE",
 * "Bangladesh" …), not an ISO code, so the lookup is by name. The table below
 * mirrors the platform's onboarding country list (every ISO-3166-1 country plus
 * inhabited territories — different workspace, so no cross-app import), with a
 * second block of the aliases people actually write. Matching is case- and
 * punctuation-insensitive; a bare two-letter code ("IN", "ae") also works.
 *
 * A flag is two Regional Indicator Symbols (U+1F1E6 + letter offset); which
 * glyph a platform draws is up to its emoji font — see the Noto Color Emoji
 * stack the card applies so preview and headless export agree.
 */

const COUNTRY_ISO: Record<string, string> = {
  "Afghanistan": "AF",
  "Åland Islands": "AX",
  "Albania": "AL",
  "Algeria": "DZ",
  "American Samoa": "AS",
  "Andorra": "AD",
  "Angola": "AO",
  "Anguilla": "AI",
  "Antigua and Barbuda": "AG",
  "Argentina": "AR",
  "Armenia": "AM",
  "Aruba": "AW",
  "Australia": "AU",
  "Austria": "AT",
  "Azerbaijan": "AZ",
  "Bahamas": "BS",
  "Bahrain": "BH",
  "Bangladesh": "BD",
  "Barbados": "BB",
  "Belarus": "BY",
  "Belgium": "BE",
  "Belize": "BZ",
  "Benin": "BJ",
  "Bermuda": "BM",
  "Bhutan": "BT",
  "Bolivia": "BO",
  "Bosnia and Herzegovina": "BA",
  "Botswana": "BW",
  "Brazil": "BR",
  "British Indian Ocean Territory": "IO",
  "British Virgin Islands": "VG",
  "Brunei": "BN",
  "Bulgaria": "BG",
  "Burkina Faso": "BF",
  "Burundi": "BI",
  "Cambodia": "KH",
  "Cameroon": "CM",
  "Canada": "CA",
  "Cape Verde": "CV",
  "Caribbean Netherlands": "BQ",
  "Cayman Islands": "KY",
  "Central African Republic": "CF",
  "Chad": "TD",
  "Chile": "CL",
  "China": "CN",
  "Christmas Island": "CX",
  "Cocos (Keeling) Islands": "CC",
  "Colombia": "CO",
  "Comoros": "KM",
  "Congo (DRC)": "CD",
  "Congo (Republic)": "CG",
  "Cook Islands": "CK",
  "Costa Rica": "CR",
  "Côte d'Ivoire": "CI",
  "Croatia": "HR",
  "Cuba": "CU",
  "Curaçao": "CW",
  "Cyprus": "CY",
  "Czech Republic": "CZ",
  "Denmark": "DK",
  "Djibouti": "DJ",
  "Dominica": "DM",
  "Dominican Republic": "DO",
  "Ecuador": "EC",
  "Egypt": "EG",
  "El Salvador": "SV",
  "Equatorial Guinea": "GQ",
  "Eritrea": "ER",
  "Estonia": "EE",
  "Eswatini": "SZ",
  "Ethiopia": "ET",
  "Falkland Islands": "FK",
  "Faroe Islands": "FO",
  "Fiji": "FJ",
  "Finland": "FI",
  "France": "FR",
  "French Guiana": "GF",
  "French Polynesia": "PF",
  "Gabon": "GA",
  "Gambia": "GM",
  "Georgia": "GE",
  "Germany": "DE",
  "Ghana": "GH",
  "Gibraltar": "GI",
  "Greece": "GR",
  "Greenland": "GL",
  "Grenada": "GD",
  "Guadeloupe": "GP",
  "Guam": "GU",
  "Guatemala": "GT",
  "Guernsey": "GG",
  "Guinea": "GN",
  "Guinea-Bissau": "GW",
  "Guyana": "GY",
  "Haiti": "HT",
  "Honduras": "HN",
  "Hong Kong": "HK",
  "Hungary": "HU",
  "Iceland": "IS",
  "India": "IN",
  "Indonesia": "ID",
  "Iran": "IR",
  "Iraq": "IQ",
  "Ireland": "IE",
  "Isle of Man": "IM",
  "Israel": "IL",
  "Italy": "IT",
  "Jamaica": "JM",
  "Japan": "JP",
  "Jersey": "JE",
  "Jordan": "JO",
  "Kazakhstan": "KZ",
  "Kenya": "KE",
  "Kiribati": "KI",
  "Kosovo": "XK",
  "Kuwait": "KW",
  "Kyrgyzstan": "KG",
  "Laos": "LA",
  "Latvia": "LV",
  "Lebanon": "LB",
  "Lesotho": "LS",
  "Liberia": "LR",
  "Libya": "LY",
  "Liechtenstein": "LI",
  "Lithuania": "LT",
  "Luxembourg": "LU",
  "Macau": "MO",
  "Madagascar": "MG",
  "Malawi": "MW",
  "Malaysia": "MY",
  "Maldives": "MV",
  "Mali": "ML",
  "Malta": "MT",
  "Marshall Islands": "MH",
  "Martinique": "MQ",
  "Mauritania": "MR",
  "Mauritius": "MU",
  "Mayotte": "YT",
  "Mexico": "MX",
  "Micronesia": "FM",
  "Moldova": "MD",
  "Monaco": "MC",
  "Mongolia": "MN",
  "Montenegro": "ME",
  "Montserrat": "MS",
  "Morocco": "MA",
  "Mozambique": "MZ",
  "Myanmar": "MM",
  "Namibia": "NA",
  "Nauru": "NR",
  "Nepal": "NP",
  "Netherlands": "NL",
  "New Caledonia": "NC",
  "New Zealand": "NZ",
  "Nicaragua": "NI",
  "Niger": "NE",
  "Nigeria": "NG",
  "Niue": "NU",
  "Norfolk Island": "NF",
  "North Korea": "KP",
  "North Macedonia": "MK",
  "Northern Mariana Islands": "MP",
  "Norway": "NO",
  "Oman": "OM",
  "Pakistan": "PK",
  "Palau": "PW",
  "Palestine": "PS",
  "Panama": "PA",
  "Papua New Guinea": "PG",
  "Paraguay": "PY",
  "Peru": "PE",
  "Philippines": "PH",
  "Poland": "PL",
  "Portugal": "PT",
  "Puerto Rico": "PR",
  "Qatar": "QA",
  "Réunion": "RE",
  "Romania": "RO",
  "Russia": "RU",
  "Rwanda": "RW",
  "Saint Barthélemy": "BL",
  "Saint Helena": "SH",
  "Saint Kitts and Nevis": "KN",
  "Saint Lucia": "LC",
  "Saint Martin": "MF",
  "Saint Pierre and Miquelon": "PM",
  "Saint Vincent and the Grenadines": "VC",
  "Samoa": "WS",
  "San Marino": "SM",
  "São Tomé and Príncipe": "ST",
  "Saudi Arabia": "SA",
  "Senegal": "SN",
  "Serbia": "RS",
  "Seychelles": "SC",
  "Sierra Leone": "SL",
  "Singapore": "SG",
  "Sint Maarten": "SX",
  "Slovakia": "SK",
  "Slovenia": "SI",
  "Solomon Islands": "SB",
  "Somalia": "SO",
  "South Africa": "ZA",
  "South Korea": "KR",
  "South Sudan": "SS",
  "Spain": "ES",
  "Sri Lanka": "LK",
  "Sudan": "SD",
  "Suriname": "SR",
  "Sweden": "SE",
  "Switzerland": "CH",
  "Syria": "SY",
  "Taiwan": "TW",
  "Tajikistan": "TJ",
  "Tanzania": "TZ",
  "Thailand": "TH",
  "Timor-Leste": "TL",
  "Togo": "TG",
  "Tokelau": "TK",
  "Tonga": "TO",
  "Trinidad and Tobago": "TT",
  "Tunisia": "TN",
  "Turkey": "TR",
  "Turkmenistan": "TM",
  "Turks and Caicos Islands": "TC",
  "Tuvalu": "TV",
  "U.S. Virgin Islands": "VI",
  "Uganda": "UG",
  "Ukraine": "UA",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
  "Uruguay": "UY",
  "Uzbekistan": "UZ",
  "Vanuatu": "VU",
  "Vatican City": "VA",
  "Venezuela": "VE",
  "Vietnam": "VN",
  "Wallis and Futuna": "WF",
  "Western Sahara": "EH",
  "Yemen": "YE",
  "Zambia": "ZM",
  "Zimbabwe": "ZW",
};

/** Short forms, older names and demonyms the admin form is likely to get. */
const COUNTRY_ALIASES: Record<string, string> = {
  "UAE": "AE",
  "U.A.E.": "AE",
  "Emirates": "AE",
  "UK": "GB",
  "U.K.": "GB",
  "Great Britain": "GB",
  "Britain": "GB",
  "England": "GB",
  "Scotland": "GB",
  "Wales": "GB",
  "Northern Ireland": "GB",
  "USA": "US",
  "U.S.A.": "US",
  "U.S.": "US",
  "US": "US",
  "United States of America": "US",
  "America": "US",
  "KSA": "SA",
  "Saudi": "SA",
  "Kingdom of Saudi Arabia": "SA",
  "Bharat": "IN",
  "Republic of India": "IN",
  "Sri lanka": "LK",
  "Ceylon": "LK",
  "Burma": "MM",
  "Czechia": "CZ",
  "Türkiye": "TR",
  "Turkiye": "TR",
  "Holland": "NL",
  "The Netherlands": "NL",
  "Republic of Ireland": "IE",
  "Korea": "KR",
  "Republic of Korea": "KR",
  "Vietnam": "VN",
  "Viet Nam": "VN",
  "Russian Federation": "RU",
  "Iran, Islamic Republic of": "IR",
  "Swaziland": "SZ",
  "Ivory Coast": "CI",
  "Cabo Verde": "CV",
  "East Timor": "TL",
  "Macao": "MO",
  "Hong Kong SAR": "HK",
  "Macau SAR": "MO",
  "DRC": "CD",
  "DR Congo": "CD",
  "Democratic Republic of the Congo": "CD",
  "Republic of the Congo": "CG",
  "Congo": "CG",
  "Vatican": "VA",
  "Holy See": "VA",
  "Brunei Darussalam": "BN",
  "Lao PDR": "LA",
  "Syrian Arab Republic": "SY",
  "Tanzania, United Republic of": "TZ",
  "Bolivia, Plurinational State of": "BO",
  "Venezuela, Bolivarian Republic of": "VE",
  "Moldova, Republic of": "MD",
  "Micronesia, Federated States of": "FM",
  "Palestinian Territory": "PS",
  "State of Palestine": "PS",
  "Federal Republic of Germany": "DE",
  "Deutschland": "DE",
  "People's Republic of China": "CN",
  "PRC": "CN",
  "Mainland China": "CN",
  "Remote": "",
  "Worldwide": "",
  "Global": "",
  "Anywhere": "",
};

/** Fold a name for lookup: case, accents, punctuation and spacing all ignored. */
function foldName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const KNOWN_CODES: Set<string> = new Set(Object.values(COUNTRY_ISO));

const LOOKUP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [name, iso] of Object.entries(COUNTRY_ISO)) m.set(foldName(name), iso);
  for (const [name, iso] of Object.entries(COUNTRY_ALIASES)) m.set(foldName(name), iso);
  return m;
})();

/** ISO-3166-1 alpha-2 code for a country name as typed by an admin, or null.
 *  The empty-string sentinel in the alias table (Remote / Worldwide) deliberately
 *  resolves to null — there is no flag for "anywhere". */
export function countryIsoFor(country: string | null | undefined): string | null {
  if (!country) return null;
  const trimmed = country.trim();
  if (!trimmed) return null;
  const hit = LOOKUP.get(foldName(trimmed));
  if (hit !== undefined) return hit || null;
  // A bare code ("IN", "ae") — only if it names a country we know, so a
  // two-letter word like "Go" can't turn into a stray flag.
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const code = trimmed.toUpperCase();
    return KNOWN_CODES.has(code) ? code : null;
  }
  return null;
}

/** Two Regional Indicator Symbols for an alpha-2 code: "IN" → 🇮🇳. */
export function flagForIso(iso: string): string {
  const A = 0x1f1e6;
  return String.fromCodePoint(
    ...iso
      .toUpperCase()
      .split("")
      .map((ch) => A + ch.charCodeAt(0) - 65)
  );
}

/** Flag emoji for a country name ("India" → 🇮🇳), or null when unknown. */
export function flagEmojiFor(country: string | null | undefined): string | null {
  const iso = countryIsoFor(country);
  return iso ? flagForIso(iso) : null;
}

/**
 * Best-effort country for a job: the explicit `country` column, else the last
 * comma-separated segment of the free-text location ("Pune, India" → "India")
 * when that names a country we know. Returns null rather than guessing.
 */
export function jobCountryOf(job: { country: string | null; location: string | null }): string | null {
  const explicit = job.country?.trim();
  if (explicit) return explicit;
  const tail = job.location?.split(",").pop()?.trim();
  return tail && countryIsoFor(tail) ? tail : null;
}

/**
 * The location row's text: location and country together, without repeating
 * the country when the location already ends with it.
 *   ("Pune, India", "India")   → "Pune, India"
 *   ("Dubai", "UAE")           → "Dubai, UAE"
 *   ("India", "India")         → "India"
 *   (null, "Bangladesh")       → "Bangladesh"
 */
export function locationWithCountry(location: string | null, country: string | null): string | null {
  const loc = location?.trim() || null;
  const ctry = country?.trim() || null;
  if (!loc) return ctry;
  if (!ctry) return loc;
  const locIso = countryIsoFor(loc.split(",").pop()?.trim() ?? "");
  const ctryIso = countryIsoFor(ctry);
  // Same country by code (so "…, India" vs "IN" dedupes too) or by plain text.
  if ((locIso && ctryIso && locIso === ctryIso) || foldName(loc).endsWith(foldName(ctry))) return loc;
  return `${loc}, ${ctry}`;
}
