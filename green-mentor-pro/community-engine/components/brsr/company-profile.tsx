/**
 * Company profile — /brsr/companies/[symbol]. Pure server-rendered
 * presentation, same house idioms as brsr-dashboard.tsx (Card/Stat, thin
 * bars, <details> table views). Super-sector hues come straight from
 * lib/nic/classification.ts so this page reads as one system with /nic.
 */
import { Card, Chip, Stat } from "@/components/ui";
import { SUPER_SECTORS, type SuperSector } from "@/lib/nic/classification";
import type { BrsrCategory, CompanyProfile, Pillar } from "@/lib/db/brsr-companies";

const CATEGORY_LABELS: Record<BrsrCategory, string> = {
  emissions: "Emissions",
  energy: "Energy",
  water: "Water",
  waste: "Waste",
  safety: "Safety",
  workforce: "Workforce",
  social: "Social",
  financial: "Financial",
};

const PILLAR_LABELS: Record<Pillar, string> = {
  environment: "Environment",
  social: "Social",
  governance: "Governance",
};

const scoreTone = (score: number): "ok" | "warn" | "default" => (score >= 80 ? "ok" : score < 50 ? "warn" : "default");
const SCORE_HUE: Record<"ok" | "warn" | "default", string> = { ok: "#1baf7a", warn: "#e0952b", default: "#2a78d6" };

function SectorDot({ superSector }: { superSector: string | null | undefined }) {
  const hue = superSector && superSector in SUPER_SECTORS ? SUPER_SECTORS[superSector as SuperSector].hue : "#c3c2b7";
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: hue }} />;
}

function ContactRow({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[12px] text-gray-500">{label}</span>
      {value ? (
        href ? (
          <a href={href} target="_blank" rel="noreferrer" className="truncate text-[13px] font-medium text-teal-800 hover:underline">
            {value}
          </a>
        ) : (
          <span className="truncate text-[13px] text-ink">{value}</span>
        )
      ) : (
        <span className="text-[13px] text-gray-300">not filed</span>
      )}
    </div>
  );
}

function ScoreGauge({ label, score, matched, total }: { label: string; score: number; matched: number; total: number }) {
  const tone = scoreTone(score);
  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12.5px] text-ink">{label}</span>
        <span className="text-[12px] tabular-nums text-gray-500">
          {matched}/{total} ·{" "}
          <span className={`font-semibold ${tone === "ok" ? "text-green-700" : tone === "warn" ? "text-[#B25E00]" : "text-ink"}`}>{score}</span>
        </span>
      </div>
      <span className="block h-1.5 w-full overflow-hidden rounded-pill bg-gray-100">
        <span className="block h-full rounded-pill" style={{ width: `${Math.max(score, 2)}%`, background: SCORE_HUE[tone] }} />
      </span>
    </div>
  );
}

