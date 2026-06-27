import { NextResponse } from "next/server";

// Static chart-data endpoint that GenericChart fetches from
// (/api/chart-data/<slug>/<id>). Color values use $-prefixed theme tokens
// which viz-engine resolves against the live ChartColors palette. This stands
// in for the real ingest-generated chart JSON until the Feed worker lands.
export async function GET() {
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
