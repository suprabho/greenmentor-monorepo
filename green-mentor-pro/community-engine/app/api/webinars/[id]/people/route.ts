/**
 * GET → the people attached to a webinar: RSVPs (with the name, email and phone
 * each learner gave) and attendees (in-app joins plus anything imported from a
 * Zoom report). Read by the People section of the webinar's expanded row.
 *
 * Same admin-allowlist gate + service-role read as the polls routes, and the
 * same empty-response shortcut when SUPABASE_SERVICE_ROLE_KEY isn't set. Both
 * tables live platform-side and are unreadable without the service role, so
 * there's no way to reach this data except through this gate.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { listAttendance, listRsvps } from "@/lib/db/webinar-people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  if (!isServiceRoleConfigured()) return NextResponse.json({ rsvps: [], attendance: [] });

  try {
    const { id } = await params;
    const admin = createAdminClient();
    const [rsvps, attendance] = await Promise.all([listRsvps(admin, id), listAttendance(admin, id)]);
    return NextResponse.json({ rsvps, attendance });
  } catch (e) {
    return NextResponse.json({ error: `Could not load people: ${(e as Error).message}` }, { status: 500 });
  }
}
