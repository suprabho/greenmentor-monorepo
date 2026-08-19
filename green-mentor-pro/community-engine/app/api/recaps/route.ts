/**
 * Weekly ESG recaps — list + on-demand generation.
 *
 * A recap exists independently of any story (the scheduled worker creates them
 * with no story in sight), so this lives at /api/recaps rather than under
 * /api/stories; attaching one to a story is the compose sources route's job.
 *
 * Same admin-allowlist gate + service-role read/write as /api/stories.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { listRecaps } from "@/lib/db/recaps";
import { generateRecap } from "@/lib/recaps/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Generation is the slow part: up to 10 guarded page fetches plus one large
// Claude call over ~120 article summaries. Same ceiling as export/publish.
export const maxDuration = 300;

export async function GET() {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured", recaps: [] });

  const recaps = await listRecaps(createAdminClient(), { limit: 30 });
  return NextResponse.json({ ok: true, recaps });
}

export async function POST(req: Request) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  const body = (await req.json().catch(() => ({}))) as { urls?: string[] };
  const urls = Array.isArray(body.urls) ? body.urls.filter((u) => typeof u === "string") : [];

  try {
    const { recap, warnings } = await generateRecap(createAdminClient(), {
      urls,
      createdBy: gate.user.email ?? null,
    });
    return NextResponse.json({ ok: true, recap, ...(warnings.length ? { warnings } : {}) });
  } catch (e) {
    return NextResponse.json(
      { error: `Recap generation failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
