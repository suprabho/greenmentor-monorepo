// GET → the seeded Energy reference masters for the entry forms (fuel types,
// units, currencies, electricity sources, transaction types, DISCOMs).
import { NextResponse } from "next/server";
import { getEngagementContext } from "@/lib/engagement-session";
import { getMasters } from "@/lib/energy/repo";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json(await getMasters());
  } catch (e) {
    return jsonError(e);
  }
}
