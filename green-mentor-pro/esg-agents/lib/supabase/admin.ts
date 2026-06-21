import { createClient } from "@supabase/supabase-js";

/**
 * Server-only service-role client for agent runs / orchestrator writes that span
 * tenants. NEVER import this into client components. RLS is bypassed — every query
 * must explicitly scope by org_id.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
