"use client";

/**
 * Shared, dependency-free building blocks for the per-stage artifact views.
 * Inline styles only (matches the app convention); charts are hand-rolled
 * (div bars + inline SVG for gauge/donut/scatter) — no charting library.
 * Every chart/list filters null/NaN first and falls back to <Empty/>.
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { C, ACCENT, CONF_STYLE, type Confidence } from "./theme";
import { mdToSafeHtml } from "@/lib/report/markdown";

/* ────────────────────────── helpers ────────────────────────── */

export const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

export function fmt(n: unknown): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const d = abs >= 100 || Number.isInteger(n) ? 0 : abs >= 1 ? 2 : 4;
  return n.toLocaleString("en-IN", { maximumFractionDigits: d });
}

export function safeText(v: unknown, dash = "—"): string {
  if (v == null || v === "") return dash;
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString("en-IN") : dash;
  return String(v);
}

const titleize = (s: unknown) => String(s ?? "").replace(/_/g, " ");

/* ────────────────────────── layout / text ────────────────────────── */

export function Empty({ children }: { children?: ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: C.sub, padding: "16px 2px", textAlign: "center" }}>
      {children ?? "Nothing to display."}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: 0.4, textTransform: "uppercase", margin: "2px 0 10px" }}>
      {children}
    </div>
  );
}

export function Card({
  title,
  accent,
  right,
  children,
  style,
}: {
  title?: ReactNode;
  accent?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderLeft: accent ? `3px solid ${accent}` : `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        ...style,
      }}
    >
      {(title || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: title ? 10 : 0 }}>
          {title ? <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div> : <span />}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function KeyVal({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, borderBottom: `1px solid ${C.border}`, padding: "7px 0" }}>
      <span style={{ color: C.sub }}>{label}</span>
      <span style={{ fontWeight: 650, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export function Field({ label, value }: { label: string; value?: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: "#8a958f", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 13, color: C.text, marginTop: 1 }}>{value}</div>
    </div>
  );
}

export function Chip({ children, tone }: { children: ReactNode; tone?: "neutral" | "accent" }) {
  const accent = tone === "accent";
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: accent ? ACCENT : C.sub,
        background: accent ? "#e9f2ec" : "#f0f6f3",
        border: `1px solid ${C.border}`,
        padding: "2px 8px",
        borderRadius: 6,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function Bullets({ items, check }: { items: unknown[]; check?: boolean }) {
  const xs = arr<string>(items);
  if (!xs.length) return null;
  return (
    <ul style={{ margin: "4px 0", paddingLeft: check ? 4 : 18, listStyle: check ? "none" : "disc" }}>
      {xs.map((it, i) => (
        <li key={i} style={{ fontSize: 13, color: C.text, margin: "4px 0", lineHeight: 1.5 }}>
          {check && <span style={{ color: ACCENT, fontWeight: 700, marginRight: 7 }}>✓</span>}
          {String(it)}
        </li>
      ))}
    </ul>
  );
}

/* ────────────────────────── badges ────────────────────────── */

export function Badge({ label, bg, fg, solid }: { label: ReactNode; bg: string; fg: string; solid?: boolean }) {
  return (
    <span
      style={{
        background: solid ? fg : bg,
        color: solid ? "#fff" : fg,
        fontSize: 11.5,
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        height: "fit-content",
      }}
    >
      {label}
    </span>
  );
}

export function ConfidenceBadge({ level, flagged }: { level?: Confidence; flagged?: boolean }) {
  const cs = CONF_STYLE[level ?? "low"] ?? CONF_STYLE.low;
  return <Badge label={`conf: ${cs.label}${flagged ? " · flagged" : ""}`} bg={cs.bg} fg={cs.fg} />;
}

/** Tone map covering issue severity, check status, and consistency severity. */
const TONE: Record<string, { bg: string; fg: string; solid?: boolean }> = {
  // issue severity
  info: { bg: "#eef1f0", fg: C.sub },
  low: { bg: "#fbf2dc", fg: C.medium },
  medium: { bg: "#fbf2dc", fg: C.medium },
  high: { bg: "#fde8de", fg: C.low },
  critical: { bg: "#fde8de", fg: C.low, solid: true },
  // check status
  pass: { bg: "#e6f4ec", fg: C.high },
  warn: { bg: "#fbf2dc", fg: C.medium },
  fail: { bg: "#fde8de", fg: C.low },
  not_applicable: { bg: "#eef1f0", fg: C.blocked },
  // publication consistency
  warning: { bg: "#fbf2dc", fg: C.medium },
  error: { bg: "#fde8de", fg: C.low },
  // misc statuses
  mapped: { bg: "#e6f4ec", fg: C.high },
  unresolved: { bg: "#fde8de", fg: C.low },
  calculated: { bg: "#e6f4ec", fg: C.high },
  Drafted: { bg: "#e6f4ec", fg: C.high },
  Pending: { bg: "#eef1f0", fg: C.blocked },
  proposed: { bg: "#e6f4ec", fg: C.high },
  borderline: { bg: "#fbf2dc", fg: C.medium },
  fulfilled: { bg: "#e6f4ec", fg: C.high },
  partial: { bg: "#fbf2dc", fg: C.medium },
  missing: { bg: "#fde8de", fg: C.low },
  expired: { bg: "#fde8de", fg: C.low },
  rejected: { bg: "#fde8de", fg: C.low },
  anomalous: { bg: "#fde8de", fg: C.low },
};

export function StatusBadge({ value, label }: { value?: string; label?: ReactNode }) {
  const t = TONE[value ?? ""] ?? { bg: "#eef1f0", fg: C.sub };
  return <Badge label={label ?? titleize(value)} bg={t.bg} fg={t.fg} solid={t.solid} />;
}

export function toneColor(value?: string): string {
  return (TONE[value ?? ""] ?? { fg: C.sub }).fg;
}

/* ────────────────────────── accordion (native, zero-JS) ────────────────────────── */

export function Accordion({
  items,
}: {
  items: { key: string; title: ReactNode; right?: ReactNode; defaultOpen?: boolean; children: ReactNode }[];
}) {
  if (!items.length) return <Empty />;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((it) => (
        <details key={it.key} open={it.defaultOpen} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          <summary
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: 600,
              listStyle: "none",
            }}
          >
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</span>
            {it.right}
          </summary>
          <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${C.border}` }}>{it.children}</div>
        </details>
      ))}
    </div>
  );
}

