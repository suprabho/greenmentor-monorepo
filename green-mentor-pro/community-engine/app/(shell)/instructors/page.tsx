import { PageHeader } from "@/components/ui";
import { InstructorsPanel } from "@/components/instructors/instructors-panel";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { listInstructors, type InstructorRow } from "@/lib/db/instructors";

export const metadata = { title: "Instructors — GreenMentor Community" };
export const dynamic = "force-dynamic";

export default async function InstructorsPage() {
  await requireAdmin();

  const configured = isServiceRoleConfigured();
  let instructors: InstructorRow[] = [];
  if (configured) instructors = await listInstructors(createAdminClient());

  return (
    <div>
      <PageHeader
        title="Instructors"
        sub="The roster of practitioners who teach webinars — profiles here power the webinar instructor picker and header speaker cards."
      />
      <InstructorsPanel initialInstructors={instructors} configured={configured} />
    </div>
  );
}
