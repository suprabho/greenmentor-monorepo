/**
 * Best-effort country detection from the visitor's IP / ISP, used to pre-fill
 * the phone country code on the welcome step. Calls a free IP-geolocation
 * endpoint; on any failure (offline, blocked, rate-limited) the caller falls
 * back to its own default so this never blocks the form.
 */

import { DEFAULT_COUNTRY_ISO, countryByIso } from "@/lib/data/country-codes";

export interface DetectedCountry {
  iso: string;
}

/**
 * Resolve the visitor's country ISO from their IP. Returns a country we
 * actually have a dial code for, or the default. Aborts after `timeoutMs` so a
 * slow lookup doesn't delay the default pre-fill.
 */
export async function detectCountryIso(timeoutMs = 2500): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://ipapi.co/json/", {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return DEFAULT_COUNTRY_ISO;

    const data: { country_code?: string } = await res.json();
    const iso = data.country_code?.toUpperCase();

    // Only honour the detection if it maps to a country in our dial list;
    // otherwise the dropdown would have no matching option.
    return iso && countryByIso(iso) ? iso : DEFAULT_COUNTRY_ISO;
  } catch {
    return DEFAULT_COUNTRY_ISO;
  } finally {
    clearTimeout(timer);
  }
}
