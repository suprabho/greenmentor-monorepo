/**
 * Searchable company directory — /brsr/companies. Client island (search state)
 * over a server-fetched list; filtering is local since the corpus is a few
 * thousand rows at most (same "load it all into JS" house pattern as the
 * BRSR dashboard's aggregates).
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { SUPER_SECTORS, type SuperSector } from "@/lib/nic/classification";
import type { CompanyListItem } from "@/lib/db/brsr-companies";

function scoreColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 80) return "text-green-700";
  if (score < 50) return "text-[#B25E00]";
  return "text-ink";
}

function SectorDot({ superSector }: { superSector: string | null }) {
  const hue = superSector && superSector in SUPER_SECTORS ? SUPER_SECTORS[superSector as SuperSector].hue : "#c3c2b7";
  return <span className="inline-block size-2 shrink-0 rounded-full" style={{ background: hue }} />;
}

export function CompanyDirectoryView({ companies }: { companies: CompanyListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [companies, query]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by symbol or company name…"
          className="w-full max-w-xs rounded-pill border border-gray-200 px-3 py-1.5 text-[13px] text-ink outline-none focus:border-teal-700"
        />
        <span className="shrink-0 text-[12px] text-gray-500">
          {filtered.length.toLocaleString("en-IN")} of {companies.length.toLocaleString("en-IN")} companies
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr>
              {["Symbol", "Company", "FY", "Sector", "Coverage", "Contact"].map((h, i) => (
                <th
                  key={h}
                  className={`border-b border-gray-200 pb-2 pr-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500 ${
                    i >= 4 ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.symbol} className="group">
                <td className="border-b border-gray-100 py-2 pr-3">
                  <Link href={`/brsr/companies/${c.symbol}`} className="font-semibold text-teal-800 group-hover:underline">
                    {c.symbol}
                  </Link>
                </td>
                <td className="max-w-[280px] truncate border-b border-gray-100 py-2 pr-3 text-ink" title={c.name}>
                  {c.name}
                </td>
                <td className="border-b border-gray-100 py-2 pr-3 text-gray-500">{c.fy}</td>
                <td className="border-b border-gray-100 py-2 pr-3">
                  {c.sectionLetter ? (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <SectorDot superSector={c.superSector} />
                      <span className="shrink-0 font-semibold text-gray-700">{c.sectionLetter}</span>
                      <span className="truncate text-gray-500" title={c.sectionTitle ?? undefined}>
                        {c.sectionTitle}
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-400">unmapped</span>
                  )}
                </td>
                <td className={`border-b border-gray-100 py-2 pr-3 text-right tabular-nums font-medium ${scoreColor(c.coverageScore)}`}>
                  {c.coverageScore ?? "—"}
                </td>
                <td className="border-b border-gray-100 py-2 text-right">
                  {c.hasContact ? (
                    <span className="text-green-700" title="Contact email on file">
                      ✓
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="py-6 text-center text-[13px] text-gray-500">No companies match &ldquo;{query}&rdquo;.</p>}
      </div>
    </Card>
  );
}
