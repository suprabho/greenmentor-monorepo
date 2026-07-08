import { PageHeader } from "@/components/ui";
import { WebinarsPanel } from "@/components/webinars/webinars-panel";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { listRsvpCounts, listWebinars, type WebinarRow } from "@/lib/db/webinars";

export const metadata = { title: "Webinars — GreenMentor Community" };
export const dynamic = "force-dynamic";

export default async function WebinarsPage() {
  await requireAdmin();

  const configured = isServiceRoleConfigured();
  let webinars: WebinarRow[] = [];
  let rsvpCounts: Record<string, number> = {};
  if (configured) {
    const admin = createAdminClient();
    [webinars, rsvpCounts] = await Promise.all([listWebinars(admin), listRsvpCounts(admin)]);
  }

  return (
    <div>
      <PageHeader
        title="Webinars"
        sub="Schedule the Academy's live webinars, publish them to the platform, and track funnel metrics."
      />
      <WebinarsPanel initialWebinars={webinars} initialRsvpCounts={rsvpCounts} configured={configured} />
    </div>
  );
}
