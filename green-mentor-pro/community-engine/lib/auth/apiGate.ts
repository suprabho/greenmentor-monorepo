import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin-allowlist gate for Route Handlers. Shared by the compose API routes
 * so the same check isn't re-copied per route (see the private
 * requireAdminUser/requireAdminGate helpers in app/api/stories/route.ts and
 * app/api/stories/[id]/route.ts, which predate this and are left as-is).
 */
export async function requireAdminApiUser(): Promise<{ user: User } | { error: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!isAdmin(user.email)) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { user };
}
