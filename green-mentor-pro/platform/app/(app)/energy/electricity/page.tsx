import { loadEnergyContext } from "@/lib/energy/page-data";
import { listElectricityEntries } from "@/lib/energy/repo";
import { ElectricityClient } from "@/components/energy/ElectricityClient";

export const dynamic = "force-dynamic";

export default async function ElectricityPage() {
  const { orgId, masters, sites, canReview } = await loadEnergyContext("/energy/electricity");
  const entries = await listElectricityEntries(orgId);
  return (
    <ElectricityClient masters={masters} initialSites={sites} initialEntries={entries} canReview={canReview} />
  );
}
