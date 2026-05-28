import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, RotateCcw, Pencil, CheckCircle2 } from 'lucide-react'
import type { EmissionFactor } from '@/types/emission-factor'
import { efApi } from '@/lib/api'
import { cn, confColor, formatValidity, geoLabel } from '@/lib/utils'
import { useState } from 'react'
import { useAuthStore } from '@/stores/auth'

const SCOPE_OPTIONS = [
  'Scope 1', 'Scope 2',
  ...Array.from({ length: 15 }, (_, i) => `Scope 3 — Category ${i + 1}`),
]
const GWP_VERSIONS = ['AR4', 'AR5', 'AR6', 'GWP20', 'GWP100', 'Not stated']

interface SidePanelProps {
  ef: EmissionFactor
  onClose: () => void
  onUpdated: () => void
}

const GAS_FIELDS = [
  { key: 'ef_co2', label: 'CO₂' },
  { key: 'ef_ch4', label: 'CH₄' },
  { key: 'ef_n2o', label: 'N₂O' },
  { key: 'ef_pfc', label: 'PFC' },
  { key: 'ef_sf6', label: 'SF₆' },
  { key: 'ef_nf3', label: 'NF₃' },
  { key: 'ef_total_co2e', label: 'Total' },
] as const

export default function SidePanel({ ef, onClose, onUpdated }: SidePanelProps) {
  const isAdmin = useAuthStore(s => s.isAdmin())
  const queryClient = useQueryClient()
  const [showVersions, setShowVersions] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [showConflicts, setShowConflicts] = useState(!!ef.has_conflict)
  const [supersedeReason, setSupersedeReason] = useState('')
  const [showSupersedeForm, setShowSupersedeForm] = useState(false)
  const [supersedeLoading, setSupersedeLoading] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editFields, setEditFields] = useState<Record<string, unknown>>({})
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSummaryText, setEditSummaryText] = useState('')
  const [resolveNote, setResolveNote] = useState('')
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [resolveLoading, setResolveLoading] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const openEditForm = () => {
    setEditFields({
      canonical_activity_name: ef.canonical_activity_name,
      source_activity_name: ef.source_activity_name,
      activity_category: ef.activity_category ?? '',
      unit: ef.unit,
      ef_total_co2e: ef.ef_total_co2e,
      ef_co2: ef.ef_co2,
      ef_ch4: ef.ef_ch4,
      ef_n2o: ef.ef_n2o,
      ef_pfc: ef.ef_pfc,
      ef_sf6: ef.ef_sf6,
      ef_nf3: ef.ef_nf3,
      applicable_scopes: ef.applicable_scopes ?? [],
      lca_stages: ef.lca_stages?.join(', ') ?? '',
      gwp_version: ef.gwp_version ?? '',
      geography_global: ef.geography_global,
      geography_country: ef.geography_country ?? '',
      geography_region: ef.geography_region ?? '',
      // Store year as plain number — avoids round-trip slicing bugs
      validity_start_year: ef.validity_start ? parseInt(String(ef.validity_start).slice(0, 4)) : '',
      validity_end_year: ef.validity_end ? parseInt(String(ef.validity_end).slice(0, 4)) : '',
      comments_applicability: ef.comments_applicability ?? '',
      comments_limitations: ef.comments_limitations ?? '',
      additional_notes: ef.additional_notes ?? '',
      custom_tags: ef.custom_tags?.join(', ') ?? '',
      supplier_name: ef.supplier_name ?? '',
      supplier_country: ef.supplier_country ?? [],  // array of ISO codes
      supplier_sector: ef.supplier_sector ?? '',
      supplier_epd_reference: ef.supplier_epd_reference ?? '',
    })
    setEditSummaryText('')
    setEditError('')
    setShowEditForm(true)
  }

  const setField = (patch: Record<string, unknown>) => setEditFields(prev => ({ ...prev, ...patch }))

  const handleSaveEdit = async () => {
    setEditLoading(true)
    setEditError('')
    try {
      // Build clean payload — omit helper year fields, convert arrays/nulls
      const {
        validity_start_year, validity_end_year,
        lca_stages, custom_tags,
        activity_category, geography_country, geography_region,
        gwp_version, comments_applicability, comments_limitations,
        additional_notes, supplier_name, supplier_country,
        supplier_sector, supplier_epd_reference,
        ...rest
      } = editFields

      const payload: Record<string, unknown> = {
        ...rest,
        edit_summary: editSummaryText || undefined,
        // Convert year numbers to ISO date strings
        validity_start: validity_start_year ? `${validity_start_year}-01-01` : null,
        validity_end: validity_end_year ? `${validity_end_year}-12-31` : null,
        // Convert comma-separated strings to arrays
        lca_stages: lca_stages ? String(lca_stages).split(',').map(s => s.trim()).filter(Boolean) : null,
        custom_tags: custom_tags ? String(custom_tags).split(',').map(s => s.trim()).filter(Boolean) : null,
        // Nullify empty strings
        activity_category: activity_category || null,
        geography_country: geography_country || null,
        geography_region: geography_region || null,
        gwp_version: gwp_version || null,
        comments_applicability: comments_applicability || null,
        comments_limitations: comments_limitations || null,
        additional_notes: additional_notes || null,
        supplier_name: supplier_name || null,
        // supplier_country is already an array from the multi-select
        supplier_country: Array.isArray(supplier_country) && (supplier_country as string[]).length > 0 ? supplier_country : null,
        supplier_sector: supplier_sector || null,
        supplier_epd_reference: supplier_epd_reference || null,
      }
      await efApi.update(ef.id, payload)
      setShowEditForm(false)
      onUpdated()
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Save failed — check the values and try again')
    } finally {
      setEditLoading(false)
    }
  }

  type VersionEntry = { version_number: number; edited_at: string; edit_summary: string | null; id: string }
  type AuditEntry = { id: string; action: string; created_at: string; details: Record<string, unknown> | null }

  const { data: versions } = useQuery<VersionEntry[]>({
    queryKey: ['ef-versions', ef.id],
    queryFn: () => efApi.getVersions(ef.id) as Promise<VersionEntry[]>,
    enabled: showVersions,
  })

  const { data: auditLog } = useQuery<AuditEntry[]>({
    queryKey: ['ef-audit', ef.id],
    queryFn: () => efApi.getAuditLog(ef.id) as Promise<AuditEntry[]>,
    enabled: showAudit,
  })

  const { data: conflicts } = useQuery<EmissionFactor[]>({
    queryKey: ['ef-conflicts', ef.id],
    queryFn: () => efApi.getConflicts(ef.id) as Promise<EmissionFactor[]>,
    enabled: showConflicts && ef.has_conflict,
  })

  const handleSupersede = async () => {
    if (!supersedeReason.trim()) return
    setSupersedeLoading(true)
    try {
      await efApi.supersede(ef.id, supersedeReason)
      onUpdated()
      onClose()
    } finally {
      setSupersedeLoading(false)
    }
  }

  const handleResolve = async () => {
    setResolveLoading(true)
    setResolveError('')
    try {
      await efApi.resolveConflict(ef.id, resolveNote)
      // Invalidate conflict count badge and EF list
      queryClient.invalidateQueries({ queryKey: ['conflicts-count'] })
      queryClient.invalidateQueries({ queryKey: ['ef-conflicts', ef.id] })
      onUpdated()
      onClose()
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Failed to resolve conflict')
    } finally {
      setResolveLoading(false)
    }
  }

  const breakdown = ef.confidence_breakdown

  return (
    <div className="w-[380px] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="min-w-0 pr-2">
          <h3 className="text-sm font-semibold leading-tight truncate">{ef.canonical_activity_name}</h3>
          {ef.source_activity_name !== ef.canonical_activity_name && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">Source: {ef.source_activity_name}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (
            <button
              onClick={() => showEditForm ? setShowEditForm(false) : openEditForm()}
              className={cn('flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors', showEditForm ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-muted-foreground')}
            >
              <Pencil className="w-3 h-3" />
              {showEditForm ? 'Cancel edit' : 'Edit'}
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded hover:bg-muted/50 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* ── Inline edit form (admin only) ── */}
          {showEditForm && (
            <div className="space-y-4 pb-2 border-b border-border">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Editing Record</h4>

              {/* Names */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Canonical Activity Name</label>
                  <input className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    value={String(editFields.canonical_activity_name ?? '')}
                    onChange={e => setField({ canonical_activity_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Source Activity Name</label>
                  <input className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    value={String(editFields.source_activity_name ?? '')}
                    onChange={e => setField({ source_activity_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Unit</label>
                    <input className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      value={String(editFields.unit ?? '')}
                      onChange={e => setField({ unit: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Activity Category</label>
                    <input className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      value={String(editFields.activity_category ?? '')}
                      onChange={e => setField({ activity_category: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* EF values */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">EF Values (kg per unit)</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    ['ef_total_co2e', 'Total CO₂e'], ['ef_co2', 'CO₂'], ['ef_ch4', 'CH₄'],
                    ['ef_n2o', 'N₂O'], ['ef_pfc', 'PFC'], ['ef_sf6', 'SF₆'], ['ef_nf3', 'NF₃'],
                  ] as [string, string][]).map(([key, label]) => (
                    <div key={key} className="space-y-0.5">
                      <label className="text-[10px] text-muted-foreground">{label}</label>
                      <input type="number" step="any"
                        className="w-full h-7 px-2 rounded border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        value={editFields[key] != null ? String(editFields[key]) : ''}
                        onChange={e => setField({ [key]: e.target.value !== '' ? Number(e.target.value) : null })} />
                    </div>
                  ))}
                </div>
              </div>

              {/* GWP + Geography + Validity */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">GWP Version</label>
                  <select className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    value={String(editFields.gwp_version ?? '')}
                    onChange={e => setField({ gwp_version: e.target.value || null })}>
                    <option value="">— Select —</option>
                    {GWP_VERSIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Country (ISO 2)</label>
                  <input maxLength={2} className="w-full h-8 px-2 rounded border border-input bg-background text-xs uppercase focus:outline-none focus:ring-2 focus:ring-ring"
                    value={String(editFields.geography_country ?? '')}
                    onChange={e => setField({ geography_country: e.target.value.toUpperCase() || null })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Valid From (year)</label>
                  <input type="number" min="1990" max="2099" placeholder="e.g. 2023"
                    className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    value={(editFields.validity_start_year as number | string) ?? ''}
                    onChange={e => setField({ validity_start_year: e.target.value ? Number(e.target.value) : '' })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Valid To (year)</label>
                  <input type="number" min="1990" max="2099" placeholder="open-ended"
                    className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    value={(editFields.validity_end_year as number | string) ?? ''}
                    onChange={e => setField({ validity_end_year: e.target.value ? Number(e.target.value) : '' })} />
                </div>
              </div>

              {/* Scope */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">GHG Scope(s)</label>
                <div className="flex flex-wrap gap-1">
                  {SCOPE_OPTIONS.map(scope => {
                    const current = (editFields.applicable_scopes as string[]) ?? []
                    const active = current.includes(scope)
                    return (
                      <button key={scope} type="button"
                        onClick={() => setField({ applicable_scopes: active ? current.filter(s => s !== scope) : [...current, scope] })}
                        className={cn('text-[10px] px-1.5 py-0.5 rounded-full border transition-colors', active ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted/50')}>
                        {scope.replace('Scope 3 — Category ', 'S3-C')}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* LCA stages + tags */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">LCA Stages (comma-sep)</label>
                  <input className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    value={String(editFields.lca_stages ?? '')}
                    onChange={e => setField({ lca_stages: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Custom Tags (comma-sep)</label>
                  <input className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    value={String(editFields.custom_tags ?? '')}
                    onChange={e => setField({ custom_tags: e.target.value })} />
                </div>
              </div>

              {/* Comments */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Comments — Applicability</label>
                  <textarea rows={2} className="w-full px-2 py-1.5 rounded border border-input bg-background text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    value={String(editFields.comments_applicability ?? '')}
                    onChange={e => setField({ comments_applicability: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Comments — Limitations</label>
                  <textarea rows={2} className="w-full px-2 py-1.5 rounded border border-input bg-background text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    value={String(editFields.comments_limitations ?? '')}
                    onChange={e => setField({ comments_limitations: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Additional Notes</label>
                  <textarea rows={2} className="w-full px-2 py-1.5 rounded border border-input bg-background text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    value={String(editFields.additional_notes ?? '')}
                    onChange={e => setField({ additional_notes: e.target.value })} />
                </div>
              </div>

              {/* Supplier */}
              <div className="grid grid-cols-2 gap-2">
                {([['supplier_name','Supplier Name'],['supplier_sector','Sector'],['supplier_epd_reference','EPD Ref']] as [string,string][]).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
                    <input className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                      value={String(editFields[key] ?? '')}
                      onChange={e => setField({ [key]: e.target.value })} />
                  </div>
                ))}
                {/* Supplier Country — multi-select tag input */}
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Supplier Countries (ISO codes)</label>
                  <div className="flex flex-wrap gap-1 min-h-[32px] px-2 py-1 rounded border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                    {(editFields.supplier_country as string[] ?? []).map((code: string) => (
                      <span key={code} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                        {code}
                        <button type="button" onClick={() => setField({ supplier_country: (editFields.supplier_country as string[]).filter(c => c !== code) })}
                          className="ml-0.5 hover:text-destructive">×</button>
                      </span>
                    ))}
                    <input
                      className="flex-1 min-w-[60px] text-xs outline-none bg-transparent"
                      placeholder="Type ISO code + Enter (e.g. DE)"
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          const v = (e.target as HTMLInputElement).value.trim().toUpperCase().slice(0, 2)
                          if (v && !(editFields.supplier_country as string[] ?? []).includes(v)) {
                            setField({ supplier_country: [...(editFields.supplier_country as string[] ?? []), v] })
                          }
                          ;(e.target as HTMLInputElement).value = ''
                        }
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Type a 2-letter ISO country code and press Enter or comma</p>
                </div>
              </div>

              {/* Edit summary + save */}
              <div className="space-y-2 pt-1 border-t border-border">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Edit Summary (optional)</label>
                  <input className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Corrected CH₄ value from DEFRA 2023 errata"
                    value={editSummaryText}
                    onChange={e => setEditSummaryText(e.target.value)} />
                </div>
                {editError && (
                  <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
                    ⚠ {editError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} disabled={editLoading}
                    className="h-8 px-4 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                    {editLoading ? 'Saving…' : 'Save changes'}
                  </button>
                  <button onClick={() => setShowEditForm(false)}
                    className="h-8 px-3 rounded border border-input text-xs hover:bg-muted/50">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Status badges */}
          <div className="flex flex-wrap gap-1.5">
            {ef.is_superseded && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-medium">Superseded</span>
            )}
            {ef.has_conflict && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-medium">
                <AlertTriangle className="w-3 h-3" />
                Conflict
              </span>
            )}
            {ef.migrated && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Migrated</span>
            )}
            <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">v{ef.version_number}</span>
          </div>

          {/* GHG Components */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">GHG Components</h4>
            <div className="grid grid-cols-4 gap-px bg-border rounded-md overflow-hidden text-center">
              {GAS_FIELDS.map(({ key, label }) => {
                const val = ef[key as keyof EmissionFactor] as number | null
                const isTotal = key === 'ef_total_co2e'
                return (
                  <div key={key} className={cn('bg-card px-1 py-2', isTotal && 'col-span-4 bg-muted/30')}>
                    {isTotal ? (
                      <>
                        <div className="text-[10px] text-muted-foreground">
                          Total CO₂e <span className="font-medium text-foreground/70">· kg per {ef.unit}</span>
                        </div>
                        <div className="text-sm font-semibold font-mono tabular-nums mt-0.5">
                          {val != null ? val.toFixed(4) : '—'}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[10px] text-muted-foreground">{label}</div>
                        <div className="text-xs font-mono tabular-nums mt-0.5">
                          {val != null ? val.toFixed(4) : '—'}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Confidence score */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Confidence Score
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', (ef.confidence_score ?? 0) >= 75 ? 'bg-emerald-500' : (ef.confidence_score ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${ef.confidence_score ?? 0}%` }}
                  />
                </div>
                <span className={cn('text-sm font-mono font-semibold w-10 text-right', confColor(ef.confidence_score))}>
                  {ef.confidence_score ?? '—'}%
                </span>
              </div>
              {breakdown && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground pl-0.5">
                  <span>Source type: <b className="text-foreground">{breakdown.source_type}</b></span>
                  <span>Audited: <b className="text-foreground">{breakdown.audited}</b></span>
                  <span>Geography: <b className="text-foreground">{breakdown.geography}</b></span>
                  <span>Recency: <b className="text-foreground">{breakdown.recency}</b></span>
                </div>
              )}
            </div>
          </section>

          {/* Classification */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Classification</h4>
            <dl className="space-y-1.5 text-sm">
              <Row label="Scope(s)">{ef.applicable_scopes?.join(', ') ?? '—'}</Row>
              <Row label="LCA Stage">{ef.lca_stages?.join(', ') ?? '—'}</Row>
              <Row label="Category">{ef.activity_category ?? '—'}</Row>
              <Row label="GWP Version">{ef.gwp_version ?? '—'}</Row>
            </dl>
          </section>

          {/* Geography & Validity */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Geography & Validity</h4>
            <dl className="space-y-1.5 text-sm">
              <Row label="Geography">
                {geoLabel(ef.geography_global, ef.geography_country, ef.geography_region)}
              </Row>
              <Row label="Valid From">
                {ef.validity_start ? new Date(ef.validity_start).getFullYear().toString() : '—'}
              </Row>
              <Row label="Valid To">
                {ef.validity_end ? new Date(ef.validity_end).getFullYear().toString() : '∞ (open-ended)'}
              </Row>
            </dl>
          </section>

          {/* Source */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Source</h4>
            <dl className="space-y-1.5 text-sm">
              <Row label="Name">{ef.source_name ?? '—'}</Row>
              <Row label="Type">{ef.source_type ?? '—'}</Row>
              {ef.source_url && (
                <Row label="URL">
                  <a href={ef.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline text-xs">
                    Open source <ExternalLink className="w-3 h-3" />
                  </a>
                </Row>
              )}
            </dl>
          </section>

          {/* Supplier / Company */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Supplier / Company</h4>
            <dl className="space-y-1.5 text-sm">
              <Row label="Name">{ef.supplier_name ?? '—'}</Row>
              <Row label="Countries">
                {ef.supplier_country && ef.supplier_country.length > 0
                  ? ef.supplier_country.map(c => (
                      <span key={c} className="inline-block px-1.5 py-0.5 rounded bg-muted text-xs font-medium mr-1">{c}</span>
                    ))
                  : '—'}
              </Row>
              <Row label="Sector">{ef.supplier_sector ?? '—'}</Row>
              <Row label="EPD Ref">{ef.supplier_epd_reference ?? '—'}</Row>
            </dl>
          </section>

          {/* Comments & Notes */}
          <section className="space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Comments — Applicability</h4>
              <p className="text-xs text-foreground leading-relaxed">{ef.comments_applicability ?? '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Comments — Limitations</h4>
              <p className="text-xs text-foreground leading-relaxed">{ef.comments_limitations ?? '—'}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Additional Notes</h4>
              <p className="text-xs text-foreground leading-relaxed">{ef.additional_notes ?? '—'}</p>
            </div>
          </section>

          {/* Tags */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Custom Tags</h4>
            {ef.custom_tags && ef.custom_tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {ef.custom_tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">{tag}</span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">—</p>
            )}
          </section>

          {/* Conflicting records */}
          {ef.has_conflict && (
            <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
              <button
                onClick={() => setShowConflicts(v => !v)}
                className="flex items-center justify-between w-full text-xs font-semibold text-amber-700 uppercase tracking-wider"
              >
                <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Conflicting Records</span>
                {showConflicts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showConflicts && conflicts && conflicts.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {conflicts.map(c => (
                    <div key={c.id} className="rounded border border-amber-200 bg-white p-2 text-xs space-y-0.5">
                      <p className="font-medium text-foreground">{c.canonical_activity_name}</p>
                      <p className="text-muted-foreground">
                        {c.source_name ?? '—'} · {c.unit} · EF {c.ef_total_co2e ?? '?'} · Conf {c.confidence_score ?? '?'}%
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {showConflicts && conflicts?.length === 0 && (
                <p className="text-xs text-amber-700/70 pt-1">No active conflicts found — this flag may be stale.</p>
              )}

              {/* Resolve action — admin only */}
              {isAdmin && (
                <div className="pt-1 border-t border-amber-200">
                  {!showResolveForm ? (
                    <button
                      onClick={() => setShowResolveForm(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark as Resolved
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-amber-700">Resolution note (optional):</p>
                      <textarea
                        value={resolveNote}
                        onChange={e => setResolveNote(e.target.value)}
                        placeholder="e.g. Different activity scope — not a true conflict"
                        className="w-full rounded border border-amber-300 bg-white px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
                        rows={2}
                      />
                      {resolveError && <p className="text-xs text-red-600">{resolveError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={handleResolve}
                          disabled={resolveLoading}
                          className="flex-1 h-7 rounded text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
                        >
                          {resolveLoading ? 'Saving…' : 'Confirm Resolved'}
                        </button>
                        <button
                          onClick={() => { setShowResolveForm(false); setResolveNote(''); setResolveError('') }}
                          className="px-3 h-7 rounded text-xs border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Version history */}
          <section>
            <button
              onClick={() => setShowVersions(v => !v)}
              className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
            >
              <span>Version History</span>
              {showVersions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showVersions && versions && (
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.id} className="flex items-start justify-between text-xs border-b border-border pb-2">
                    <div>
                      <span className="font-medium">v{v.version_number}</span>
                      <span className="text-muted-foreground ml-1.5">{new Date(v.edited_at).toLocaleDateString()}</span>
                      {v.edit_summary && <p className="text-muted-foreground mt-0.5">{v.edit_summary}</p>}
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => efApi.restoreVersion(ef.id, v.version_number).then(onUpdated)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-input hover:bg-muted/50"
                        title="Restore this version"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        Restore
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Audit log */}
          <section>
            <button
              onClick={() => setShowAudit(v => !v)}
              className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
            >
              <span>Audit Log</span>
              {showAudit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showAudit && auditLog && (
              <div className="space-y-1.5">
                {auditLog.map(entry => (
                  <div key={entry.id} className="text-xs flex items-start gap-2">
                    <span className="text-muted-foreground shrink-0">{new Date(entry.created_at).toLocaleDateString()}</span>
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">{entry.action.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Admin actions */}
          {isAdmin && !ef.is_superseded && (
            <section className="border-t border-border pt-4">
              {!showSupersedeForm ? (
                <button
                  onClick={() => setShowSupersedeForm(true)}
                  className="text-xs text-destructive hover:underline"
                >
                  Mark as superseded…
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium">Reason for superseding:</p>
                  <textarea
                    className="w-full h-16 text-xs rounded-md border border-input bg-background px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Replaced by updated DEFRA 2025 factor"
                    value={supersedeReason}
                    onChange={e => setSupersedeReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSupersede}
                      disabled={supersedeLoading || !supersedeReason.trim()}
                      className="h-7 px-3 rounded text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {supersedeLoading ? 'Saving…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => { setShowSupersedeForm(false); setSupersedeReason('') }}
                      className="h-7 px-3 rounded text-xs border border-input hover:bg-muted/50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-xs text-muted-foreground w-24 shrink-0 pt-px">{label}</dt>
      <dd className="text-xs flex-1 min-w-0 break-words">{children}</dd>
    </div>
  )
}
