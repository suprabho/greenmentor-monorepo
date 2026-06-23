import "server-only";
import type { SessionData } from "@/lib/auth/session";

/**
 * Server-only read client for greenmentor-in-be (the legacy BRSR data API). Used
 * ONLY to optionally pre-seed / ground an engagement with data the org already
 * entered — esg-agents never writes back (Supabase is the system of record).
 *
 * -be reads the token from the Authorization: Bearer header only (the BRSR doc's
 * "Cookie: token" quirk is unnecessary) and derives org from the JWT, so we never
 * pass organization_id. Calls are server-to-server → no CORS.
 */
const base = () => (process.env.BE_API_URL || "").replace(/\/+$/, "");

async function beGet<T = unknown>(path: string, session: SessionData): Promise<T | null> {
  if (!base()) return null;
  try {
    const res = await fetch(`${base()}${path}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    // -be success envelope is { success, data }.
    return ((body as { data?: T })?.data ?? body) as T;
  } catch {
    return null;
  }
}

/** Section A profile for a reporting year (7 profile records). */
export function getBrsrCombined(session: SessionData, financialYear: string) {
  return beGet(`/brsr-combined-data?financial_year=${encodeURIComponent(financialYear)}`, session);
}

/** Saved disclosure responses for a reporting year. */
export function getBrsrResponses(session: SessionData, reportingYear?: string) {
  const q = reportingYear ? `?reportingYear=${encodeURIComponent(reportingYear)}` : "";
  return beGet(`/brsr/responses${q}`, session);
}

/** Aggregated energy/emissions rollup for the org (legacy org id is a URL param). */
export function getEnergySummary(session: SessionData) {
  return beGet(`/energy/${encodeURIComponent(session.orgLegacyId)}/summary-data`, session);
}
