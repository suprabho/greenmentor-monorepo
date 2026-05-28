import { useState } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import type { EFFilters } from '@/types/emission-factor'

const SCOPES = [
  'Scope 1', 'Scope 2',
  ...Array.from({ length: 15 }, (_, i) => `Scope 3 — Category ${i + 1}`),
]

const SOURCE_TYPES = [
  'Government / Regulatory body',
  'Intergovernmental body',
  'GHG Protocol / Industry standard',
  'Commercial LCA database export',
  'Peer-reviewed publication',
  'Industry association',
  'Supplier-provided / EPD',
  'Internal estimate',
  'Other',
]

interface FilterBarProps {
  filters: EFFilters
  onChange: (filters: EFFilters) => void
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const [showMore, setShowMore] = useState(false)

  const set = (key: keyof EFFilters, value: unknown) => {
    onChange({ ...filters, [key]: value || undefined, page: 1 })
  }

  const clearAll = () => onChange({ page: 1, page_size: filters.page_size })

  const activeCount = [filters.q, filters.year, filters.country, filters.scope, filters.source_type, filters.min_confidence, filters.conflicts_only, filters.gwp_version, filters.tags]
    .filter(Boolean).length

  return (
    <div className="border-b border-border bg-card px-4 py-2.5 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Semantic search */}
        <div className="relative min-w-[220px] max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            className="w-full h-8 pl-8 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search activities…"
            value={filters.q ?? ''}
            onChange={e => set('q', e.target.value)}
          />
        </div>

        {/* Year */}
        <input
          type="number"
          min={1990}
          max={2099}
          className="w-20 h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Year"
          value={filters.year ?? ''}
          onChange={e => set('year', e.target.value ? Number(e.target.value) : undefined)}
        />

        {/* Country */}
        <input
          className="w-20 h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring uppercase"
          placeholder="Country"
          maxLength={2}
          value={filters.country ?? ''}
          onChange={e => set('country', e.target.value.toUpperCase())}
        />

        {/* Scope */}
        <select
          className="h-8 px-2 pr-6 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.scope ?? ''}
          onChange={e => set('scope', e.target.value)}
        >
          <option value="">All Scopes</option>
          {SCOPES.map(s => (
            <option key={s} value={s}>{s.replace('Scope 3 — Category ', 'S3-C')}</option>
          ))}
        </select>

        {/* More filters toggle */}
        <button
          onClick={() => setShowMore(v => !v)}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-medium transition-colors ${showMore ? 'bg-primary/10 border-primary/30 text-primary' : 'border-input hover:bg-muted/50'}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          More {showMore ? '▲' : '▼'}
        </button>

        {/* Conflict toggle */}
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            className="accent-primary"
            checked={!!filters.conflicts_only}
            onChange={e => set('conflicts_only', e.target.checked || undefined)}
          />
          Conflicts only
        </label>

        {/* Clear */}
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
          {/* Source type */}
          <select
            className="h-8 px-2 pr-6 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={filters.source_type ?? ''}
            onChange={e => set('source_type', e.target.value)}
          >
            <option value="">All Sources</option>
            {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Confidence floor */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Conf ≥</span>
            <input
              type="number"
              min={0}
              max={100}
              className="w-14 h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={filters.min_confidence ?? ''}
              onChange={e => set('min_confidence', e.target.value ? Number(e.target.value) : undefined)}
            />
            <span className="text-muted-foreground">%</span>
          </div>

          {/* GWP version */}
          <select
            className="h-8 px-2 pr-6 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={filters.gwp_version ?? ''}
            onChange={e => set('gwp_version', e.target.value)}
          >
            <option value="">All GWP</option>
            {['AR4', 'AR5', 'AR6', 'GWP20', 'GWP100', 'Not stated'].map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* Tags */}
          <input
            className="w-32 h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Tags (comma-sep)"
            value={filters.tags ?? ''}
            onChange={e => set('tags', e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
