import { Shell } from "@/components/shell";
import { fetchHeaderStats } from "@/lib/academy/repo";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const stats = user ? await fetchHeaderStats(user.id) : null;

  return <Shell stats={stats ?? undefined}>{children}</Shell>;
}
