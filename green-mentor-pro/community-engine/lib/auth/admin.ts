import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin allowlist. The whole app is already gated to signed-in users by
 * `middleware.ts`, but the admin hub (the dashboard at `/` and every section
 * under it) is a narrower boundary: the session email must be explicitly
 * allowed. Set `ADMIN_ALLOWED_EMAILS` to a comma-separated list; an entry
 * starting with `@` matches a whole domain (e.g. `@promad.design`).
 *
 * Fails CLOSED: unset/empty ⇒ nobody is an admin. Ported from vismay's
 * `apps/admin/lib/adminAuth.ts` so both apps share one mental model.
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_ALLOWED_EMAILS;
  if (!raw) return false;
  const target = email.trim().toLowerCase();
  const domain = target.slice(target.indexOf("@")); // includes '@'
  for (const entryRaw of raw.split(",")) {
    const entry = entryRaw.trim().toLowerCase();
    if (!entry) continue;
    if (entry.startsWith("@")) {
      if (domain === entry) return true;
    } else if (entry === target) {
      return true;
    }
  }
  return false;
}

/**
 * Guard for admin Server Components and Route Handlers. Returns the signed-in
 * admin `User`, or redirects: unauthenticated → `/login`, signed-in but not on
 * the allowlist → `/library` (the maker tools every signed-in user can still
 * use). Call at the top of any admin-only `page.tsx`.
 */
export async function requireAdmin(redirectTo = "/library"): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/");
  if (!isAdmin(user.email)) redirect(redirectTo);
  return user;
}
