// Facility hierarchy (Business Unit / Location) for the signed-in user's org.
// GET → list; POST → create/upsert one site.
import { NextResponse } from "next/server";
import { getEngagementContext } from "@/lib/engagement-session";
import { listSites, createSite } from "@/lib/energy/repo";
import { siteSchema } from "@/lib/energy/schema";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ sites: await listSites(ctx.orgId) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const parsed = siteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
    }
    const site = await createSite(ctx.orgId, ctx.userId, parsed.data);
    return NextResponse.json({ site });
  } catch (e) {
    return jsonError(e);
  }
}
