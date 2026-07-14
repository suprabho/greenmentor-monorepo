import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { NicDashboard } from "@/components/nic/nic-dashboard";
import { NicExplorer } from "@/components/nic/nic-explorer";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata = { title: "NIC classification — GreenMentor Community" };

export default async function NicPage() {
  await requireAdmin();

  return (
    <div>
      <PageHeader
        title="NIC-2008 classification"
        sub="India's National Industrial Classification — the CSO's official sector → industry taxonomy that every BRSR filing and MSME registration is coded against. Scraped from the NIC-2008 Broad Structure: 21 sectors, 88 industries, 238 groups."
        action={
          <Link
            href="/brsr"
            className="rounded-pill border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            BRSR intelligence →
          </Link>
        }
      />

      <NicDashboard />

      <div className="mb-2 mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Explore the taxonomy</h2>
      </div>
      <p className="mb-4 max-w-2xl text-[13px] text-gray-600">
        The complete Section → Division → Group tree. Search jumps to any industry or group by name or code, and only
        matching branches stay open.
      </p>
      <NicExplorer />

      <p className="mt-8 text-[12px] text-gray-500">
        Source: National Industrial Classification 2008 (NIC-2008), Central Statistical Organisation, Ministry of
        Statistics &amp; Programme Implementation, Government of India. Sections, divisions and groups are enumerated
        from the published Broad Structure; the 403 four-digit classes and 1,304 five-digit sub-classes are the
        documented totals of the deeper Detailed Structure.
      </p>
    </div>
  );
}
