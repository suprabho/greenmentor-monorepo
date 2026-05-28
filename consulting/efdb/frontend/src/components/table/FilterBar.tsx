import { useState } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import type { EFFilters } from '@/types/emission-factor'

const SCOPES = ['1', '2', '3']
const SPECIES = ['CO2e', 'CO2', 'CH4', 'N2O', 'SF6', 'NF3', 'HFC', 'PFC']
const CATEGORIES = ['energy', 'transport', 'material', 'waste', 'agriculture', 'industrial-process', 'land-use', 'fugitive', 'other']
const GWP = ['AR4', 'AR5', 'AR6', 'GWP20', 'GWP100']
const DQ_LABELS = ['1 (best)', '2', '3', '4', '5 (worst)']

interface FilterBarProps {
  filters: EFFilters
  onChange: (filters: EFFilters) => void
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const [showMore, setShowMore] = useState(false)

  const set = <K extends keyof EFFilters>(key: K, value: EFFilters[K] | undefined) => {
    onChange({ ...filters, [key]: value || undefined, page: 1 })
  }

  const clearAll = () => onChange({ page: 1, page_size: filters.page_size })

  const activeCount = [
    filters.q, filters.year, filters.country, filters.scope, filters.species,
    filters.category, filters.source_organization, filters.max_dq_score,
    filters.conflicts_only, filters.gwp_basis, filters.framework_tags, filters.sector_tags,
    filters.include_superseded,
  ].filter(Boolean).length

  return (
    <div className="border-b border-border bg-card px-4 py-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative min-w-[220px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            className="w-full h-8 pl-8 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search activities…"
            value={filters.q ?? ''}
            onChange={e => set('q', e.target.value)}
          />
        </div>

        <input
          type="number"
          min={1990}
          max={2099}
          className="w-20 h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Year"
          value={filters.year ?? ''}
          onChange={e => set('year', e.target.value ? Number(e.target.value) : undefined)}
        />

        <input
          className="w-20 h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring uppercase"
          placeholder="ISO3"
          maxLength={3}
          value={filters.country ?? ''}
          onChange={e => set('country', e.target.value.toUpperCase())}
        />

        <select
          className="h-8 px-2 pr-6 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.scope ?? ''}
          onChange={e => set('scope', e.target.value)}
        >
          <option value="">All Scopes</option>
          {SCOPES.map(s => <option key={s} value={s}>Scope {s}</option>)}
        </select>

        <select
          className="h-8 px-2 pr-6 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.species ?? ''}
          onChange={e => set('species', e.target.value)}
        >
          <option value="">All species</option>
          {SPECIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <button
          onClick={() => setShowMore(v => !v)}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-medium transition-colors ${showMore ? 'bg-primary/10 border-primary/30 text-primary' : 'border-input hover:bg-muted/50'}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          More {showMore ? '▲' : '▼'}
        </button>

        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            className="accent-primary"
            checked={!!filters.conflicts_only}
            onChange={e => set('conflicts_only', e.target.checked || undefined)}
          />
          Conflicts only
        </label>

        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 h-8 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <X className="w-3 h-3" />
            Clear ({activeCount})
          </button>
        )}
      </div>

      {showMore && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <select
            className="h-8 px-2 pr-6 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={filters.category ?? ''}
            onChange={e => set('category', e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <input
            className="w-44 h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Source org (substring)"
            value={filters.source_organization ?? ''}
            onChange={e => set('source_organization', e.target.value)}
          />

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">DQ ≤</span>
            <select
              className="h-8 px-2 pr-6 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filters.max_dq_score ?? ''}
              onChange={e => set('max_dq_score', e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">any</option>
              {DQ_LABELS.map((label, i) => <option key={i + 1} value={i + 1}>{label}</option>)}
            </select>
          </div>

          <select
            className="h-8 px-2 pr-6 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={filters.gwp_basis ?? ''}
            onChange={e => set('gwp_basis', e.target.value)}
          >
            <option value="">All GWP</option>
            {GWP.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <input
            className="w-32 h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Framework tags"
            value={filters.framework_tags ?? ''}
            onChange={e => set('framework_tags', e.target.value)}
          />
          <input
            className="w-32 h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Sector tags"
            value={filters.sector_tags ?? ''}
            onChange={e => set('sector_tags', e.target.value)}
          />

          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-primary"
              checked={!!filters.include_superseded}
              onChange={e => set('include_superseded', e.target.checked || undefined)}
            />
            Include superseded
          </label>
        </div>
      )}
    </div>
  )
}
