import { NextResponse } from "next/server";
import { getEngagementContext } from "@/lib/engagement-session";
import { buildEnergyChart } from "@/lib/energy/charts";
import { jsonError } from "@/lib/api-error";

// Chart-data endpoint that @vismay/viz-engine's GenericChart fetches from
// (/api/chart-data/<slug>/<id>). Returns { steps: [{ title, option }] } where
// option is an echarts spec.
//
// slug === "energy": real, org-scoped Energy analytics (auth required).
// Everything else: the static demo below (colors use $-prefixed theme tokens
// which viz-engine resolves against the live ChartColors palette) — stands in
// for ingest-generated chart JSON until the Feed worker lands.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;

  if (slug === "energy") {
    try {
      const ctx = await getEngagementContext();
      if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      return NextResponse.json(await buildEnergyChart(ctx.orgId, id));
    } catch (e) {
      return jsonError(e);
    }
  }

  return NextResponse.json({
    steps: [
      {
        title: "Demo: GHG emissions by scope (tCO₂e)",
        option: {
          animation: false,
          grid: { left: 48, right: 16, top: 24, bottom: 32 },
          xAxis: {
            type: "category",
            data: ["Scope 1", "Scope 2", "Scope 3"],
            axisLine: { lineStyle: { color: "#C0C0C0" } },
            axisLabel: { color: "#5D5D5D" },
          },
          yAxis: {
            type: "value",
            splitLine: { lineStyle: { color: "#E2E8F0" } },
            axisLabel: { color: "#878787" },
          },
          series: [
            {
              type: "bar",
              data: [1280, 940, 5120],
              itemStyle: { color: "#07D862", borderRadius: [6, 6, 0, 0] },
              barWidth: "46%",
            },
          ],
        },
      },
    ],
  });
}
