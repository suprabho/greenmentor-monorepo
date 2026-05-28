import { useMemo, useState, useRef, useEffect } from 'react'
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table'
import type { EmissionFactor, EFFilters } from '@/types/emission-factor'
import { cn, dqColor, geoLabel, scopeShort, formatValidity } from '@/lib/utils'
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Columns } from 'lucide-react'
import { efApi } from '@/lib/api'

interface EFTableProps {
  data: EmissionFactor[]
  total: number
  filters: EFFilters
  onFiltersChange: (f: EFFilters) => void
  selectedId: string | null
  onSelect: (ef: EmissionFactor) => void
  isLoading: boolean
}

// Optional columns that can be toggled on/off
const OPTIONAL_COLS = [
  { key: 'sub_category',         label: 'Sub-category',  defaultOn: false },
  { key: 'fuel_material_type',   label: 'Fuel / material', defaultOn: false },
  { key: 'system_boundary',      label: 'System boundary', defaultOn: false },
  { key: 'calculation_method',   label: 'Calc method',     defaultOn: false },
  { key: 'data_origin',          label: 'Data origin',     defaultOn: false },
  { key: 'gwp_basis',            label: 'GWP basis',       defaultOn: false },
  { key: 'valid_from',           label: 'Valid from',      defaultOn: false },
  { key: 'valid_to',             label: 'Valid to',        defaultOn: false },
  { key: 'uncertainty_pct',      label: 'Uncertainty %',   defaultOn: false },
]

