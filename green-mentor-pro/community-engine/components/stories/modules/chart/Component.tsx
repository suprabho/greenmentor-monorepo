"use client";

import type { VizRenderProps } from "@vismay/viz-engine";
import type { StoryChartConfig } from "./index";

/**
 * Inline SVG bar/line chart — no charting library. Colors/marks follow the
 * dataviz skill's validated default categorical palette (references/palette.md):
 * fixed hue order, worst adjacent CVD ΔE 24.2 in light mode. This app is
 * light-only today, so only the light-mode steps are used.
 */
const CATEGORICAL = [
  "#2a78d6", // 1 blue
  "#1baf7a", // 2 aqua
  "#eda100", // 3 yellow
  "#008300", // 4 green
  "#4a3aa7", // 5 violet
  "#e34948", // 6 red
  "#e87ba4", // 7 magenta
  "#eb6834", // 8 orange
];

const INK_PRIMARY = "#0b0b0b";
const INK_SECONDARY = "#52514e";
const INK_MUTED = "#898781";
const GRIDLINE = "#e1e0d9";
const AXIS = "#c3c2b7";
const SURFACE = "#ffffff";

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function formatValue(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

export default function StoryChartComponent({ config }: VizRenderProps<StoryChartConfig>) {
  const { title, chartType, categories, series } = config;
  const width = 640;
  const height = series.length > 1 ? 300 : 260;
  const padding = { top: 16, right: 16, bottom: 32, left: 44 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const topTick = ticks[ticks.length - 1] || 1;

  const yFor = (v: number) => padding.top + chartH - (v / topTick) * chartH;
  const groupW = chartW / categories.length;
  const xForGroup = (i: number) => padding.left + groupW * i + groupW / 2;

  return (
    <div className="w-full">
      {title ? (
        <div className="mb-2 text-[13px] font-semibold" style={{ color: INK_PRIMARY }}>
          {title}
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={title || "Chart"}
      >
        {/* Gridlines + y-axis ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke={GRIDLINE}
              strokeWidth={1}
            />
            <text
              x={padding.left - 8}
              y={yFor(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill={INK_MUTED}
            >
              {formatValue(t)}
            </text>
          </g>
        ))}
        {/* Baseline */}
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={yFor(0)}
          y2={yFor(0)}
          stroke={AXIS}
          strokeWidth={1}
        />

        {chartType === "bar" ? (
          <BarMarks
            categories={categories}
            series={series}
            groupW={groupW}
            xForGroup={xForGroup}
            yFor={yFor}
            baseline={yFor(0)}
          />
        ) : (
          <LineMarks categories={categories} series={series} xForGroup={xForGroup} yFor={yFor} />
        )}

        {/* Category labels */}
        {categories.map((c, i) => (
          <text
            key={c}
            x={xForGroup(i)}
            y={height - padding.bottom + 18}
            textAnchor="middle"
            fontSize={11}
            fill={INK_SECONDARY}
          >
            {c.length > 14 ? `${c.slice(0, 13)}…` : c}
          </text>
        ))}
      </svg>

      {series.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s, i) => (
            <div key={s.name} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: INK_SECONDARY }}>
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: CATEGORICAL[i % CATEGORICAL.length] }}
              />
              {s.name}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BarMarks({
  categories,
  series,
  groupW,
  xForGroup,
  yFor,
  baseline,
}: {
  categories: string[];
  series: StoryChartConfig["series"];
  groupW: number;
  xForGroup: (i: number) => number;
  yFor: (v: number) => number;
  baseline: number;
}) {
  const gap = 2;
  const maxBarW = 24;
  const barW = Math.min(maxBarW, (groupW - gap * (series.length + 1)) / series.length);

  return (
    <>
      {categories.map((cat, ci) => {
        const groupStart = xForGroup(ci) - (barW * series.length + gap * (series.length - 1)) / 2;
        // Label only this category's tallest bar (the extreme), not every bar.
        const maxSeriesIdx = series.reduce(
          (best, s, i) => (s.values[ci]! > (series[best]?.values[ci] ?? -Infinity) ? i : best),
          0
        );
        return (
          <g key={cat}>
            {series.map((s, si) => {
              const v = s.values[ci] ?? 0;
              const x = groupStart + si * (barW + gap);
              const y = yFor(v);
              const h = Math.max(0, baseline - y);
              return (
                <g key={s.name}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx={4}
                    fill={CATEGORICAL[si % CATEGORICAL.length]}
                  >
                    <title>
                      {cat} · {s.name}: {formatValue(v)}
                    </title>
                  </rect>
                  {si === maxSeriesIdx ? (
                    <text
                      x={x + barW / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fontSize={10.5}
                      fill={INK_SECONDARY}
                    >
                      {formatValue(v)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
}

function LineMarks({
  categories,
  series,
  xForGroup,
  yFor,
}: {
  categories: string[];
  series: StoryChartConfig["series"];
  xForGroup: (i: number) => number;
  yFor: (v: number) => number;
}) {
  return (
    <>
      {series.map((s, si) => {
        const color = CATEGORICAL[si % CATEGORICAL.length];
        const points = categories.map((_, ci) => [xForGroup(ci), yFor(s.values[ci] ?? 0)] as const);
        const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
        const [lastX, lastY] = points[points.length - 1] ?? [0, 0];
        const lastValue = s.values[s.values.length - 1] ?? 0;
        return (
          <g key={s.name}>
            <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {points.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={4} fill={color} stroke={SURFACE} strokeWidth={2}>
                <title>
                  {categories[i]} · {s.name}: {formatValue(s.values[i] ?? 0)}
                </title>
              </circle>
            ))}
            <text x={lastX} y={lastY - 10} textAnchor="middle" fontSize={10.5} fill={INK_SECONDARY}>
              {formatValue(lastValue)}
            </text>
          </g>
        );
      })}
    </>
  );
}
