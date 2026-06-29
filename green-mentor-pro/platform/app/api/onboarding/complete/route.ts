import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Persists the onboarding funnel result onto the signed-in user's profile row.
 * RLS ("users update own profile") restricts the write to auth.uid() = id.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const body = (await req.json()) as {
    segment?: string | null;
    goals?: string[];
    planId?: string | null;
    billingCycle?: string | null;
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      segment: body.segment ?? null,
      goals: body.goals ?? [],
      plan_id: body.planId ?? null,
      billing_cycle: body.billingCycle ?? null,
      onboarded: true,
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
