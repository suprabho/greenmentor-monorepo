import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
import { OnboardingHydrator } from "@/components/onboarding/OnboardingHydrator";
import type { OnboardingProfile } from "@/lib/onboarding/steps";

export const metadata = { title: "Get started — Green Mentor Pro" };

const PROFILE_COLUMNS =
  "display_name, phone, phone_country, segment, goals, plan_id, billing_cycle, onboarded";

/**
 * Onboarding lives in (fullbleed) so it escapes the app Shell — a first-run
 * flow shouldn't render a sidebar full of things the user can't use yet. The
 * URL is still /onboarding; route groups don't affect paths.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Middleware already gates /onboarding; belt-and-braces for direct hits.
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<OnboardingProfile>();

  // Already done — send them to the page where these answers are editable
  // rather than replaying a wizard that ends in "Finish".
  if (profile?.onboarded) redirect("/profile");

  return (
    <div className="flex min-h-svh flex-col bg-teal-900 text-white">
      <OnboardingHydrator profile={profile ?? null} />
      <OnboardingChrome>{children}</OnboardingChrome>
    </div>
  );
}
