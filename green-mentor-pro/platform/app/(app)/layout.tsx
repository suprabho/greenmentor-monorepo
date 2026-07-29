import { redirect } from "next/navigation";
import { Shell, type ShellStats, type ShellViewer } from "@/components/shell";
import { fetchHeaderStats } from "@/lib/academy/repo";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let stats: ShellStats | null = null;
  let viewer: ShellViewer | null = null;
  if (user) {
    const [s, { data: profile }] = await Promise.all([
      fetchHeaderStats(user.id),
      supabase
        .from("profiles")
        .select("display_name, avatar_url, onboarded")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    // Every signed-in user finishes onboarding before using the app. This gate
    // lives here rather than in middleware because the profile row is already
    // being read for the shell — so it costs one extra column, not a query per
    // request. Onboarding itself is in (fullbleed), outside this layout, so
    // there's no loop. A missing row (migration not run) must not lock anyone
    // out, hence the explicit `=== false`.
    if (profile && profile.onboarded === false) redirect("/onboarding");

    stats = s;
    viewer = {
      name: profile?.display_name ?? (user.user_metadata?.full_name as string) ?? user.email ?? "You",
      avatarUrl: profile?.avatar_url ?? (user.user_metadata?.avatar_url as string) ?? null,
    };
  }

  return (
    <Shell stats={stats ?? undefined} viewer={viewer ?? undefined}>
      {children}
    </Shell>
  );
}
