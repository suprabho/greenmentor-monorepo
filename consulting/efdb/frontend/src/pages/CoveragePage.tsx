import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Database, FileText, Factory, AlertTriangle, Globe, Loader2 } from 'lucide-react'
import { efApi } from '@/lib/api'
import type { CoverageStats } from '@/types/emission-factor'

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  sub?: string
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function BarList({ items, labelKey }: {
  items: { records: number; [k: string]: string | number }[]
  labelKey: string
}) {
  const max = Math.max(1, ...items.map(i => i.records))
  return (
    <div className="space-y-1.5">
      {items.map(item => (
        <div key={String(item[labelKey])} className="flex items-center gap-2 text-xs">
          <span className="w-44 truncate shrink-0 text-muted-foreground" title={String(item[labelKey])}>
            {String(item[labelKey])}
          </span>
          <div className="flex-1 h-4 bg-muted/40 rounded-sm overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-sm"
              style={{ width: `${Math.max(2, (item.records / max) * 100)}%` }}
            />
          </div>
          <span className="w-10 text-right tabular-nums font-medium">{item.records}</span>
        </div>
      ))}
    </div>
  )
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

export default function CoveragePage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery<CoverageStats>({
    queryKey: ['coverage-stats'],
    queryFn: () => efApi.coverage(),
    staleTime: 60_000,
  })

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="h-12 border-b border-border bg-card flex items-center px-4 gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to database
        </button>
        <span className="text-muted-foreground">·</span>
        <span className="text-sm font-medium">Coverage Dashboard</span>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-5">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading coverage stats…
          </div>
        )}
        {error != null && (
          <div className="px-4 py-3 rounded-md bg-destructive/10 text-destructive text-sm">
            Failed to load coverage stats: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        {data && (
          <>
            {/* Headline stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard icon={Database} label="Active emission factors" value={data.totals.active}
                sub={data.totals.all_records > data.totals.active
                  ? `${data.totals.all_records - data.totals.active} superseded`
                  : undefined} />
              <StatCard icon={Globe} label="Source databases" value={data.totals.source_databases} />
              <StatCard icon={FileText} label="EPDs" value={data.totals.epds}
                sub={`${data.epd.validity.valid} valid · ${data.epd.validity.expired} expired`} />
              <StatCard icon={Factory} label="Manufacturers" value={data.totals.manufacturers} />
              <StatCard icon={AlertTriangle} label="Flagged conflicts" value={data.totals.conflicts} />
            </div>

            {/* Source databases table */}
            <Section
              title="Emission factor databases"
              sub="Every source database represented in the EFDB, with record counts and temporal coverage."
            >
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3 font-medium">Source database</th>
                      <th className="py-2 px-3 font-medium text-right">Records</th>
                      <th className="py-2 px-3 font-medium text-right">EPDs</th>
                      <th className="py-2 px-3 font-medium text-right">Years</th>
                      <th className="py-2 pl-3 font-medium text-right">Countries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map(s => (
                      <tr key={s.name} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-1.5 pr-3 max-w-md truncate" title={s.name}>{s.name}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums font-medium">{s.records}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{s.epds || '—'}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">
                          {s.year_min === s.year_max ? s.year_min : `${s.year_min}–${s.year_max}`}
                        </td>
                        <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">{s.countries || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* EPD coverage */}
            <div className="grid md:grid-cols-2 gap-5">
              <Section
                title="EPD coverage by sector"
                sub={`${data.epd.validity.total} supplier-specific EPDs across product sectors.`}
              >
                <BarList items={data.epd.by_sector} labelKey="sector" />
              </Section>
              <Section title="Top EPD manufacturers" sub="Manufacturers with the most EPD-backed factors.">
                <BarList items={data.epd.top_manufacturers} labelKey="name" />
              </Section>
            </div>

            {/* Cross-cutting breakdowns */}
            <div className="grid md:grid-cols-3 gap-5">
              <Section title="By country">
                <BarList items={data.by_country.slice(0, 10)} labelKey="country" />
              </Section>
              <Section title="By GHG scope">
                <BarList
                  items={data.by_scope.map(s => ({ ...s, scope: `Scope ${s.scope}` }))}
                  labelKey="scope"
                />
              </Section>
              <Section title="By reference year">
                <BarList items={data.by_year} labelKey="year" />
              </Section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
