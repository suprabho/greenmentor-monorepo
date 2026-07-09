import { PageHeader } from "@/components/ui";
import { JobsPanel } from "@/components/jobs/jobs-panel";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { listJobs, type JobRow } from "@/lib/db/jobs";

export const metadata = { title: "Jobs — GreenMentor Community" };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  await requireAdmin();

  const configured = isServiceRoleConfigured();
  let jobs: JobRow[] = [];
  if (configured) jobs = await listJobs(createAdminClient());

  return (
    <div>
      <PageHeader
        title="Jobs"
        sub="Curated ESG & sustainability roles — author postings here and publish them to the platform jobs board."
      />
      <JobsPanel initialJobs={jobs} configured={configured} />
    </div>
  );
}
