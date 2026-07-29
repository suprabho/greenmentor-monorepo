import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";

/**
 * Partial patch of the signed-in user's profile row. Serves both the onboarding
 * wizard (each step saves as it advances, which is what makes the flow
 * resumable on another device) and the inline editors on /profile.
 *
 * Every key is optional and only the ones present are written, so a step can
 * save just its own fields without clobbering the rest. RLS ("users update own
 * profile") restricts the write to auth.uid() = id.
 */
const patchSchema = z
  .object({
    displayName: z.string().trim().min(2, "Please enter at least 2 characters.").max(120),
    // Already E.164-joined by the client (toE164). Empty string clears it.
    phone: z.string().trim().max(32),
    phoneCountry: z.string().trim().length(2),
    segment: z.enum(["student", "mid-career", "business-leader"]).nullable(),
    goals: z.array(z.string()).max(32),
    planId: z.string().nullable(),
    billingCycle: z.enum(["monthly", "annual"]).nullable(),
    onboarded: z.boolean(),
  })
  .partial();

/** camelCase (client) → snake_case (Postgres). */
const COLUMN: Record<keyof z.infer<typeof patchSchema>, string> = {
  displayName: "display_name",
  phone: "phone",
  phoneCountry: "phone_country",
  segment: "segment",
  goals: "goals",
  planId: "plan_id",
  billingCycle: "billing_cycle",
  onboarded: "onboarded",
};

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "invalid" },
        { status: 400 },
      );
    }

    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      // `undefined` means "not in this patch"; null/"" are meaningful clears.
      if (value !== undefined) patch[COLUMN[key as keyof typeof COLUMN]] = value;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    // The profile row is created by the handle_new_user trigger on signup, but
    // upsert keeps this working for accounts that predate it (or if the trigger
    // was never applied) instead of silently updating zero rows.
    // No returning select: callers re-read through their own server components
    // (the profile editor calls router.refresh()), and selecting columns the
    // caller never touched would couple every write to the whole row's shape.
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...patch });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
