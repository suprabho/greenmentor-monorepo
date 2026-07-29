/**
 * Client helper for PATCH /api/profile. Shared by the onboarding steps and the
 * inline editors on /profile so both get the same error handling — the route
 * always answers JSON (see lib/api-error), so an unwrapped res.json() here is
 * safe.
 */
export interface ProfilePatch {
  displayName?: string;
  phone?: string;
  phoneCountry?: string;
  segment?: string | null;
  goals?: string[];
  planId?: string | null;
  billingCycle?: string | null;
  onboarded?: boolean;
}

export async function saveProfile(patch: ProfilePatch): Promise<void> {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
}
