import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { jsonError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Mint a short-lived Zoom Meeting SDK signature so a signed-in learner can join
// the embedded webinar. Same shape as the Academy signed-URL route
// (app/api/academy/lessons/[lessonId]/signed-url/route.ts): authenticate with
// the RLS-bound session client, read the meeting details with the service-role
// client, and hand back only a scoped, expiring credential. The SDK secret is
// server-only and never leaves this route — the browser gets the computed
// signature, the public SDK key, and the join fields.
//
// Access is "any signed-in user" (no RSVP gate), by product decision.

const SIGNATURE_TTL_SECONDS = 60 * 60 * 2; // 2h — Zoom caps the signature at 48h

function base64url(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

    const sdkKey = process.env.ZOOM_SDK_KEY;
    const sdkSecret = process.env.ZOOM_SDK_SECRET;
    if (!sdkKey || !sdkSecret) {
      return NextResponse.json({ error: "Zoom is not configured on the server" }, { status: 503 });
    }

    const { id } = await params;
    const admin = createAdminClient();
    const { data: webinar, error } = await admin
      .from("community_webinars")
      .select("id, zoom_meeting_number, zoom_passcode, status")
      .eq("id", id)
      .maybeSingle();
    if (error) return jsonError(error);
    if (!webinar) return NextResponse.json({ error: "webinar not found" }, { status: 404 });
    if (!webinar.zoom_meeting_number) {
      return NextResponse.json({ error: "this webinar has no Zoom meeting yet" }, { status: 404 });
    }

    const meetingNumber = String(webinar.zoom_meeting_number).replace(/\s+/g, "");
    const iat = Math.floor(Date.now() / 1000) - 30; // small clock-skew cushion
    const exp = iat + SIGNATURE_TTL_SECONDS;
    const header = base64url({ alg: "HS256", typ: "JWT" });
    const payload = base64url({
      appKey: sdkKey,
      sdkKey,
      mn: meetingNumber,
      role: 0, // 0 = attendee (join-only); the host runs the meeting from Zoom
      iat,
      exp,
      tokenExp: exp,
    });
    const signature =
      `${header}.${payload}.` +
      createHmac("sha256", sdkSecret).update(`${header}.${payload}`).digest("base64url");

    const fullName = user.user_metadata?.full_name as string | undefined;
    return NextResponse.json({
      signature,
      sdkKey,
      meetingNumber,
      password: webinar.zoom_passcode ?? "",
      userName: fullName || user.email || "GreenMentor learner",
      userEmail: user.email ?? "",
    });
  } catch (e) {
    return jsonError(e);
  }
}
