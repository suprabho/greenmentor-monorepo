/**
 * POST → toggle the signed-in user's RSVP to a webinar.
 * Body { webinar_id: string, attending: boolean }.
 *
 * Writes go through the RLS-bound session client — the "webinar_rsvps own"
 * policy means a user can only ever insert/delete their own rows, so no
 * further authorization is needed here.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { webinar_id?: string; attending?: boolean };
  if (!body.webinar_id || typeof body.attending !== "boolean") {
    return NextResponse.json({ error: "webinar_id and attending are required" }, { status: 400 });
  }

  if (body.attending) {
    const { error } = await supabase
      .from("webinar_rsvps")
      .upsert({ user_id: user.id, webinar_id: body.webinar_id }, { onConflict: "user_id,webinar_id" });
    // A stale card can point at a deleted/unpublished webinar — surface it cleanly.
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { error } = await supabase
      .from("webinar_rsvps")
      .delete()
      .eq("user_id", user.id)
      .eq("webinar_id", body.webinar_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, attending: body.attending });
}
