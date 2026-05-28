import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, RotateCcw, Pencil, CheckCircle2 } from 'lucide-react'
import type { EmissionFactor } from '@/types/emission-factor'
import { efApi } from '@/lib/api'
import { cn, dqColor, formatValidity, geoLabel } from '@/lib/utils'
import { useState } from 'react'
import { useAuthStore } from '@/stores/auth'

const SECTIONS: { title: string; fields: { key: keyof EmissionFactor; label: string; format?: (v: unknown, r: EmissionFactor) => React.ReactNode }[] }[] = [
  {
    title: 'Identity',
    fields: [
      { key: 'ef_id', label: 'EF ID' },
      { key: 'activity_name', label: 'Activity name' },
      { key: 'activity_description', label: 'Description' },
      { key: 'activity_code', label: 'Activity code' },
      { key: 'emission_category', label: 'Emission category' },
      { key: 'sub_category', label: 'Sub-category' },
      { key: 'ghg_scope', label: 'GHG scope', format: v => v ? `Scope ${v}` : '—' },
      { key: 'scope3_category', label: 'Scope 3 category' },
      { key: 'activity_level', label: 'Activity level' },
    ],
  },
  {
    title: 'EF value',
    fields: [
      { key: 'ef_value', label: 'EF value', format: v => <span className="font-mono">{Number(v).toFixed(6)}</span> },
      { key: 'ghg_species', label: 'GHG species' },
      { key: 'expressed_as_co2e', label: 'Expressed as CO₂e', format: v => v ? 'yes' : 'no' },
      { key: 'gwp_basis', label: 'GWP basis' },
      { key: 'gwp_value_used', label: 'GWP value used' },
      { key: 'ef_type', label: 'EF type' },
    ],
  },
  {
    title: 'Units',
    fields: [
      { key: 'numerator_unit', label: 'Numerator' },
      { key: 'denominator_unit', label: 'Denominator' },
      { key: 'denominator_basis', label: 'Denominator basis' },
      { key: 'unit_notes', label: 'Unit notes' },
    ],
  },
  {
    title: 'Geography',
    fields: [
      { key: 'geography_type', label: 'Type' },
      { key: 'country_iso', label: 'Country (ISO3)' },
      { key: 'region_name', label: 'Region' },
      { key: 'grid_zone_id', label: 'Grid zone' },
      { key: 'location_basis', label: 'Location basis' },
    ],
  },
  {
    title: 'Technology',
    fields: [
      { key: 'fuel_material_type', label: 'Fuel / material' },
      { key: 'technology_descriptor', label: 'Technology' },
      { key: 'vehicle_type', label: 'Vehicle type' },
      { key: 'end_use_sector', label: 'End-use sector' },
      { key: 'combustion_type', label: 'Combustion type' },
      { key: 'carbon_content_fraction', label: 'Carbon content fraction' },
    ],
  },
  {
    title: 'Temporal',
    fields: [
      { key: 'reference_year', label: 'Reference year' },
      { key: 'valid_from', label: 'Valid from' },
      { key: 'valid_to', label: 'Valid to' },
      { key: 'ef_version', label: 'EF version' },
      { key: 'update_frequency', label: 'Update frequency' },
    ],
  },
  {
    title: 'Source',
    fields: [
      { key: 'source_organization', label: 'Organization' },
      { key: 'source_database', label: 'Database' },
      { key: 'publication_title', label: 'Publication' },
      { key: 'publication_year', label: 'Publication year' },
      { key: 'source_url', label: 'URL', format: v => v ? <a href={String(v)} target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-0.5">link <ExternalLink className="w-3 h-3" /></a> : '—' },
      { key: 'original_ef_value', label: 'Original value' },
      { key: 'original_unit', label: 'Original unit' },
      { key: 'data_origin', label: 'Data origin' },
    ],
  },
  {
    title: 'Methodology',
    fields: [
      { key: 'calculation_method', label: 'Calc method' },
      { key: 'system_boundary', label: 'System boundary' },
      { key: 'includes_biogenic_co2', label: 'Includes biogenic CO₂', format: v => v == null ? '—' : v ? 'yes' : 'no' },
      { key: 'includes_land_use_change', label: 'Includes LUC', format: v => v == null ? '—' : v ? 'yes' : 'no' },
      { key: 'allocation_method', label: 'Allocation' },
      { key: 'upstream_included', label: 'Upstream included', format: v => v == null ? '—' : v ? 'yes' : 'no' },
    ],
  },
  {
    title: 'Data quality',
    fields: [
      { key: 'uncertainty_pct', label: 'Uncertainty %' },
      { key: 'uncertainty_method', label: 'Uncertainty method' },
      { key: 'dq_score_overall', label: 'DQ overall (1=best)' },
      { key: 'dq_geographic_rep', label: 'DQ geographic' },
      { key: 'dq_temporal_rep', label: 'DQ temporal' },
      { key: 'dq_tech_rep', label: 'DQ tech' },
      { key: 'third_party_verified', label: 'Third-party verified', format: v => v == null ? '—' : v ? 'yes' : 'no' },
    ],
  },
  {
    title: 'Operational',
    fields: [
      { key: 'status', label: 'Status' },
      { key: 'superseded_by_ef_id', label: 'Superseded by' },
      { key: 'superseded_reason', label: 'Superseded reason' },
      { key: 'framework_tags', label: 'Framework tags', format: v => Array.isArray(v) && v.length ? v.join(', ') : '—' },
      { key: 'sector_tags', label: 'Sector tags', format: v => Array.isArray(v) && v.length ? v.join(', ') : '—' },
      { key: 'is_default_ef', label: 'Default EF', format: v => v == null ? '—' : v ? 'yes' : 'no' },
      { key: 'notes', label: 'Notes' },
    ],
  },
]

interface SidePanelProps {
  ef: EmissionFactor
  onClose: () => void
  onUpdated: () => void
}

function renderValue(v: unknown): React.ReactNode {
  if (v == null || v === '') return <span className="text-muted-foreground">—</span>
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (Array.isArray(v)) return v.length ? v.join(', ') : <span className="text-muted-foreground">—</span>
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export default function SidePanel({ ef, onClose, onUpdated }: SidePanelProps) {
  const isAdmin = useAuthStore(s => s.isAdmin())
  const queryClient = useQueryClient()
  const [showVersions, setShowVersions] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [showConflicts, setShowConflicts] = useState(!!ef.has_conflict)
  const [supersedeReason, setSupersedeReason] = useState('')
  const [supersedeBy, setSupersedeBy] = useState('')
  const [showSupersedeForm, setShowSupersedeForm] = useState(false)
  const [supersedeLoading, setSupersedeLoading] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editFields, setEditFields] = useState<Partial<EmissionFactor>>({})
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [editSummaryText, setEditSummaryText] = useState('')
  const [resolveNote, setResolveNote] = useState('')
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [resolveLoading, setResolveLoading] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const openEditForm = () => {
    setEditFields({ ...ef })
    setEditSummaryText('')
    setEditError('')
    setShowEditForm(true)
  }

  const handleSaveEdit = async () => {
    setEditLoading(true)
    setEditError('')
    try {
      // Build a payload with only changed primitive fields. Dates / JSON arrays
      // get passed through as-is; user is responsible for entering valid values.
      const payload: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(editFields)) {
        if (v !== (ef as unknown as Record<string, unknown>)[k]) payload[k] = v
      }
      if (editSummaryText) payload.edit_summary = editSummaryText
      await efApi.update(ef.id, payload)
      setShowEditForm(false)
      onUpdated()
      queryClient.invalidateQueries({ queryKey: ['ef'] })
    } catch (e: unknown) {
      const err = e as Error
      setEditError(err.message ?? 'Update failed')
    } finally {
      setEditLoading(false)
    }
  }

  const handleSupersede = async () => {
    if (!supersedeReason.trim()) return
    setSupersedeLoading(true)
    try {
      // The supersede endpoint accepts {reason, superseded_by_ef_id?}; we
      // pass an empty by-id when the form is left blank.
      await fetch(`/api/emission-factors/${ef.id}/supersede`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('efdb_token')}`,
        },
        body: JSON.stringify({ reason: supersedeReason, superseded_by_ef_id: supersedeBy || null }),
      })
      setShowSupersedeForm(false)
      setSupersedeReason('')
      setSupersedeBy('')
      onUpdated()
    } finally {
      setSupersedeLoading(false)
    }
  }

  const handleResolveConflict = async () => {
    setResolveLoading(true)
    setResolveError('')
    try {
      await efApi.resolveConflict(ef.id, resolveNote)
      setShowResolveForm(false)
      setResolveNote('')
      onUpdated()
    } catch (e: unknown) {
      const err = e as Error
      setResolveError(err.message ?? 'Resolve failed')
    } finally {
      setResolveLoading(false)
    }
  }

  const versionsQ = useQuery({
    queryKey: ['ef-versions', ef.id],
    queryFn: () => efApi.getVersions(ef.id),
    enabled: showVersions,
  })

  const auditQ = useQuery({
    queryKey: ['ef-audit', ef.id],
    queryFn: () => efApi.getAuditLog(ef.id),
    enabled: showAudit,
  })

  const conflictsQ = useQuery({
    queryKey: ['ef-conflicts', ef.id],
    queryFn: () => efApi.getConflicts(ef.id),
    enabled: showConflicts && ef.has_conflict,
  })

  return (
    <aside className="h-full w-[480px] border-l border-border bg-card flex flex-col">
      <header className="p-4 border-b border-border flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{ef.activity_name}</h2>
          <div className="text-xs text-muted-foreground mt-0.5">
            <span className="font-mono">{ef.ef_value.toFixed(6)}</span>
            {' '}
            <span>{ef.ghg_species}</span>
            {' · '}
            <span>{ef.numerator_unit} / {ef.denominator_unit}</span>
            {' · '}
            <span>{geoLabel(ef.geography_type, ef.country_iso, ef.region_name)}</span>
            {' · '}
            <span>{ef.reference_year}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs">
            <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-medium',
              ef.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>{ef.status}</span>
            {ef.dq_score_overall != null && (
              <span className={cn('text-xs font-mono', dqColor(ef.dq_score_overall))}>DQ {ef.dq_score_overall}</span>
            )}
            <span className="text-muted-foreground">v{ef.version_number}</span>
            <span className="text-muted-foreground">{formatValidity(ef.valid_from, ef.valid_to)}</span>
          </div>
          {ef.has_conflict && (
            <p className="text-amber-700 text-xs mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Conflict flagged</p>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
        {SECTIONS.map(section => (
          <div key={section.title}>
            <h3 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">{section.title}</h3>
            <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-xs">
              {section.fields.map(f => {
                const v = (ef as unknown as Record<string, unknown>)[f.key as string]
                return (
                  <div key={f.key as string} className="contents">
                    <dt className="text-muted-foreground py-0.5">{f.label}</dt>
                    <dd className="py-0.5 break-words">{f.format ? f.format(v, ef) : renderValue(v)}</dd>
                  </div>
                )
              })}
            </dl>
          </div>
        ))}
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="border-t border-border p-3 space-y-2 text-xs">
          {!showEditForm && !showSupersedeForm && !showResolveForm && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={openEditForm} className="flex items-center gap-1 h-7 px-2 rounded border border-input hover:bg-muted/50">
                <Pencil className="w-3 h-3" /> Edit
              </button>
              {ef.status === 'active' && (
                <button onClick={() => setShowSupersedeForm(true)} className="flex items-center gap-1 h-7 px-2 rounded border border-input hover:bg-muted/50">
                  <RotateCcw className="w-3 h-3" /> Supersede
                </button>
              )}
              {ef.has_conflict && (
                <button onClick={() => setShowResolveForm(true)} className="flex items-center gap-1 h-7 px-2 rounded border border-input hover:bg-muted/50">
                  <CheckCircle2 className="w-3 h-3" /> Resolve conflict
                </button>
              )}
            </div>
          )}

          {showEditForm && (
            <div className="space-y-2">
              <h4 className="font-semibold text-xs">Edit record</h4>
              <div className="max-h-[260px] overflow-auto space-y-1 pr-1">
                {SECTIONS.flatMap(s => s.fields).map(f => {
                  const key = f.key as keyof EmissionFactor
                  const cur = editFields[key] as unknown
                  if (Array.isArray((ef as unknown as Record<string, unknown>)[key as string]) || typeof (ef as unknown as Record<string, unknown>)[key as string] === 'object') {
                    return (
                      <label key={String(key)} className="block">
                        <span className="text-[10px] text-muted-foreground">{f.label}</span>
                        <input
                          className="w-full h-7 px-2 rounded border border-input bg-background text-xs"
                          value={cur != null ? JSON.stringify(cur) : ''}
                          onChange={e => {
                            try { setEditFields(p => ({ ...p, [key]: JSON.parse(e.target.value) })) }
                            catch { /* keep typing */ }
                          }}
                          placeholder='["tag1","tag2"]'
                        />
                      </label>
                    )
                  }
                  return (
                    <label key={String(key)} className="block">
                      <span className="text-[10px] text-muted-foreground">{f.label}</span>
                      <input
                        className="w-full h-7 px-2 rounded border border-input bg-background text-xs"
                        value={cur == null ? '' : String(cur)}
                        onChange={e => setEditFields(p => ({ ...p, [key]: e.target.value }))}
                      />
                    </label>
                  )
                })}
              </div>
              <input
                className="w-full h-7 px-2 rounded border border-input bg-background text-xs"
                placeholder="Edit summary (shown in version history)"
                value={editSummaryText}
                onChange={e => setEditSummaryText(e.target.value)}
              />
              {editError && <p className="text-destructive text-xs">{editError}</p>}
              <div className="flex justify-end gap-1.5">
                <button onClick={() => setShowEditForm(false)} className="h-7 px-2 rounded border border-input hover:bg-muted/50">Cancel</button>
                <button disabled={editLoading} onClick={handleSaveEdit} className="h-7 px-3 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {editLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {showSupersedeForm && (
            <div className="space-y-2">
              <h4 className="font-semibold text-xs">Supersede record</h4>
              <textarea
                rows={3}
                className="w-full px-2 py-1 rounded border border-input bg-background text-xs"
                placeholder="Reason for supersede…"
                value={supersedeReason}
                onChange={e => setSupersedeReason(e.target.value)}
              />
              <input
                className="w-full h-7 px-2 rounded border border-input bg-background text-xs"
                placeholder="ef_id of replacement (optional)"
                value={supersedeBy}
                onChange={e => setSupersedeBy(e.target.value)}
              />
              <div className="flex justify-end gap-1.5">
                <button onClick={() => setShowSupersedeForm(false)} className="h-7 px-2 rounded border border-input hover:bg-muted/50">Cancel</button>
                <button disabled={supersedeLoading || !supersedeReason.trim()} onClick={handleSupersede} className="h-7 px-3 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {supersedeLoading ? 'Saving…' : 'Supersede'}
                </button>
              </div>
            </div>
          )}

          {showResolveForm && (
            <div className="space-y-2">
              <h4 className="font-semibold text-xs">Resolve conflict</h4>
              <textarea
                rows={2}
                className="w-full px-2 py-1 rounded border border-input bg-background text-xs"
                placeholder="Resolution note (optional)…"
                value={resolveNote}
                onChange={e => setResolveNote(e.target.value)}
              />
              {resolveError && <p className="text-destructive text-xs">{resolveError}</p>}
              <div className="flex justify-end gap-1.5">
                <button onClick={() => setShowResolveForm(false)} className="h-7 px-2 rounded border border-input hover:bg-muted/50">Cancel</button>
                <button disabled={resolveLoading} onClick={handleResolveConflict} className="h-7 px-3 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {resolveLoading ? 'Resolving…' : 'Resolve'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Versions / audit / conflicts toggles */}
      <div className="border-t border-border px-4 py-2 space-y-1 text-xs">
        <button onClick={() => setShowVersions(v => !v)} className="w-full flex items-center justify-between hover:text-foreground text-muted-foreground">
          <span>Version history</span>
          {showVersions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showVersions && versionsQ.data && (
          <div className="space-y-1 pl-2 max-h-32 overflow-auto">
            {(versionsQ.data as Array<{ version_number: number; edited_at: string; edit_summary: string | null }>).map(v => (
              <div key={v.version_number} className="text-muted-foreground">v{v.version_number} · {new Date(v.edited_at).toLocaleString()} {v.edit_summary && `· ${v.edit_summary}`}</div>
            ))}
          </div>
        )}

        <button onClick={() => setShowAudit(v => !v)} className="w-full flex items-center justify-between hover:text-foreground text-muted-foreground">
          <span>Audit log</span>
          {showAudit ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {showAudit && auditQ.data && (
          <div className="space-y-1 pl-2 max-h-32 overflow-auto">
            {(auditQ.data as Array<{ action: string; created_at: string }>).map((a, i) => (
              <div key={i} className="text-muted-foreground">{a.action} · {new Date(a.created_at).toLocaleString()}</div>
            ))}
          </div>
        )}

        {ef.has_conflict && (
          <>
            <button onClick={() => setShowConflicts(v => !v)} className="w-full flex items-center justify-between hover:text-foreground text-amber-700">
              <span>Conflicting records</span>
              {showConflicts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showConflicts && conflictsQ.data && (
              <div className="space-y-1 pl-2 max-h-32 overflow-auto">
                {(conflictsQ.data as Array<{ id: string; activity_name: string; ef_value: number; ghg_species: string; source_organization: string }>).map(c => (
                  <div key={c.id} className="text-muted-foreground">
                    {c.activity_name} — <span className="font-mono">{c.ef_value}</span> {c.ghg_species} ({c.source_organization})
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
