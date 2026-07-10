import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { BrsrDashboardView } from "@/components/brsr/brsr-dashboard";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { fetchBrsrDashboard, type BrsrDashboard } from "@/lib/db/brsr";

export const metadata = { title: "BRSR — GreenMentor Community" };
export const dynamic = "force-dynamic";

export default async function BrsrPage() {
  await requireAdmin();

  const configured = isServiceRoleConfigured();
  let data: BrsrDashboard | null = null;
  let loadError: string | null = null;
  if (configured) {
    try {
      data = await fetchBrsrDashboard(createAdminClient());
    } catch (e) {
      loadError = e instanceof Error ? e.message : "could not read the BRSR tables";
    }
  }

  return (
    <div>
      <PageHeader
        title="BRSR intelligence"
        sub="Every listed company's Business Responsibility & Sustainability Report, scraped from NSE and parsed into comparable indicators — corpus health first, then what the filings say."
        action={
          <Link
            href="/pipeline"
            className="rounded-pill border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Scrape worker →
          </Link>
        }
      />

      {!configured ? (
        <p className="mb-4 rounded-lg bg-[#FFF4E0] px-3 py-2 text-[12px] text-[#B25E00]">
          The BRSR dashboard needs SUPABASE_SERVICE_ROLE_KEY set server-side — shown empty until then.
        </p>
      ) : loadError ? (
        <p className="mb-4 rounded-lg bg-[#FFF4E0] px-3 py-2 text-[12px] text-[#B25E00]">
          Couldn&apos;t read the BRSR tables ({loadError}) — has migration 0011_brsr_filings.sql been applied to the
          shared project?
        </p>
      ) : null}

      {data && <BrsrDashboardView data={data} />}
    </div>
  );
}
