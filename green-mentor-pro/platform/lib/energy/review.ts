// Shared maker–checker handler for approve/reject, used by both the fuel and
// electricity review routes. Only org admins/managers may review; the decision
// stamps status + reviewer + (on reject) feedback comment.
import { NextResponse } from "next/server";
import { getEngagementContext } from "@/lib/engagement-session";
import { getMemberRole, isChecker, setEntryReview } from "@/lib/energy/repo";
import { jsonError } from "@/lib/api-error";

type EnergyTable = "energy_fuel_entries" | "energy_electricity_entries";

export async function handleReview(req: Request, table: EnergyTable, id: string) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const role = await getMemberRole(ctx.orgId, ctx.userId);
    if (!isChecker(role)) {
      return NextResponse.json({ error: "only an admin or manager can review entries" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { decision?: string; feedback?: string };
    if (body.decision !== "Accepted" && body.decision !== "Rejected") {
      return NextResponse.json({ error: "decision must be 'Accepted' or 'Rejected'" }, { status: 400 });
    }
    if (body.decision === "Rejected" && !body.feedback?.trim()) {
      return NextResponse.json({ error: "feedback is required to reject" }, { status: 400 });
    }

    await setEntryReview(table, ctx.orgId, id, ctx.userId, body.decision, body.feedback);
    return NextResponse.json({ ok: true, status: body.decision });
  } catch (e) {
    return jsonError(e);
  }
}
