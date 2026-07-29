import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Card, Chip, PageHeader } from "@/components/ui";
import { CreditsCard } from "@/components/wallet/CreditsCard";
import { ProfileForm, type ProfileFormValues } from "@/components/profile/ProfileForm";
import { fetchWalletSummary } from "@/lib/ai/usage";
import type { AudienceSegment, BillingCycle } from "@/lib/store/onboarding";

export const metadata = { title: "Profile — Green Mentor Pro" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Middleware already gates /profile; this is belt-and-braces for direct hits.
  if (!user) redirect("/login?next=/profile");

  // Profile row is created by the handle_new_user trigger (see supabase/migrations).
  // maybeSingle so a missing row (migration not yet run) doesn't throw.
  const [{ data: profile, error: profileError }, wallet] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, avatar_url, created_at, phone, phone_country, segment, goals, plan_id, billing_cycle",
      )
      .eq("id", user.id)
      .maybeSingle(),
    fetchWalletSummary(user.id),
  ]);

  const name = profile?.display_name ?? (user.user_metadata?.full_name as string) ?? user.email ?? "You";

  const initial: ProfileFormValues = {
    displayName: profile?.display_name ?? "",
    phone: profile?.phone ?? null,
    phoneCountry: profile?.phone_country ?? null,
    segment: (profile?.segment as AudienceSegment | null) ?? null,
    goals: (profile?.goals as string[] | null) ?? [],
    planId: profile?.plan_id ?? null,
    billingCycle: (profile?.billing_cycle as BillingCycle | null) ?? "annual",
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Profile" sub="Your account on Green Mentor Pro" />

      <Card className="space-y-5 p-6">
        <div className="flex items-center gap-4">
          <Avatar src={profile?.avatar_url ?? (user.user_metadata?.avatar_url as string)} name={name} size={56} className="ring-2 ring-green-500/50" />
          <div className="min-w-0">
            <div className="truncate text-[17px] font-semibold text-ink">{name}</div>
            <div className="truncate text-[13.5px] text-gray-600">{user.email}</div>
          </div>
          <Chip tone="green" className="ml-auto">Signed in</Chip>
        </div>

        <form action="/auth/signout" method="post" className="border-t border-gray-100 pt-4">
          <button
            type="submit"
            className="rounded-pill border border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50"
          >
            Sign out
          </button>
        </form>
      </Card>

      {/* The answers captured during onboarding — editable here, as the goals
          step promises. Email lives on auth.users and changing it needs a
          Supabase auth flow, so it stays read-only above. */}
      {profileError ? (
        // PostgREST fails the whole select if any one column is missing, so a
        // half-applied migration would otherwise render the editor seeded with
        // blanks — and saving that would overwrite real answers with nothing.
        <Card className="p-6">
          <h2 className="text-[15px] font-semibold text-ink">Profile details unavailable</h2>
          <p className="mt-2 text-[13.5px] text-gray-600">
            Your saved answers couldn&apos;t be loaded, so editing is disabled to avoid
            overwriting them. This usually means a pending database migration.
          </p>
          <p className="mt-2 font-mono text-[11.5px] text-gray-500">{profileError.message}</p>
        </Card>
      ) : (
        <ProfileForm initial={initial} />
      )}

      <CreditsCard summary={wallet} />
    </div>
  );
}
