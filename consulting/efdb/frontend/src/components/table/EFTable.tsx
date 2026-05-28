import { useMemo, useState, useRef, useEffect } from 'react'
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table'
import type { EmissionFactor, EFFilters } from '@/types/emission-factor'
import { cn, confColor, geoLabel, scopeShort, formatValidity } from '@/lib/utils'
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
  { key: 'ef_co2',         label: 'CO₂ (kg)',  defaultOn: false },
  { key: 'ef_ch4',         label: 'CH₄ (kg)',  defaultOn: false },
  { key: 'ef_n2o',         label: 'N₂O (kg)',  defaultOn: false },
  { key: 'ef_pfc',         label: 'PFC (kg)',  defaultOn: false },
  { key: 'ef_sf6',         label: 'SF₆ (kg)',  defaultOn: false },
  { key: 'ef_nf3',         label: 'NF₃ (kg)',  defaultOn: false },
  { key: 'validity_start', label: 'Valid From', defaultOn: false },
  { key: 'validity_end',   label: 'Valid To',   defaultOn: false },
  { key: 'lca_stages',     label: 'LCA Stage',  defaultOn: false },
  { key: 'activity_category', label: 'Category', defaultOn: false },
]

function numCell(val: number | null) {
  return val != null
    ? <span className="font-mono text-sm tabular-nums">{val.toFixed(4)}</span>
    : <span className="text-muted-foreground text-xs">—</span>
}

