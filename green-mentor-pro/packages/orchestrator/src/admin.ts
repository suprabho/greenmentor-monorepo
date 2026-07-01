import { createClient } from "@supabase/supabase-js";

/**
 * Server-only service-role client for agent runs / orchestrator writes that span
 * tenants. NEVER import this into client components. RLS is bypassed — every query
 * must explicitly scope by org_id.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // Fail with an actionable message instead of supabase-js's opaque
    // "supabaseKey is required" — the usual cause is SUPABASE_SERVICE_ROLE_KEY
    // missing from the deploy environment (e.g. not set in Vercel prod/preview).
    throw new Error(
      "createAdminClient: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the server environment.",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
