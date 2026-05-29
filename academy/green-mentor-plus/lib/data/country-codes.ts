/**
 * Country dial codes for the onboarding phone field. `iso` is the ISO-3166
 * alpha-2 code (matches what IP-geolocation returns, so we can map a detected
 * country straight to a default), `dial` is the E.164 calling code.
 */
export interface Country {
  iso: string;
  name: string;
  dial: string;
}

export const COUNTRIES: Country[] = [
  { iso: "IN", name: "India", dial: "+91" },
  { iso: "US", name: "United States", dial: "+1" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
  { iso: "CA", name: "Canada", dial: "+1" },
  { iso: "AU", name: "Australia", dial: "+61" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971" },
  { iso: "SG", name: "Singapore", dial: "+65" },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "FR", name: "France", dial: "+33" },
  { iso: "NL", name: "Netherlands", dial: "+31" },
  { iso: "IE", name: "Ireland", dial: "+353" },
  { iso: "ES", name: "Spain", dial: "+34" },
  { iso: "IT", name: "Italy", dial: "+39" },
  { iso: "CH", name: "Switzerland", dial: "+41" },
  { iso: "SE", name: "Sweden", dial: "+46" },
  { iso: "NO", name: "Norway", dial: "+47" },
  { iso: "DK", name: "Denmark", dial: "+45" },
  { iso: "BE", name: "Belgium", dial: "+32" },
  { iso: "PT", name: "Portugal", dial: "+351" },
  { iso: "PL", name: "Poland", dial: "+48" },
  { iso: "SA", name: "Saudi Arabia", dial: "+966" },
  { iso: "QA", name: "Qatar", dial: "+974" },
  { iso: "KW", name: "Kuwait", dial: "+965" },
  { iso: "BH", name: "Bahrain", dial: "+973" },
  { iso: "OM", name: "Oman", dial: "+968" },
  { iso: "ZA", name: "South Africa", dial: "+27" },
  { iso: "NG", name: "Nigeria", dial: "+234" },
  { iso: "KE", name: "Kenya", dial: "+254" },
  { iso: "EG", name: "Egypt", dial: "+20" },
  { iso: "NZ", name: "New Zealand", dial: "+64" },
  { iso: "JP", name: "Japan", dial: "+81" },
  { iso: "CN", name: "China", dial: "+86" },
  { iso: "HK", name: "Hong Kong", dial: "+852" },
  { iso: "KR", name: "South Korea", dial: "+82" },
  { iso: "MY", name: "Malaysia", dial: "+60" },
  { iso: "ID", name: "Indonesia", dial: "+62" },
  { iso: "PH", name: "Philippines", dial: "+63" },
  { iso: "TH", name: "Thailand", dial: "+66" },
  { iso: "VN", name: "Vietnam", dial: "+84" },
  { iso: "BD", name: "Bangladesh", dial: "+880" },
  { iso: "PK", name: "Pakistan", dial: "+92" },
  { iso: "LK", name: "Sri Lanka", dial: "+94" },
  { iso: "NP", name: "Nepal", dial: "+977" },
  { iso: "BR", name: "Brazil", dial: "+55" },
  { iso: "MX", name: "Mexico", dial: "+52" },
  { iso: "AR", name: "Argentina", dial: "+54" },
];

/** Sensible default when geolocation is unavailable — GreenMentor is India-first. */
export const DEFAULT_COUNTRY_ISO = "IN";

const byIso = new Map(COUNTRIES.map((c) => [c.iso, c]));

export function countryByIso(iso: string | null | undefined): Country | undefined {
  return iso ? byIso.get(iso.toUpperCase()) : undefined;
}

/** ISO-3166 alpha-2 → regional-indicator flag emoji (🇮🇳, 🇺🇸, …). */
export function flagEmoji(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/./g, (ch) =>
      String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65),
    );
}