/* ────────────────────────── table (optional client sort) ────────────────────────── */

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
}

export function Table<T>({
  columns,
  rows,
  rowStyle,
  emptyText,
}: {
  columns: Column<T>[];
  rows: T[];
  rowStyle?: (row: T) => CSSProperties | undefined;
  emptyText?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
      return String(av).localeCompare(String(bv)) * sort.dir;
    });
  }, [rows, sort, columns]);

  if (!rows.length) return <Empty>{emptyText ?? "No rows."}</Empty>;

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  onClick={col.sortValue ? () => toggle(col.key) : undefined}
                  style={{
                    textAlign: col.align ?? "left",
                    background: "#f6f8f7",
                    border: `1px solid ${C.border}`,
                    padding: "6px 9px",
                    fontWeight: 700,
                    color: C.sub,
                    whiteSpace: "nowrap",
                    cursor: col.sortValue ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {col.header}
                  {col.sortValue && <span style={{ opacity: active ? 1 : 0.3 }}>{active ? (sort!.dir === 1 ? " ▲" : " ▼") : " ↕"}</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} style={rowStyle?.(row)}>
              {columns.map((col) => (
                <td key={col.key} style={{ textAlign: col.align ?? "left", border: `1px solid ${C.border}`, padding: "6px 9px", verticalAlign: "top" }}>
                  {col.render ? col.render(row) : safeText((row as Record<string, unknown>)[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────── raw JSON fallback ────────────────────────── */

export function RawJsonDetails({ value }: { value: unknown }) {
  return (
    <details style={{ marginTop: 6 }}>
      <summary style={{ fontSize: 12.5, color: C.sub, cursor: "pointer", fontWeight: 600 }}>View raw artifact (JSON)</summary>
      <pre
        style={{
          fontSize: 11,
          background: "#f6f8f7",
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 10,
          overflowY: "auto",
          overflowX: "hidden",
          maxHeight: 320,
          marginTop: 8,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

/* ────────────────────────── markdown ────────────────────────── */

/** Scoped CSS for rendered markdown; injected once by StageView. */
export const STAGE_MD_CSS = `
.gm-md{font-size:13.5px;line-height:1.55;color:#1a2420;word-break:break-word}
.gm-md h1,.gm-md h2,.gm-md h3{font-size:15px;font-weight:700;margin:12px 0 6px}
.gm-md h4,.gm-md h5{font-size:13.5px;font-weight:700;margin:10px 0 4px}
.gm-md p{margin:6px 0}
.gm-md ul,.gm-md ol{margin:6px 0;padding-left:20px}
.gm-md li{margin:3px 0}
.gm-md table{border-collapse:collapse;width:100%;font-size:12px;margin:8px 0}
.gm-md th,.gm-md td{border:1px solid #e3e8e5;padding:5px 8px;text-align:left}
.gm-md th{background:#f6f8f7}
.gm-md code{background:#f6f8f7;padding:1px 5px;border-radius:4px;font-size:12px;font-family:ui-monospace,Menlo,monospace}
.gm-md a{color:#1f8a5b}
.gm-md blockquote{border-left:3px solid #e3e8e5;margin:8px 0;padding-left:12px;color:#5d6b64}
`;

export function MarkdownBlock({ md }: { md?: string }) {
  if (!md || !md.trim()) return <Empty>No content.</Empty>;
  return <div className="gm-md" dangerouslySetInnerHTML={{ __html: mdToSafeHtml(md) }} />;
}

/* ────────────────────────── charts ────────────────────────── */

export function ProgressBar({
  value,
  max = 100,
  color,
  showPct = true,
  height = 12,
}: {
  value?: number | null;
  max?: number;
  color?: string;
  showPct?: boolean;
  height?: number;
}) {
  if (typeof value !== "number" || !Number.isFinite(value)) return <Empty>Not yet computed.</Empty>;
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const band = pct >= 70 ? C.high : pct >= 40 ? C.medium : C.low;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, background: "#eef1f0", borderRadius: 999, height, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, background: color ?? band, height: "100%", borderRadius: 999, transition: "width .3s" }} />
      </div>
      {showPct && <span style={{ fontSize: 13, fontWeight: 700, minWidth: 38, textAlign: "right" }}>{Math.round(pct)}%</span>}
    </div>
  );
}

/** Semicircular score gauge (0..max). Band-coloured. */
export function Gauge({ value, max = 100, label }: { value?: number | null; max?: number; label?: string }) {
  if (typeof value !== "number" || !Number.isFinite(value)) return <Empty>Not yet computed.</Empty>;
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const ARC = Math.PI * 80; // length of the 180° arc, r=80
  const band = frac >= 0.7 ? C.high : frac >= 0.4 ? C.medium : C.low;
  const path = "M20 100 A 80 80 0 0 1 180 100";
  return (
    <svg viewBox="0 0 200 124" width={180} height={112} role="img" aria-label={`${label ?? "score"}: ${value} of ${max}`}>
      <path d={path} fill="none" stroke="#eef1f0" strokeWidth={14} strokeLinecap="round" />
      <path d={path} fill="none" stroke={band} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${frac * ARC} ${ARC}`} />
      <text x={100} y={96} textAnchor="middle" fontSize={34} fontWeight={750} fill={C.text}>
        {fmt(value)}
      </text>
      <text x={100} y={116} textAnchor="middle" fontSize={12} fill={C.sub}>
        {label ?? `out of ${max}`}
      </text>
    </svg>
  );
}

/** Horizontal bar chart (div-based, responsive). */
export function BarChart({
  data,
  valueFmt,
  emptyText,
}: {
  data: { label: string; value?: number | null; color?: string }[];
  valueFmt?: (n: number) => string;
  emptyText?: string;
}) {
  const rows = data.filter((d) => typeof d.value === "number" && Number.isFinite(d.value)) as { label: string; value: number; color?: string }[];
  if (!rows.length) return <Empty>{emptyText ?? "Not yet computed."}</Empty>;
  const max = Math.max(...rows.map((d) => d.value), 0) || 1;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((d, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(80px,140px) 1fr auto", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.label}>
            {d.label}
          </span>
          <div style={{ background: "#eef1f0", borderRadius: 6, height: 14, overflow: "hidden" }}>
            <div style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? ACCENT, height: "100%", borderRadius: 6 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 650, minWidth: 44, textAlign: "right" }}>{valueFmt ? valueFmt(d.value) : fmt(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Single stacked horizontal bar with a legend. */
export function StackedBar({
  segments,
  valueFmt,
  emptyText,
}: {
  segments: { label: string; value?: number | null; color: string }[];
  valueFmt?: (n: number) => string;
  emptyText?: string;
}) {
  const segs = segments.filter((s) => typeof s.value === "number" && Number.isFinite(s.value) && (s.value as number) > 0) as {
    label: string;
    value: number;
    color: string;
  }[];
  const total = segs.reduce((a, s) => a + s.value, 0);
  if (!segs.length || total <= 0) return <Empty>{emptyText ?? "Not yet computed."}</Empty>;
  const f = valueFmt ?? fmt;
  return (
    <div>
      <div style={{ display: "flex", height: 24, borderRadius: 7, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {segs.map((s, i) => (
          <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${f(s.value)}`} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
        {segs.map((s, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: C.sub }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            {s.label}: <strong style={{ color: C.text }}>{f(s.value)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Donut with legend. */
export function Donut({
  segments,
  centerLabel,
}: {
  segments: { label: string; value?: number | null; color: string }[];
  centerLabel?: string;
}) {
  const segs = segments.filter((s) => typeof s.value === "number" && Number.isFinite(s.value) && (s.value as number) > 0) as {
    label: string;
    value: number;
    color: string;
  }[];
  const total = segs.reduce((a, s) => a + s.value, 0);
  if (!total) return <Empty>No data.</Empty>;
  const r = 46;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  const drawn = segs.map((s) => {
    const len = (s.value / total) * circ;
    const node = { ...s, len, offset: acc };
    acc += len;
    return node;
  });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <svg viewBox="0 0 120 120" width={108} height={108} role="img" aria-label="distribution">
        <g transform="rotate(-90 60 60)">
          {drawn.map((s, i) => (
            <circle
              key={i}
              cx={60}
              cy={60}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={16}
              strokeDasharray={`${s.len} ${circ - s.len}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </g>
        <text x={60} y={57} textAnchor="middle" fontSize={22} fontWeight={750} fill={C.text}>
          {total}
        </text>
        {centerLabel && (
          <text x={60} y={73} textAnchor="middle" fontSize={9} fill={C.sub}>
            {centerLabel}
          </text>
        )}
      </svg>
      <div style={{ display: "grid", gap: 6 }}>
        {drawn.map((s, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: C.sub }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            {s.label} <strong style={{ color: C.text }}>{s.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Impact × financial materiality scatter "matrix" with quadrant + threshold. */
export function ScatterMatrix({
  points,
  xMax = 5,
  yMax = 5,
  xLabel = "Financial materiality",
  yLabel = "Impact materiality",
  threshold,
}: {
  points: { x?: number | null; y?: number | null; label: string; color?: string }[];
  xMax?: number;
  yMax?: number;
  xLabel?: string;
  yLabel?: string;
  threshold?: number;
}) {
  const pts = points.filter((p) => typeof p.x === "number" && typeof p.y === "number" && Number.isFinite(p.x) && Number.isFinite(p.y)) as {
    x: number;
    y: number;
    label: string;
    color?: string;
  }[];
  if (!pts.length) return <Empty>No scored topics to plot.</Empty>;

  const padL = 36;
  const padB = 30;
  const padT = 14;
  const padR = 14;
  const W = 320;
  const H = 300;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const px = (x: number) => padL + (x / xMax) * plotW;
  const py = (y: number) => padT + plotH - (y / yMax) * plotH;
  const t = threshold ?? xMax / 2;
  const ticks = Array.from({ length: xMax + 1 }, (_, i) => i);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 420, height: "auto" }} role="img" aria-label="materiality matrix">
        {/* plot background + material quadrant */}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill="#fbfdfc" />
        <rect x={px(t)} y={py(yMax)} width={px(xMax) - px(t)} height={py(t) - py(yMax)} fill="#e6f4ec" />
        {/* threshold crosshair */}
        <line x1={px(t)} y1={padT} x2={px(t)} y2={padT + plotH} stroke={C.medium} strokeWidth={1} strokeDasharray="4 4" />
        <line x1={padL} y1={py(t)} x2={padL + plotW} y2={py(t)} stroke={C.medium} strokeWidth={1} strokeDasharray="4 4" />
        <text x={px(xMax) - 4} y={py(yMax) + 12} textAnchor="end" fontSize={9} fontWeight={700} fill={C.high}>
          MATERIAL
        </text>
        {/* axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={C.border} strokeWidth={1} />
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke={C.border} strokeWidth={1} />
        {ticks.map((tk) => (
          <g key={tk}>
            <text x={px(tk)} y={H - 16} textAnchor="middle" fontSize={9} fill={C.sub}>
              {tk}
            </text>
            <text x={padL - 6} y={py(tk) + 3} textAnchor="end" fontSize={9} fill={C.sub}>
              {tk}
            </text>
          </g>
        ))}
        {/* axis titles */}
        <text x={padL + plotW / 2} y={H - 2} textAnchor="middle" fontSize={10} fontWeight={600} fill={C.sub}>
          {xLabel} →
        </text>
        <text transform={`rotate(-90 10 ${padT + plotH / 2})`} x={10} y={padT + plotH / 2} textAnchor="middle" fontSize={10} fontWeight={600} fill={C.sub}>
          {yLabel} →
        </text>
        {/* dots */}
        {pts.map((p, i) => {
          const jx = ((i * 37) % 7) - 3;
          const jy = ((i * 53) % 7) - 3;
          return (
            <g key={i}>
              <circle cx={px(p.x) + jx} cy={py(p.y) + jy} r={7} fill={p.color ?? ACCENT} opacity={0.85} stroke="#fff" strokeWidth={1.5} />
              <text x={px(p.x) + jx} y={py(p.y) + jy + 3} textAnchor="middle" fontSize={8} fontWeight={700} fill="#fff">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
        {pts.map((p, i) => (
          <div key={i} style={{ fontSize: 12, color: C.sub, display: "flex", gap: 8 }}>
            <span style={{ fontWeight: 700, color: p.color ?? ACCENT, minWidth: 16 }}>{i + 1}.</span>
            <span style={{ color: C.text }}>{p.label}</span>
            <span style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
              I {p.y} · F {p.x}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
