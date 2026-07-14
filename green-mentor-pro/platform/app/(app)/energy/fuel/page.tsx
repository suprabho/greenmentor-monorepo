import { loadEnergyContext } from "@/lib/energy/page-data";
import { listFuelEntries } from "@/lib/energy/repo";
import { FuelClient } from "@/components/energy/FuelClient";

export const dynamic = "force-dynamic";

export default async function FuelPage() {
  const { orgId, masters, sites, canReview } = await loadEnergyContext("/energy/fuel");
  const entries = await listFuelEntries(orgId);
  return (
    <FuelClient masters={masters} initialSites={sites} initialEntries={entries} canReview={canReview} />
  );
}
