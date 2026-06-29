import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS. ONLY for trusted server-side
 * jobs (the feed ingestion worker writes articles/entities). Never import this
 * into client code or a request handler that runs on behalf of a user.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "createAdminClient needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the worker write key).",
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
