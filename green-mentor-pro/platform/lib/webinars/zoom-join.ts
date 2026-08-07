/**
 * Zoom join links for the live room's hand-off landing (see
 * components/webinars/zoom-join-card.tsx). Instead of the embedded Meeting SDK
 * player, the live page sends the learner to Zoom itself with two links built
 * from the meeting details the admin already stores:
 *
 * - appUrl (`zoom.us/j/…`) goes through Zoom's launcher page, which deep-links
 *   the installed desktop/mobile app and falls back to a download prompt.
 * - browserUrl (`zoom.us/wc/join/…`) goes straight into Zoom's web client, no
 *   install needed.
 *
 * Both carry `pwd=` built from the *stored plain passcode*. Zoom's own invite
 * links carry an encrypted token there instead; current clients accept the
 * plain form, but when Zoom still prompts, the card shows the passcode with a
 * copy affordance, so the learner always has the answer.
 *
 * zoom_meeting_number / zoom_passcode live on community_webinars (RLS enabled,
 * no policies) and are deliberately absent from the webinars_public view — the
 * passcode must not leak to anon. Reads go through the service-role client, so
 * callers MUST gate on a signed-in session first, exactly like the
 * zoom-signature route does.
 */

import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

export interface ZoomJoin {
  /** Digits only — how Zoom URLs want the meeting number. */
  meetingNumber: string;
  passcode: string | null;
  /** Zoom's launcher page: opens the installed app, offers the download. */
  appUrl: string;
  /** Zoom's in-browser web client. */
  browserUrl: string;
}

/**
 * The webinar's Zoom join details, or null when there's no meeting attached
 * yet. Errors are logged and swallowed into null too — the live page should
 * degrade to its "no meeting yet" notice rather than 500 on a learner.
 */
export async function fetchZoomJoin(webinarId: string): Promise<ZoomJoin | null> {
  if (!isServiceRoleConfigured()) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("community_webinars")
      .select("zoom_meeting_number, zoom_passcode")
      .eq("id", webinarId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as { zoom_meeting_number: string | null; zoom_passcode: string | null } | null;

    // Admins paste numbers as Zoom displays them ("123 4567 8901") — keep the
    // digits only so the URL path segment is valid.
    const meetingNumber = (row?.zoom_meeting_number ?? "").replace(/\D/g, "");
    if (!meetingNumber) return null;

    const passcode = row?.zoom_passcode?.trim() || null;
    const pwd = passcode ? `?pwd=${encodeURIComponent(passcode)}` : "";
    return {
      meetingNumber,
      passcode,
      appUrl: `https://zoom.us/j/${meetingNumber}${pwd}`,
      browserUrl: `https://zoom.us/wc/join/${meetingNumber}${pwd}`,
    };
  } catch (e) {
    console.error("[zoom-join] could not load join details", e);
    return null;
  }
}
