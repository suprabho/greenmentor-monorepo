import Link from "next/link";
import { Flame, Lightning, Wind, ChartBar, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Card, PageHeader, Stat } from "@/components/ui";
import { loadEnergyContext } from "@/lib/energy/page-data";
import { listFuelEntries, listElectricityEntries, listFugitiveEntries } from "@/lib/energy/repo";
import type { EntryStatus } from "@/lib/energy/types";

export const dynamic = "force-dynamic";

const counted = (s: EntryStatus) => s !== "Rejected"; // draft/submitted/accepted count toward the inventory
const sumTco2e = (rows: { tco2e: number | null; status: EntryStatus }[]) =>
  rows.filter((r) => counted(r.status)).reduce((a, r) => a + (r.tco2e ?? 0), 0);
const pending = (rows: { status: EntryStatus }[]) => rows.filter((r) => r.status === "Submitted").length;
const t = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });

export default async function EnergyPage() {
  const { orgId } = await loadEnergyContext("/energy");
  const [fuel, electricity, fugitive] = await Promise.all([
    listFuelEntries(orgId),
    listElectricityEntries(orgId),
    listFugitiveEntries(orgId),
  ]);

  const scope1 = sumTco2e(fuel) + sumTco2e(fugitive);
  const scope2 = sumTco2e(electricity);
  const pendingCount = pending(fuel) + pending(electricity) + pending(fugitive);

  return (
    <div>
      <PageHeader
        title="Energy"
        sub="Scope 1 (fuel combustion) and Scope 2 (electricity) emissions. Enter activity data; the platform looks up the emission factor and computes tCO₂e."
        action={
          <Link
            href="/energy/analyze"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-900 px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-teal-800"
          >
            <ChartBar size={15} weight="fill" /> View analytics
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5"><Stat label="Scope 1 · Fuel + Fugitive" value={`${t(scope1)} tCO₂e`} sub={`${fuel.length + fugitive.length} entries`} /></Card>
        <Card className="p-5"><Stat label="Scope 2 · Electricity" value={`${t(scope2)} tCO₂e`} sub={`${electricity.length} entries`} /></Card>
        <Card className="p-5"><Stat label="Total (S1 + S2)" value={`${t(scope1 + scope2)} tCO₂e`} /></Card>
        <Card className="p-5"><Stat label="Pending review" value={String(pendingCount)} sub="awaiting approval" /></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { href: "/energy/fuel", icon: Flame, title: "Fuel — Scope 1", desc: "Diesel, petrol, gas, coal & other combustion." },
          { href: "/energy/electricity", icon: Lightning, title: "Electricity — Scope 2", desc: "Grid and self-generated electricity, net of solar." },
          { href: "/energy/fugitive", icon: Wind, title: "Fugitive — Scope 1", desc: "Refrigerant & fire-suppressant losses, by GWP." },
        ].map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-md">
              <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-green-50 text-green-700">
                <s.icon size={22} weight="fill" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">{s.title}</span>
                <span className="block text-[12.5px] text-gray-600">{s.desc}</span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-gray-400" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
