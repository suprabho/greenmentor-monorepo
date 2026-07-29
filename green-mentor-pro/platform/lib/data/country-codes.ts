/**
 * Country dial codes for the onboarding phone field. `iso` is the ISO-3166
 * alpha-2 code (matches what IP-geolocation returns, so we can map a detected
 * country straight to a default), `dial` is the E.164 calling code.
 */
export interface Country {
  iso: string;
  name: string;
  dial: string;
  /**
   * Valid national-number digit counts (excluding the dial code). Used to
   * validate the phone field against the picked country. Omit where the
   * length varies too widely to pin down — callers fall back to a generic
   * 7–15 digit range in that case.
   */
  nsnLengths?: number[];
}

export const COUNTRIES: Country[] = [
  { iso: "IN", name: "India", dial: "+91", nsnLengths: [10] },
  { iso: "US", name: "United States", dial: "+1", nsnLengths: [10] },
  { iso: "GB", name: "United Kingdom", dial: "+44", nsnLengths: [10] },
  { iso: "CA", name: "Canada", dial: "+1", nsnLengths: [10] },
  { iso: "AU", name: "Australia", dial: "+61", nsnLengths: [9] },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", nsnLengths: [8, 9] },
  { iso: "SG", name: "Singapore", dial: "+65", nsnLengths: [8] },
  { iso: "DE", name: "Germany", dial: "+49" },
  { iso: "FR", name: "France", dial: "+33", nsnLengths: [9] },
  { iso: "NL", name: "Netherlands", dial: "+31", nsnLengths: [9] },
  { iso: "IE", name: "Ireland", dial: "+353" },
  { iso: "ES", name: "Spain", dial: "+34", nsnLengths: [9] },
  { iso: "IT", name: "Italy", dial: "+39", nsnLengths: [9, 10] },
  { iso: "CH", name: "Switzerland", dial: "+41", nsnLengths: [9] },
  { iso: "SE", name: "Sweden", dial: "+46" },
  { iso: "NO", name: "Norway", dial: "+47", nsnLengths: [8] },
  { iso: "DK", name: "Denmark", dial: "+45", nsnLengths: [8] },
  { iso: "BE", name: "Belgium", dial: "+32", nsnLengths: [8, 9] },
  { iso: "PT", name: "Portugal", dial: "+351", nsnLengths: [9] },
  { iso: "PL", name: "Poland", dial: "+48", nsnLengths: [9] },
  { iso: "SA", name: "Saudi Arabia", dial: "+966", nsnLengths: [9] },
  { iso: "QA", name: "Qatar", dial: "+974", nsnLengths: [8] },
  { iso: "KW", name: "Kuwait", dial: "+965", nsnLengths: [8] },
  { iso: "BH", name: "Bahrain", dial: "+973", nsnLengths: [8] },
  { iso: "OM", name: "Oman", dial: "+968", nsnLengths: [8] },
  { iso: "ZA", name: "South Africa", dial: "+27", nsnLengths: [9] },
  { iso: "NG", name: "Nigeria", dial: "+234" },
  { iso: "KE", name: "Kenya", dial: "+254", nsnLengths: [9] },
  { iso: "EG", name: "Egypt", dial: "+20", nsnLengths: [9, 10] },
  { iso: "NZ", name: "New Zealand", dial: "+64" },
  { iso: "JP", name: "Japan", dial: "+81", nsnLengths: [9, 10] },
  { iso: "CN", name: "China", dial: "+86", nsnLengths: [11] },
  { iso: "HK", name: "Hong Kong", dial: "+852", nsnLengths: [8] },
  { iso: "KR", name: "South Korea", dial: "+82", nsnLengths: [9, 10] },
  { iso: "MY", name: "Malaysia", dial: "+60", nsnLengths: [9, 10] },
  { iso: "ID", name: "Indonesia", dial: "+62" },
  { iso: "PH", name: "Philippines", dial: "+63", nsnLengths: [10] },
  { iso: "TH", name: "Thailand", dial: "+66", nsnLengths: [9] },
  { iso: "VN", name: "Vietnam", dial: "+84", nsnLengths: [9, 10] },
  { iso: "BD", name: "Bangladesh", dial: "+880", nsnLengths: [10] },
  { iso: "PK", name: "Pakistan", dial: "+92", nsnLengths: [10] },
  { iso: "LK", name: "Sri Lanka", dial: "+94", nsnLengths: [9] },
  { iso: "NP", name: "Nepal", dial: "+977", nsnLengths: [10] },
  { iso: "BR", name: "Brazil", dial: "+55", nsnLengths: [10, 11] },
  { iso: "MX", name: "Mexico", dial: "+52", nsnLengths: [10] },
  { iso: "AR", name: "Argentina", dial: "+54", nsnLengths: [10, 11] },
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
