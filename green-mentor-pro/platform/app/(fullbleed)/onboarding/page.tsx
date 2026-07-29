import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstUnfinishedStep, type OnboardingProfile } from "@/lib/onboarding/steps";

/**
 * /onboarding is not a screen — it resumes the flow at the first unanswered
 * step. The layout has already handled the not-signed-in and already-onboarded
 * cases by the time this renders.
 */
export default async function OnboardingIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, phone, segment, goals")
    .eq("id", user.id)
    .maybeSingle<Pick<OnboardingProfile, "display_name" | "phone" | "segment" | "goals">>();

  redirect(firstUnfinishedStep(profile));
}
