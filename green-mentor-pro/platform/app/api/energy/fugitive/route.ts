// Fugitive entries (Scope 1). GET → list; POST → create (server resolves GWP +
// equipment leak rate and computes tCO2e per the selected method).
import { NextResponse } from "next/server";
import { getEngagementContext } from "@/lib/engagement-session";
import { listFugitiveEntries, createFugitiveEntry } from "@/lib/energy/repo";
import { fugitiveEntrySchema } from "@/lib/energy/schema";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ entries: await listFugitiveEntries(ctx.orgId) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const parsed = fugitiveEntrySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
    }
    const entry = await createFugitiveEntry(ctx.orgId, ctx.userId, parsed.data);
    return NextResponse.json({ entry });
  } catch (e) {
    return jsonError(e);
  }
}
