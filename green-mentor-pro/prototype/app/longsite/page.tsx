import Link from "next/link";
import {
  SquaresFour,
  Plus,
  Database,
  ChartBar,
  FileDoc,
  Sparkle,
  ArrowRight,
  DeviceMobile,
  Factory,
  Lightning as Bolt,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader, ProgressBar } from "@/components/ui";
import { workspaces, demoEmissions } from "@/lib/data";

const months = ["A", "M", "J", "J", "A", "S", "O", "N", "D", "J", "F", "M"];

export default function LongsitePage() {
  const d = demoEmissions;
  const total = d.scope1 + d.scope2 + d.scope3;
  const max = Math.max(...d.monthly);

  return (
    <div>
      <PageHeader
        title="Longsite Lite"
        sub="The prosumer Longsite: your workspaces, real emission calculations, mobile-friendly. Start in the demo workspace."
        action={
          <Chip tone="green"><DeviceMobile size={12} /> Mobile-first</Chip>
        }
      />

      {/* Workspace switcher */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {workspaces.map((ws, i) => (
          <Card key={ws.id} className={i === 0 ? "border-green-500 p-5 ring-1 ring-green-500" : "p-5"}>
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-teal-900 text-green-500">
                <SquaresFour size={20} />
              </span>
              <Chip tone={i === 0 ? "green" : "neutral"}>{ws.badge}</Chip>
            </div>
            <h2 className="mt-3 text-[15px] font-semibold text-ink">{ws.name}</h2>
            <p className="mt-0.5 text-[12px] text-gray-600">{ws.company}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-700">{ws.desc}</p>
            <div className="mt-3 text-[11.5px] font-medium text-gray-500">{ws.updated}</div>
          </Card>
        ))}
        <button className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-gray-300 text-gray-500 hover:border-teal-700 hover:text-teal-800">
          <Plus size={24} />
          <span className="text-[13px] font-semibold">New workspace</span>
          <span className="text-[11.5px]">Free tier: 1 own workspace</span>
        </button>
      </div>

      {/* Demo workspace dashboard */}
      <div className="mb-3 flex items-center gap-2">
        <Factory size={18} className="text-teal-800" />
        <h2 className="text-[16px] font-semibold tracking-tight text-ink">{d.company}</h2>
        <Chip tone="neutral">{d.period}</Chip>
        <Chip tone="green">Demo data</Chip>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Scope cards */}
        <Card className="min-w-0 p-5 lg:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {[
              ["Scope 1", d.scope1, "Direct — fuel, fleet"],
              ["Scope 2", d.scope2, "Purchased energy"],
              ["Scope 3", d.scope3, "Value chain"],
            ].map(([label, val, sub]) => (
              <div key={label as string} className="rounded-2xl bg-gray-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</div>
                <div className="mt-1 text-[20px] font-bold tracking-tight text-teal-900">
                  {(val as number).toLocaleString()}
                  <span className="text-[11px] font-medium text-gray-500"> tCO₂e</span>
                </div>
                <div className="text-[11.5px] text-gray-600">{sub}</div>
              </div>
            ))}
          </div>

          {/* Monthly bars */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13.5px] font-semibold text-ink">Monthly emissions (ktCO₂e)</h3>
              <span className="text-[12px] text-gray-600">Total: {(total / 1000).toFixed(1)}k tCO₂e</span>
            </div>
            <div className="flex h-32 items-end gap-1.5">
              {d.monthly.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={"w-full rounded-t-md " + (i === 8 ? "bg-green-500" : "bg-teal-700/70")}
                    style={{ height: `${(v / max) * 100}%` }}
                  />
                  <span className="text-[9.5px] font-medium text-gray-500">{months[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category table */}
          <div className="mt-6">
            <h3 className="mb-2 text-[13.5px] font-semibold text-ink">Top emission sources</h3>
            <div className="space-y-1.5">
              {d.categories.map((c) => (
                <div key={c.name} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                  <Chip tone={c.scope === 1 ? "teal" : c.scope === 2 ? "green" : "neutral"}>S{c.scope}</Chip>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{c.name}</span>
                  <span className="w-14 text-right text-[12.5px] font-semibold text-gray-700 sm:w-20">{c.value.toLocaleString()}</span>
                  <div className="hidden w-28 sm:block"><ProgressBar value={c.pct * 2} /></div>
                  <span className="w-9 text-right text-[12px] font-semibold text-gray-500">{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Right rail */}
        <div className="min-w-0 space-y-4">
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-ink">Data completeness</h3>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[24px] font-bold text-teal-900">{d.completeness}%</span>
              <div className="flex-1"><ProgressBar value={d.completeness} /></div>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-gray-600">
              Missing: Mar waste logs, 2 supplier responses (Cat 1).
            </p>
          </Card>

          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-ink">Quick actions</h3>
            <div className="mt-3 space-y-2">
              {[
                { icon: Database, label: "Add activity data", sub: "Energy, water, waste, travel" },
                { icon: Sparkle, label: "Analyze with AI", sub: "Data Analyst agent · 200 cr" },
                { icon: FileDoc, label: "Generate summary report", sub: "Reports Producer · 300 cr" },
                { icon: ChartBar, label: "New chart", sub: "From any dataset" },
              ].map((a) => (
                <button key={a.label} className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-3 text-left hover:border-teal-700">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700">
                    <a.icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">{a.label}</span>
                    <span className="block text-[11.5px] text-gray-600">{a.sub}</span>
                  </span>
                  <ArrowRight size={14} className="text-gray-400" />
                </button>
              ))}
            </div>
          </Card>

          <Card className="bg-teal-900 p-5 text-white">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold">
              <Bolt size={16} weight="fill" className="text-green-500" /> Assessment in progress
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-green-100/80">
              Your ESG Fundamentals final assessment uses this workspace. Build the Scope 1 & 2 baseline, then submit.
            </p>
            <Link href="/academy/assessment" className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-green-500 px-4 py-1.5 text-[12.5px] font-bold text-teal-900">
              View brief <ArrowRight size={13} weight="bold" />
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