export function CompanyProfileView({ profile }: { profile: CompanyProfile }) {
  const { sector, industry, sectorShares, scorecard, activities } = profile;
  const maxShare = Math.max(1, ...sectorShares.map((s) => s.weight));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* identity + contact */}
      <Card className="p-5 lg:col-span-1">
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Identity &amp; contact</h2>
        <p className="mb-3 text-[12px] text-gray-500">As filed in BRSR Section A</p>
        <div className="divide-y divide-gray-100">
          <ContactRow label="CIN" value={profile.cin} />
          <ContactRow label="Email" value={profile.email} href={profile.email ? `mailto:${profile.email}` : undefined} />
          <ContactRow label="Phone" value={profile.phone} />
          <ContactRow
            label="Website"
            value={profile.website}
            href={profile.website ? `https://${profile.website.replace(/^https?:\/\//, "")}` : undefined}
          />
        </div>
      </Card>

      {/* sector / industry */}
      <Card className="p-5 lg:col-span-2">
        <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
          Sector &amp; industry (NIC-2008, turnover-weighted)
        </h2>
        {sector ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-gray-100 px-2.5 py-1 text-[12.5px] font-semibold text-ink">
                <SectorDot superSector={sector.superSector} />
                {sector.letter} · {sector.title}
              </span>
              {industry && (
                <span className="rounded-pill border border-gray-200 px-2.5 py-1 text-[12.5px] text-gray-700">
                  {industry.code} · {industry.title}
                </span>
              )}
              <span className="text-[12px] text-gray-500">
                {profile.sectorMappedCoverage !== null ? `${Math.round(profile.sectorMappedCoverage * 100)}% of reported turnover mapped` : null}
              </span>
            </div>
            {sectorShares.map((s) => (
              <div key={s.sectionLetter} className="flex items-center gap-3 py-[3px]">
                <span className="flex w-28 shrink-0 items-center gap-1.5 text-[12.5px] text-ink">
                  <SectorDot superSector={s.superSector} />
                  {s.sectionLetter}
                </span>
                <span className="h-4 flex-1 overflow-hidden rounded-[4px] bg-gray-100">
                  <span
                    className="block h-4 rounded-[4px]"
                    style={{
                      width: `${Math.max((100 * s.weight) / maxShare, 2)}%`,
                      background: s.superSector in SUPER_SECTORS ? SUPER_SECTORS[s.superSector as SuperSector].hue : "#c3c2b7",
                    }}
                  />
                </span>
                <span className="w-14 shrink-0 truncate text-right text-[12px] tabular-nums text-gray-600" title={s.sectionTitle}>
                  {Math.round(s.weight * 100)}%
                </span>
              </div>
            ))}
            {activities.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] text-gray-500">
                  {activities.length} product/service row{activities.length === 1 ? "" : "s"} — NIC codes as filed
                </summary>
                <table className="mt-2 w-full text-[12px]">
                  <thead>
                    <tr>
                      {["Product / service", "NIC code", "Resolved", "Turnover"].map((h, i) => (
                        <th key={h} className={`border-b border-gray-100 pb-1 pr-3 font-semibold text-gray-500 ${i === 0 ? "text-left" : "text-right"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((a, i) => (
                      <tr key={i}>
                        <td className="border-b border-gray-100 py-1 pr-3 text-left text-ink">{a.name ?? "—"}</td>
                        <td className="border-b border-gray-100 py-1 pr-3 text-right tabular-nums text-gray-600">{a.nicCode}</td>
                        <td className="border-b border-gray-100 py-1 pr-3 text-right text-gray-600">
                          {a.divisionCode ? `${a.divisionCode} / ${a.sectionLetter}` : <span className="text-[#B25E00]">unmapped</span>}
                        </td>
                        <td className="border-b border-gray-100 py-1 text-right tabular-nums text-gray-600">
                          {(a.turnover <= 1 ? a.turnover * 100 : a.turnover).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </>
        ) : (
          <p className="text-[13px] text-gray-500">No NIC-coded products/services resolved for this filing.</p>
        )}
      </Card>

      {/* coverage scorecard */}
      <Card className="p-5 lg:col-span-3">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Disclosure-coverage scorecard</h2>
            <p className="text-[12px] text-gray-500">
              Share of the curated BRSR Core indicators this filing reports — completeness, not performance.
            </p>
          </div>
          {scorecard && <Stat label="Overall" value={String(scorecard.overall.score)} sub={`${scorecard.overall.matched}/${scorecard.overall.total} keys`} tone={scoreTone(scorecard.overall.score)} />}
        </div>

        {!scorecard ? (
          <p className="text-[13px] text-gray-500">Not yet scored.</p>
        ) : (
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-3">
            <div>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">By pillar</h3>
              {(Object.keys(PILLAR_LABELS) as Pillar[]).map((p) => (
                <ScoreGauge key={p} label={PILLAR_LABELS[p]} score={scorecard.byPillar[p].score} matched={scorecard.byPillar[p].matched} total={scorecard.byPillar[p].total} />
              ))}
            </div>
            <div className="sm:col-span-2">
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">By category</h3>
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {(Object.keys(CATEGORY_LABELS) as BrsrCategory[]).map((c) => (
                  <ScoreGauge
                    key={c}
                    label={CATEGORY_LABELS[c]}
                    score={scorecard.byCategory[c].score}
                    matched={scorecard.byCategory[c].matched}
                    total={scorecard.byCategory[c].total}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {scorecard && scorecard.missingKeys.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[12px] text-gray-500">
              {scorecard.missingKeys.length} indicator{scorecard.missingKeys.length === 1 ? "" : "s"} not disclosed
            </summary>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {scorecard.missingKeys.map((k) => (
                <Chip key={k} tone="neutral">
                  {k}
                </Chip>
              ))}
            </div>
          </details>
        )}
      </Card>
    </div>
  );
}
