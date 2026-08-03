/**
 * POST → set or clear the signed-in user's RSVP to a webinar.
 * Body { webinar_id, attending, full_name?, email?, phone?, phone_country? }.
 *
 * Attending=true carries the learner's contact details (migration 0029): the
 * admin hub needs a name, email and phone per RSVP, and one-click gave it only a
 * user_id. The details are snapshotted onto the RSVP row — the number given for
 * this webinar is what the team should call about it — and mirrored onto the
 * profile so the next RSVP (and /profile) stay in step.
 *
 * `phone` arrives already E.164-joined by the client's PhoneInput, matching what
 * onboarding stores (migration 0025); the country is kept alongside so the
 * picker can re-hydrate.
 *
 * Writes go through the RLS-bound session client: the "webinar_rsvps own" and
 * "users update own profile" policies mean a user can only ever touch their own
 * rows, so no further authorization is needed here.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { countryByIso } from "@/lib/data/country-codes";
import { isValidPhone, phoneDigits } from "@/lib/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  webinar_id: z.string().uuid(),
  attending: z.boolean(),
  full_name: z.string().trim().min(2).max(200).optional(),
  email: z.string().trim().email().max(200).optional(),
  // E.164 ("+919876543210") — dial code plus national number.
  phone: z.string().trim().min(7).max(24).optional(),
  phone_country: z.string().trim().length(2).optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  if (!body.attending) {
    const { error } = await supabase
      .from("webinar_rsvps")
      .delete()
      .eq("user_id", user.id)
      .eq("webinar_id", body.webinar_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, attending: false });
  }

  // All three are required to RSVP — the whole point of the form.
  if (!body.full_name || !body.email || !body.phone) {
    return NextResponse.json({ error: "name, email and phone are required to RSVP" }, { status: 400 });
  }

  // Re-check the number server-side against the claimed country, the same way
  // PATCH /api/profile does — the client validator is a convenience, not a gate.
  const iso = (body.phone_country ?? "").toUpperCase();
  const country = countryByIso(iso);
  if (!country) return NextResponse.json({ error: "unknown phone country" }, { status: 400 });
  const national = body.phone.startsWith(country.dial)
    ? body.phone.slice(country.dial.length)
    : phoneDigits(body.phone);
  if (!isValidPhone(national, iso)) {
    return NextResponse.json({ error: "enter a valid mobile number" }, { status: 400 });
  }
  const phone = `${country.dial}${phoneDigits(national)}`;

  const { error } = await supabase.from("webinar_rsvps").upsert(
    {
      user_id: user.id,
      webinar_id: body.webinar_id,
      full_name: body.full_name,
      email: body.email,
      phone,
      phone_country: iso,
    },
    { onConflict: "user_id,webinar_id" }
  );
  // A stale card can point at a deleted/unpublished webinar — surface it cleanly.
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Keep the profile in step so the next RSVP and /profile agree. Best-effort:
  // a failure here must not lose the RSVP just made, and display_name is only
  // filled when still empty — their profile name is theirs to change, not ours.
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const profilePatch: { phone: string; phone_country: string; display_name?: string } = {
    phone,
    phone_country: iso,
  };
  if (!profile?.display_name) profilePatch.display_name = body.full_name;
  await supabase.from("profiles").update(profilePatch).eq("id", user.id);

  return NextResponse.json({ ok: true, attending: true });
}
