import { GenericChart } from "@vismay/viz-engine";
import { Card, PageHeader, Stat } from "@/components/ui";
import { loadEnergyContext } from "@/lib/energy/page-data";
import { listFuelEntries, listElectricityEntries, listFugitiveEntries } from "@/lib/energy/repo";
import type { EntryStatus } from "@/lib/energy/types";

export const dynamic = "force-dynamic";

const counted = (s: EntryStatus) => s !== "Rejected";
const sum = (rows: { tco2e: number | null; status: EntryStatus }[]) =>
  rows.filter((r) => counted(r.status)).reduce((a, r) => a + (r.tco2e ?? 0), 0);
const t = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });

const CHARTS: { id: string; label: string }[] = [
  { id: "by-scope", label: "By scope" },
  { id: "by-category", label: "By category" },
  { id: "by-facility", label: "By facility" },
  { id: "by-source", label: "Renewable mix" },
  { id: "trend", label: "By year" },
];

export default async function EnergyAnalyzePage() {
  const { orgId } = await loadEnergyContext("/energy/analyze");
  const [fuel, electricity, fugitive] = await Promise.all([
    listFuelEntries(orgId),
    listElectricityEntries(orgId),
    listFugitiveEntries(orgId),
  ]);

  const scope1 = sum(fuel) + sum(fugitive);
  const scope2 = sum(electricity);
  const totalEm = scope1 + scope2;
  const renewable = [...fuel, ...electricity]
    .filter((e) => counted(e.status) && e.source_type === "Renewable")
    .reduce((a, e) => a + (e.tco2e ?? 0), 0);
  const renewableShare = totalEm > 0 ? Math.round((renewable / totalEm) * 100) : 0;
  const hasData = fuel.length + electricity.length + fugitive.length > 0;

  return (
    <div>
      <PageHeader title="Energy · Analyze" sub="Scope 1 + 2 emissions across fuel, electricity and fugitive sources." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5"><Stat label="Total (S1 + S2)" value={`${t(totalEm)} tCO₂e`} /></Card>
        <Card className="p-5"><Stat label="Scope 1" value={`${t(scope1)} tCO₂e`} sub="fuel + fugitive" /></Card>
        <Card className="p-5"><Stat label="Scope 2" value={`${t(scope2)} tCO₂e`} sub="electricity" /></Card>
        <Card className="p-5"><Stat label="Renewable share" value={`${renewableShare}%`} sub="of S1+S2 by source" /></Card>
      </div>

      {!hasData ? (
        <Card className="p-10 text-center text-[13.5px] text-gray-500">
          No entries yet — add fuel, electricity or fugitive data to see charts.
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {CHARTS.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{c.label}</div>
              <div className="h-[320px] w-full">
                <GenericChart slug="energy" id={c.id} activeStep={0} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