export default function EFTable({ data, total, filters, onFiltersChange, selectedId, onSelect, isLoading }: EFTableProps) {
  const [visibleOptional, setVisibleOptional] = useState<Set<string>>(
    new Set(OPTIONAL_COLS.filter(c => c.defaultOn).map(c => c.key))
  )
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker on outside click
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
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const columns = useMemo<ColumnDef<EmissionFactor>[]>(() => {
    const cols: ColumnDef<EmissionFactor>[] = [
      {
        accessorKey: 'canonical_activity_name',
        header: 'Activity',
        size: 260,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 min-w-0">
            {row.original.has_conflict && (
              <span title="Conflict flagged">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              </span>
            )}
            <span className="truncate text-sm">{row.original.canonical_activity_name}</span>
          </div>
        ),
      },
      {
        accessorKey: 'unit',
        header: 'Unit',
        size: 130,
        cell: ({ getValue }) => <span className="text-xs text-muted-foreground font-mono">{getValue() as string}</span>,
      },
      {
        accessorKey: 'ef_total_co2e',
        header: () => (
          <span>
            EF Total
            <span className="block text-[10px] font-normal text-muted-foreground leading-tight">kg CO₂e / unit</span>
          </span>
        ),
        size: 110,
        cell: ({ getValue, row }) => {
          const v = getValue() as number | null
          return v != null
            ? (
              <div>
                <span className="font-mono text-sm tabular-nums">{v.toFixed(4)}</span>
                <span className="block text-[10px] text-muted-foreground">{row.original.unit}</span>
              </div>
            )
            : <span className="text-muted-foreground">—</span>
        },
      },
    ]

    // Optional gas component columns
    if (visibleOptional.has('ef_co2')) {
      cols.push({ id: 'ef_co2', accessorKey: 'ef_co2', header: 'CO₂ (kg)', size: 90, cell: ({ getValue }) => numCell(getValue() as number | null) })
    }
    if (visibleOptional.has('ef_ch4')) {
      cols.push({ id: 'ef_ch4', accessorKey: 'ef_ch4', header: 'CH₄ (kg)', size: 90, cell: ({ getValue }) => numCell(getValue() as number | null) })
    }
    if (visibleOptional.has('ef_n2o')) {
      cols.push({ id: 'ef_n2o', accessorKey: 'ef_n2o', header: 'N₂O (kg)', size: 90, cell: ({ getValue }) => numCell(getValue() as number | null) })
    }
    if (visibleOptional.has('ef_pfc')) {
      cols.push({ id: 'ef_pfc', accessorKey: 'ef_pfc', header: 'PFC (kg)', size: 90, cell: ({ getValue }) => numCell(getValue() as number | null) })
    }
    if (visibleOptional.has('ef_sf6')) {
      cols.push({ id: 'ef_sf6', accessorKey: 'ef_sf6', header: 'SF₆ (kg)', size: 90, cell: ({ getValue }) => numCell(getValue() as number | null) })
    }
    if (visibleOptional.has('ef_nf3')) {
      cols.push({ id: 'ef_nf3', accessorKey: 'ef_nf3', header: 'NF₃ (kg)', size: 90, cell: ({ getValue }) => numCell(getValue() as number | null) })
    }

    // Always-on columns continue
    cols.push(
      {
        accessorKey: 'applicable_scopes',
        header: 'Scope',
        size: 80,
        cell: ({ getValue }) => <span className="text-xs">{scopeShort(getValue() as string[] | null)}</span>,
      },
      {
        id: 'geography',
        header: 'Geo',
        size: 60,
        cell: ({ row }) => (
          <span className="text-xs font-mono">
            {geoLabel(row.original.geography_global, row.original.geography_country, row.original.geography_region)}
          </span>
        ),
      },
    )

    // Optional classification columns
    if (visibleOptional.has('lca_stages')) {
      cols.push({
        id: 'lca_stages',
        accessorKey: 'lca_stages',
        header: 'LCA Stage',
        size: 140,
        cell: ({ getValue }) => {
          const v = getValue() as string[] | null
          return <span className="text-xs text-muted-foreground">{v?.join(', ') || '—'}</span>
        },
      })
    }
    if (visibleOptional.has('activity_category')) {
      cols.push({
        id: 'activity_category',
        accessorKey: 'activity_category',
        header: 'Category',
        size: 140,
        cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{(getValue() as string) || '—'}</span>,
      })
    }

    // Validity columns
    if (visibleOptional.has('validity_start')) {
      cols.push({
        id: 'validity_start',
        accessorKey: 'validity_start',
        header: 'Valid From',
        size: 90,
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return <span className="text-xs text-muted-foreground">{v ? new Date(v).getFullYear() : '—'}</span>
        },
      })
    }
    if (visibleOptional.has('validity_end')) {
      cols.push({
        id: 'validity_end',
        accessorKey: 'validity_end',
        header: 'Valid To',
        size: 90,
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          return <span className="text-xs text-muted-foreground">{v ? new Date(v).getFullYear() : '∞'}</span>
        },
      })
    }

    // Remaining always-on columns
    cols.push(
      {
        id: 'gwp',
        accessorKey: 'gwp_version',
        header: 'GWP',
        size: 60,
        cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{(getValue() as string) ?? '—'}</span>,
      },
      {
        id: 'source',
        accessorKey: 'source_name',
        header: 'Source',
        size: 160,
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="text-xs truncate block">{row.original.source_name ?? '—'}</span>
            {row.original.source_type && (
              <span className="text-[10px] text-muted-foreground truncate block">{row.original.source_type}</span>
            )}
          </div>
        ),
      },
      {
        id: 'validity',
        header: 'Valid',
        size: 100,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatValidity(row.original.validity_start, row.original.validity_end)}
          </span>
        ),
      },
      {
        accessorKey: 'confidence_score',
        header: 'Conf',
        size: 60,
        cell: ({ getValue }) => {
          const v = getValue() as number | null
          return v != null
            ? <span className={cn('text-sm font-mono', confColor(v))}>{v}%</span>
            : <span className="text-muted-foreground text-xs">—</span>
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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Table */}
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
                      const sortable = ['canonical_activity_name', 'confidence_score', 'validity_start', 'ef_total_co2e']
                      if (!sortable.includes(col)) return
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
                <td colSpan={columns.length} className="text-center py-16 text-muted-foreground text-sm">
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-16 text-muted-foreground text-sm">
                  No emission factors found. Adjust filters or upload a document.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => onSelect(row.original)}
                  className={cn(row.original.id === selectedId && 'selected')}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination + controls */}
      <div className="border-t border-border px-4 py-2 flex items-center justify-between shrink-0 bg-card">
        <span className="text-xs text-muted-foreground">
          {total.toLocaleString()} record{total !== 1 ? 's' : ''}
          {total > 0 && ` · page ${page} of ${totalPages}`}
        </span>

        <div className="flex items-center gap-2">
          {/* Column picker */}
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
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
                  Optional columns
                </p>
                <div className="space-y-0.5">
                  {OPTIONAL_COLS.map(col => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50 cursor-pointer text-xs select-none"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={visibleOptional.has(col.key)}
                        onChange={() => toggleCol(col.key)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleExport}
            className="flex items-center gap-1 h-7 px-2.5 rounded text-xs border border-input hover:bg-muted/50 transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>

          <button
            disabled={page <= 1}
            onClick={() => onFiltersChange({ ...filters, page: page - 1 })}
            className="h-7 w-7 flex items-center justify-center rounded border border-input hover:bg-muted/50 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => onFiltersChange({ ...filters, page: page + 1 })}
            className="h-7 w-7 flex items-center justify-center rounded border border-input hover:bg-muted/50 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
