import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS. ONLY for trusted server-side
 * handlers that have ALREADY passed the admin allowlist check (`isAdmin`);
 * never import this into client code. Ported from platform/lib/supabase/admin.ts
 * (the feed worker's write client) — the Pipeline tab uses it to curate the
 * shared `entities` vocabulary, which is public-read/worker-write under RLS.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "createAdminClient needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the worker write key)."
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** True when the service-role key is present (entity curation is enabled). */
export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
