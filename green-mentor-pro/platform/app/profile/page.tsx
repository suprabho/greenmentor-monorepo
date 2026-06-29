import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Avatar, Card, Chip, PageHeader } from "@/components/ui";

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
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.display_name ?? (user.user_metadata?.full_name as string) ?? user.email ?? "You";

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

        <dl className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 text-[13px]">
          <div>
            <dt className="text-gray-500">User ID</dt>
            <dd className="mt-0.5 font-mono text-[11.5px] text-gray-700">{user.id}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Profile row</dt>
            <dd className="mt-0.5 text-gray-700">{profile ? "present" : "— (run the profiles migration)"}</dd>
          </div>
        </dl>

        <form action="/auth/signout" method="post" className="border-t border-gray-100 pt-4">
          <button
            type="submit"
            className="rounded-pill border border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50"
          >
            Sign out
          </button>
        </form>
      </Card>
    </div>
  );
}
