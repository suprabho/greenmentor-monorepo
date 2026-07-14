// Server-side chart builders for the Energy analyze dashboard. Each returns the
// { steps: [{ title, option }] } shape @vismay/viz-engine's GenericChart fetches
// from /api/chart-data/<slug>/<id> — so we render real org emissions through the
// same echarts host + theme the rest of the platform uses (see viz-demo).
//
// Only non-Rejected entries count toward the inventory (matches the summary page).

import { listFuelEntries, listElectricityEntries, listFugitiveEntries, listSites } from "./repo";
import type { EntryStatus } from "./types";

// Brand-aligned categorical palette (green world + supporting hues).
const PALETTE = ["#07D862", "#0E7C66", "#F5A623", "#4A90D9", "#9B59B6", "#E2574C", "#7ED321", "#50E3C2"];
const AXIS_LINE = "#C0C0C0";
const AXIS_LABEL = "#5D5D5D";
const SPLIT_LINE = "#E2E8F0";

interface Row { tco2e: number | null; status: EntryStatus }
const counted = (e: Row) => e.status !== "Rejected";
const total = (rows: Row[]) => rows.filter(counted).reduce((a, r) => a + (r.tco2e ?? 0), 0);
const round = (n: number) => +n.toFixed(3);

interface ChartStep {
  title: string;
  option: Record<string, unknown>;
}

function barOption(categories: string[], values: number[], title: string): ChartStep {
  return {
    title,
    option: {
      animation: false,
      grid: { left: 56, right: 16, top: 24, bottom: 60 },
      tooltip: { trigger: "axis", valueFormatter: (v: number) => `${v} tCO₂e` },
      xAxis: {
        type: "category",
        data: categories,
        axisLine: { lineStyle: { color: AXIS_LINE } },
        axisLabel: { color: AXIS_LABEL, interval: 0, rotate: categories.length > 4 ? 24 : 0 },
      },
      yAxis: {
        type: "value",
        name: "tCO₂e",
        splitLine: { lineStyle: { color: SPLIT_LINE } },
        axisLabel: { color: "#878787" },
      },
      series: [
        {
          type: "bar",
          data: values.map((v, i) => ({ value: round(v), itemStyle: { color: PALETTE[i % PALETTE.length], borderRadius: [6, 6, 0, 0] } })),
          barWidth: "46%",
        },
      ],
    },
  };
}

function pieOption(entries: { name: string; value: number }[], title: string): ChartStep {
  return {
    title,
    option: {
      animation: false,
      tooltip: { trigger: "item", valueFormatter: (v: number) => `${v} tCO₂e` },
      legend: { bottom: 0, textStyle: { color: AXIS_LABEL } },
      series: [
        {
          type: "pie",
          radius: ["42%", "68%"],
          center: ["50%", "44%"],
          data: entries.map((e, i) => ({ name: e.name, value: round(e.value), itemStyle: { color: PALETTE[i % PALETTE.length] } })),
          label: { color: AXIS_LABEL },
        },
      ],
    },
  };
}

function yearOf(dateOrYear: string | number | null): string {
  if (dateOrYear == null) return "—";
  if (typeof dateOrYear === "number") return String(dateOrYear);
  return dateOrYear.slice(0, 4);
}

export async function buildEnergyChart(orgId: string, id: string): Promise<{ steps: ChartStep[] }> {
  const [fuel, electricity, fugitive, sites] = await Promise.all([
    listFuelEntries(orgId),
    listElectricityEntries(orgId),
    listFugitiveEntries(orgId),
    listSites(orgId),
  ]);
  const siteLabel = (siteId: string | null) => {
    const s = sites.find((x) => x.id === siteId);
    return s ? `${s.business_unit} — ${s.location}` : "Org level";
  };

  switch (id) {
    case "by-scope": {
      const s1 = total(fuel) + total(fugitive);
      const s2 = total(electricity);
      return { steps: [barOption(["Scope 1", "Scope 2"], [s1, s2], "GHG emissions by scope (tCO₂e)")] };
    }
    case "by-category": {
      return {
        steps: [
          barOption(
            ["Fuel", "Electricity", "Fugitive"],
            [total(fuel), total(electricity), total(fugitive)],
            "Emissions by category (tCO₂e)",
          ),
        ],
      };
    }
    case "by-facility": {
      const all = [
        ...fuel.map((e) => ({ site: e.site_id, ...e })),
        ...electricity.map((e) => ({ site: e.site_id, ...e })),
        ...fugitive.map((e) => ({ site: e.site_id, ...e })),
      ].filter(counted);
      const byId = new Map<string, number>();
      for (const e of all) {
        const key = siteLabel(e.site);
        byId.set(key, (byId.get(key) ?? 0) + (e.tco2e ?? 0));
      }
      const sorted = [...byId.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
      return { steps: [barOption(sorted.map((s) => s[0]), sorted.map((s) => s[1]), "Emissions by facility (tCO₂e)")] };
    }
    case "by-source": {
      // Renewable vs non-renewable, from fuel + electricity source_type.
      let renewable = 0;
      let nonRenewable = 0;
      for (const e of [...fuel, ...electricity].filter(counted)) {
        if (e.source_type === "Renewable") renewable += e.tco2e ?? 0;
        else nonRenewable += e.tco2e ?? 0;
      }
      return { steps: [pieOption([{ name: "Non-Renewable", value: nonRenewable }, { name: "Renewable", value: renewable }], "Renewable vs non-renewable (tCO₂e)")] };
    }
    case "trend": {
      const byYear = new Map<string, number>();
      for (const e of fuel.filter(counted)) byYear.set(yearOf(e.bill_date), (byYear.get(yearOf(e.bill_date)) ?? 0) + (e.tco2e ?? 0));
      for (const e of electricity.filter(counted)) byYear.set(yearOf(e.bill_date), (byYear.get(yearOf(e.bill_date)) ?? 0) + (e.tco2e ?? 0));
      for (const e of fugitive.filter(counted)) byYear.set(yearOf(e.reporting_year), (byYear.get(yearOf(e.reporting_year)) ?? 0) + (e.tco2e ?? 0));
      const years = [...byYear.keys()].filter((y) => y !== "—").sort();
      return { steps: [barOption(years, years.map((y) => byYear.get(y) ?? 0), "Emissions by year (tCO₂e)")] };
    }
    default:
      return { steps: [barOption([], [], "No data")] };
  }
}
