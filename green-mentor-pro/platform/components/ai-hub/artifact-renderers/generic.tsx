"use client";

/**
 * Generic fallback renderer for heterogeneous artifact payloads. Rather than a
 * per-type switch that breaks on an unexpected shape, we recursively render
 * objects / arrays / primitives into a readable layout. Arrays of flat records
 * become tables; everything else falls back to labelled key/value groups. The
 * detail view always offers a raw JSON toggle as the ultimate fallback, so an
 * unknown/renamed type never crashes.
 */

export function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isComplex(v: unknown): boolean {
  return v !== null && typeof v === "object";
}

/** Flat = every value is a scalar or an array of scalars, i.e. table-cell sized. */
function isFlatRecord(x: unknown): x is Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  return Object.values(x).every(
    (v) => !isComplex(v) || (Array.isArray(v) && v.every((y) => !isComplex(y)))
  );
}

/** A list of similar flat records reads far better as a table than as stacked cards. */
function asTableRows(v: unknown[]): Record<string, unknown>[] | null {
  if (v.length < 2 || !v.every(isFlatRecord)) return null;
  const cols: string[] = [];
  for (const row of v) for (const k of Object.keys(row)) if (!cols.includes(k)) cols.push(k);
  if (cols.length < 2 || cols.length > 6) return null;
  // Long prose cells (report sections, narratives) don't fit a grid — keep cards.
  const hasLongText = v.some((row) =>
    Object.values(row).some((cell) => typeof cell === "string" && cell.length > 220)
  );
  return hasLongText ? null : (v as Record<string, unknown>[]);
}

function TableView({ rows }: { rows: Record<string, unknown>[] }) {
  const cols: string[] = [];
  for (const row of rows) for (const k of Object.keys(row)) if (!cols.includes(k)) cols.push(k);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200">
            {cols.map((c) => (
              <th
                key={c}
                className="whitespace-nowrap pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
              >
                {humanize(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              {cols.map((c) => (
                <td key={c} className="py-2.5 pr-4 text-[12.5px] leading-relaxed text-ink">
                  <Value v={row[c]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Value({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === "") return <span className="text-gray-400">—</span>;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return <span className="whitespace-pre-wrap break-words">{String(v)}</span>;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-gray-400">none</span>;
    if (v.every((x) => !isComplex(x))) {
      if (v.length > 2 || v.some((x) => String(x).length > 60)) {
        return (
          <ul className="space-y-1">
            {v.map((x, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gray-300" aria-hidden />
                <span className="break-words">{String(x)}</span>
              </li>
            ))}
          </ul>
        );
      }
      return <span className="break-words">{v.map((x) => String(x)).join(", ")}</span>;
    }
    const tableRows = asTableRows(v);
    if (tableRows) return <TableView rows={tableRows} />;
    return (
      <div className="space-y-2">
        {v.map((x, i) => (
          <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
            <Value v={x} />
          </div>
        ))}
      </div>
    );
  }
  return <ObjectView o={v as Record<string, unknown>} />;
}

export function ObjectView({ o }: { o: Record<string, unknown> }) {
  const entries = Object.entries(o);
  if (entries.length === 0) return <span className="text-gray-400">—</span>;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {entries.map(([k, val]) => (
        <div key={k} className={isComplex(val) ? "sm:col-span-2" : ""}>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{humanize(k)}</dt>
          <dd className="mt-1 text-[13px] leading-relaxed text-ink">
            <Value v={val} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
