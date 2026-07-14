import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { CompanyProfileView } from "@/components/brsr/company-profile";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { fetchCompanyProfile } from "@/lib/db/brsr-companies";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} — BRSR profile — GreenMentor Community` };
}

export default async function BrsrCompanyPage({ params }: { params: Promise<{ symbol: string }> }) {
  await requireAdmin();
  const { symbol } = await params;
  const upper = symbol.toUpperCase();

  if (!isServiceRoleConfigured()) {
    return <PageHeader title={upper} sub="Needs SUPABASE_SERVICE_ROLE_KEY set server-side." />;
  }

  const profile = await fetchCompanyProfile(createAdminClient(), upper);
  if (!profile) notFound();

  return (
    <div>
      <PageHeader
        title={profile.legalName ?? profile.companyName}
        sub={`${profile.symbol} · FY ${profile.fy}${profile.submissionDate ? ` · filed ${profile.submissionDate}` : ""}`}
        action={
          <Link
            href="/brsr/companies"
            className="rounded-pill border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            ← All companies
          </Link>
        }
      />
      <CompanyProfileView profile={profile} />
    </div>
  );
}
