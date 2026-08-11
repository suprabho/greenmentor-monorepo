import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { fetchShareCardJobs } from "@/lib/share-cards/jobs";

/**
 * Published jobs for the Share Cards Studio (picker list + layer resolution).
 * Reads jobs_public, so draft jobs never appear. Middleware already gates the
 * app to signed-in users; this route additionally requires the admin
 * allowlist, matching the studio page itself.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return Response.json({ ok: false, error: "Not authorized" }, { status: 403 });
  }

  const limitRaw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, limitRaw)) : 60;

  try {
    const items = await fetchShareCardJobs(supabase, { limit });
    return Response.json({ ok: true, items });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Query failed" },
      { status: 500 }
    );
  }
}
