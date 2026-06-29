import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Reads the public project URL + publishable key
 * (both NEXT_PUBLIC_*, safe to ship to the browser). Used from client
 * components for auth (Google OAuth) and RLS-protected reads/writes.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
