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
      supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
    ]);
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
