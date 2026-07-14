import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { CompanyDirectoryView } from "@/components/brsr/company-directory";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { fetchCompanyDirectory, type CompanyListItem } from "@/lib/db/brsr-companies";

export const metadata = { title: "BRSR companies — GreenMentor Community" };
export const dynamic = "force-dynamic";

export default async function BrsrCompaniesPage() {
  await requireAdmin();

  const configured = isServiceRoleConfigured();
  let companies: CompanyListItem[] = [];
  let loadError: string | null = null;
  if (configured) {
    try {
      companies = await fetchCompanyDirectory(createAdminClient());
    } catch (e) {
      loadError = e instanceof Error ? e.message : "could not read the BRSR profile tables";
    }
  }

  return (
    <div>
      <PageHeader
        title="BRSR companies"
        sub="Every profiled filer — contact details, turnover-weighted NIC sector, and a disclosure-coverage scorecard, extracted straight from the archived XBRL."
        action={
          <Link
            href="/brsr"
            className="rounded-pill border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            ← BRSR intelligence
          </Link>
        }
      />

      {!configured ? (
        <p className="mb-4 rounded-lg bg-[#FFF4E0] px-3 py-2 text-[12px] text-[#B25E00]">
          The BRSR dashboard needs SUPABASE_SERVICE_ROLE_KEY set server-side — shown empty until then.
        </p>
      ) : loadError ? (
        <p className="mb-4 rounded-lg bg-[#FFF4E0] px-3 py-2 text-[12px] text-[#B25E00]">
          Couldn&apos;t read the profile tables ({loadError}) — has migration 0017_brsr_company_profile.sql been
          applied to the shared project?
        </p>
      ) : companies.length === 0 ? (
        <p className="text-[13px] text-gray-500">
          No profiled companies yet — run <code>scripts/scrape-brsr.ts --stage=profile</code> after applying migration
          0017.
        </p>
      ) : (
        <CompanyDirectoryView companies={companies} />
      )}
    </div>
  );
}