export default function EFTable({ data, total, filters, onFiltersChange, selectedId, onSelect, isLoading }: EFTableProps) {
  const [visibleOptional, setVisibleOptional] = useState<Set<string>>(
    new Set(OPTIONAL_COLS.filter(c => c.defaultOn).map(c => c.key))
  )
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!colPickerOpen) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setColPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [colPickerOpen])

  const toggleCol = (key: string) => {
    setVisibleOptional(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const columns = useMemo<ColumnDef<EmissionFactor>[]>(() => {
    const cols: ColumnDef<EmissionFactor>[] = [
      {
        accessorKey: 'activity_name',
        header: 'Activity',
        size: 260,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 min-w-0">
            {row.original.has_conflict && (
              <span title="Conflict flagged">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              </span>
            )}
            <div className="min-w-0">
              <span className="truncate text-sm block">{row.original.activity_name}</span>
              {row.original.emission_category && (
                <span className="text-[10px] text-muted-foreground truncate block">{row.original.emission_category}</span>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'ef_value',
        header: () => (
          <span>
            EF Value
            <span className="block text-[10px] font-normal text-muted-foreground leading-tight">value · species · units</span>
          </span>
        ),
        size: 200,
        cell: ({ row }) => {
          const r = row.original
          return (
            <div className="font-mono text-sm tabular-nums">
              {r.ef_value.toFixed(4)}
              <span className="ml-1 text-[10px] text-muted-foreground">
                {r.ghg_species} · {r.numerator_unit}/{r.denominator_unit}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'ghg_scope',
        header: 'Scope',
        size: 60,
        cell: ({ getValue }) => <span className="text-xs">{scopeShort(getValue() as string | null)}</span>,
      },
      {
        id: 'geography',
        header: 'Geo',
        size: 70,
        cell: ({ row }) => (
          <span className="text-xs font-mono">
            {geoLabel(row.original.geography_type, row.original.country_iso, row.original.region_name)}
          </span>
        ),
      },
      {
        accessorKey: 'reference_year',
        header: 'Year',
        size: 60,
        cell: ({ getValue }) => <span className="text-xs font-mono">{getValue() as number}</span>,
      },
      {
        accessorKey: 'source_organization',
        header: 'Source',
        size: 160,
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="text-xs truncate block">{row.original.source_organization}</span>
            {row.original.source_database && (
              <span className="text-[10px] text-muted-foreground truncate block">{row.original.source_database}</span>
            )}
          </div>
        ),
      },
    ]

    if (visibleOptional.has('sub_category')) {
      cols.push({ id: 'sub_category', accessorKey: 'sub_category', header: 'Sub-category', size: 160,
        cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{(getValue() as string) || '—'}</span> })
    }
    if (visibleOptional.has('fuel_material_type')) {
      cols.push({ id: 'fuel_material_type', accessorKey: 'fuel_material_type', header: 'Fuel/material', size: 140,
        cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{(getValue() as string) || '—'}</span> })
    }
    if (visibleOptional.has('system_boundary')) {
      cols.push({ id: 'system_boundary', accessorKey: 'system_boundary', header: 'System boundary', size: 130,
        cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue() as string}</span> })
    }
    if (visibleOptional.has('calculation_method')) {
      cols.push({ id: 'calculation_method', accessorKey: 'calculation_method', header: 'Calc method', size: 120,
        cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue() as string}</span> })
    }
    if (visibleOptional.has('data_origin')) {
      cols.push({ id: 'data_origin', accessorKey: 'data_origin', header: 'Data origin', size: 90,
        cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue() as string}</span> })
    }
    if (visibleOptional.has('gwp_basis')) {
      cols.push({ id: 'gwp_basis', accessorKey: 'gwp_basis', header: 'GWP basis', size: 80,
        cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{(getValue() as string) || '—'}</span> })
    }
    if (visibleOptional.has('valid_from')) {
      cols.push({ id: 'valid_from', accessorKey: 'valid_from', header: 'Valid from', size: 90,
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return <span className="text-xs text-muted-foreground">{v ? new Date(v).getFullYear() : '—'}</span>
        }})
    }
    if (visibleOptional.has('valid_to')) {
      cols.push({ id: 'valid_to', accessorKey: 'valid_to', header: 'Valid to', size: 90,
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return <span className="text-xs text-muted-foreground">{v ? new Date(v).getFullYear() : '∞'}</span>
        }})
    }
    if (visibleOptional.has('uncertainty_pct')) {
      cols.push({ id: 'uncertainty_pct', accessorKey: 'uncertainty_pct', header: '±%', size: 60,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return v != null
            ? <span className="text-xs font-mono">±{v.toFixed(1)}%</span>
            : <span className="text-muted-foreground text-xs">—</span>
        }})
    }

    cols.push(
      {
        id: 'validity',
        header: 'Validity',
        size: 100,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatValidity(row.original.valid_from, row.original.valid_to)}
          </span>
        ),
      },
      {
        accessorKey: 'dq_score_overall',
        header: 'DQ',
        size: 50,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return v != null
            ? <span className={cn('text-sm font-mono', dqColor(v))}>{v}</span>
            : <span className="text-muted-foreground text-xs">—</span>
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 90,
        cell: ({ getValue }) => {
          const v = getValue() as string
          const klass = v === 'active' ? 'text-green-600' : v === 'deprecated' ? 'text-amber-600' : 'text-muted-foreground'
          return <span className={cn('text-xs', klass)}>{v}</span>
        },
      },
    )

    return cols
  }, [visibleOptional])

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  const page = filters.page ?? 1
  const pageSize = filters.page_size ?? 50
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleExport = async () => {
    const res = await efApi.exportCsv(filters)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'emission_factors.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const SORTABLE_COLS = new Set(['activity_name', 'reference_year', 'dq_score_overall', 'valid_from', 'source_organization', 'created_at'])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-auto">
        <table className="ef-table w-full border-collapse">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th
                    key={h.id}
                    style={{ width: h.getSize() }}
                    className="text-left whitespace-nowrap align-top"
                    onClick={() => {
                      const col = h.column.id
                      if (!SORTABLE_COLS.has(col)) return
                      const currentDir = filters.sort_dir ?? 'desc'
                      onFiltersChange({
                        ...filters,
                        sort_by: col,
                        sort_dir: filters.sort_by === col && currentDir === 'desc' ? 'asc' : 'desc',
                        page: 1,
                      })
                    }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {filters.sort_by === h.column.id && (filters.sort_dir === 'desc' ? ' ↓' : ' ↑')}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-16 text-muted-foreground text-sm">Loading…</td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-16 text-muted-foreground text-sm">
                  No emission factors found. Adjust filters or upload a document.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} onClick={() => onSelect(row.original)} className={cn(row.original.id === selectedId && 'selected')}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border px-4 py-2 flex items-center justify-between shrink-0 bg-card">
        <span className="text-xs text-muted-foreground">
          {total.toLocaleString()} record{total !== 1 ? 's' : ''}
          {total > 0 && ` · page ${page} of ${totalPages}`}
        </span>

        <div className="flex items-center gap-2">
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setColPickerOpen(v => !v)}
              className={cn(
                'flex items-center gap-1.5 h-7 px-2.5 rounded text-xs border transition-colors',
                colPickerOpen
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-input hover:bg-muted/50'
              )}
            >
              <Columns className="w-3 h-3" />
              Columns
              {visibleOptional.size > 0 && (
                <span className="ml-0.5 px-1 py-0 rounded-full bg-primary text-primary-foreground text-[10px] leading-tight">
                  +{visibleOptional.size}
                </span>
              )}
            </button>

            {colPickerOpen && (
              <div className="absolute bottom-full right-0 mb-1 w-52 bg-card border border-border rounded-lg shadow-lg p-2 z-50">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">Optional columns</p>
                <div className="space-y-0.5">
                  {OPTIONAL_COLS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs select-none">
                      <input type="checkbox" className="accent-primary" checked={visibleOptional.has(col.key)} onChange={() => toggleCol(col.key)} />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleExport} className="flex items-center gap-1 h-7 px-2.5 rounded text-xs border border-input hover:bg-muted/50 transition-colors">
            <Download className="w-3 h-3" />
            Export CSV
          </button>

          <button disabled={page <= 1} onClick={() => onFiltersChange({ ...filters, page: page - 1 })} className="h-7 w-7 flex items-center justify-center rounded border border-input hover:bg-muted/50 disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button disabled={page >= totalPages} onClick={() => onFiltersChange({ ...filters, page: page + 1 })} className="h-7 w-7 flex items-center justify-center rounded border border-input hover:bg-muted/50 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
