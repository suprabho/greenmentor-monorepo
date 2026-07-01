"use client";

/**
 * Resilient renderer for heterogeneous artifact payloads. Rather than a per-type
 * switch that breaks on an unexpected shape, we recursively render objects /
 * arrays / primitives into a readable layout. The detail view always offers a raw
 * JSON toggle as the ultimate fallback, so an unknown/renamed type never crashes.
 */

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isComplex(v: unknown): boolean {
  return v !== null && typeof v === "object";
}

function Value({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === "") return <span className="text-gray-400">—</span>;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return <span className="whitespace-pre-wrap break-words">{String(v)}</span>;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-gray-400">none</span>;
    if (v.every((x) => !isComplex(x))) {
      return <span className="break-words">{v.map((x) => String(x)).join(", ")}</span>;
    }
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

function ObjectView({ o }: { o: Record<string, unknown> }) {
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

// artifactType / phaseKey are accepted for future type-specific renderers; the
// generic recursive view already handles every current payload shape.
export function renderArtifact(_artifactType: string, _phaseKey: string, payload: unknown) {
  return <Value v={payload} />;
}
