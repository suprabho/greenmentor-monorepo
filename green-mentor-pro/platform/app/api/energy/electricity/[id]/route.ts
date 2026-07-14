// A single electricity entry. PUT → edit (recomputes, resets to Submitted);
// DELETE → remove.
import { NextResponse } from "next/server";
import { getEngagementContext } from "@/lib/engagement-session";
import { updateElectricityEntry, deleteEntry } from "@/lib/energy/repo";
import { electricityEntrySchema } from "@/lib/energy/schema";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await params;
    const parsed = electricityEntrySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
    }
    const entry = await updateElectricityEntry(ctx.orgId, id, parsed.data);
    return NextResponse.json({ entry });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await params;
    await deleteEntry("energy_electricity_entries", ctx.orgId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
