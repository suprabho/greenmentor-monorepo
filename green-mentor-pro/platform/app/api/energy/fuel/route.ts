// Fuel entries (Scope 1). GET → list org entries; POST → create (server resolves
// the emission factor via EFDB and computes tCO2e).
import { NextResponse } from "next/server";
import { getEngagementContext } from "@/lib/engagement-session";
import { listFuelEntries, createFuelEntry } from "@/lib/energy/repo";
import { fuelEntrySchema } from "@/lib/energy/schema";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ entries: await listFuelEntries(ctx.orgId) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const parsed = fuelEntrySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
    }
    const entry = await createFuelEntry(ctx.orgId, ctx.userId, parsed.data);
    return NextResponse.json({ entry });
  } catch (e) {
    return jsonError(e);
  }
}
