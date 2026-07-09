import { Card, PageHeader } from "@/components/ui";
import { JobsBoard } from "@/components/jobs/jobs-board";
import { fetchJobs } from "@/lib/jobs/repo";

export const metadata = { title: "Jobs — Green Mentor Pro" };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const jobs = await fetchJobs();

  return (
    <div>
      <PageHeader
        title="Jobs"
        sub="Curated ESG & sustainability roles across India, the GCC and beyond — filter by country and level, then apply directly."
      />
      {jobs.length === 0 ? (
        <Card className="p-6 text-[13.5px] text-gray-600">
          No roles published yet — check back soon as new openings are added every week.
        </Card>
      ) : (
        <JobsBoard jobs={jobs} />
      )}
    </div>
  );
}
