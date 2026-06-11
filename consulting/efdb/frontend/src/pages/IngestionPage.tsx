import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Link, FileText, CheckCircle, AlertTriangle, Loader2, HelpCircle, Leaf } from 'lucide-react'
import { ingestionApi } from '@/lib/api'
import type { ScanResult, DocumentSection, SessionStatus as SessionStatusType, ReviewSummary, DocumentMetadata, DocumentType } from '@/types/emission-factor'
import { cn } from '@/lib/utils'

type Step = 'upload' | 'confirm-metadata' | 'selecting' | 'extracting' | 'review' | 'done'

function emptyMetadata(): DocumentMetadata {
  return {
    source_organization: null,
    source_database: null,
    publication_title: null,
    publication_year: null,
    reference_year: null,
    valid_from: null,
    valid_to: null,
    country_iso: null,
    geography_type: null,
    geography_description: null,
    gwp_basis: null,
    ghg_scope: null,
    system_boundary: null,
    data_origin: null,
    calculation_method: null,
    notes: null,
    guidance_notes: null,
    clarifying_questions: null,
    manufacturer: null,
    epd_registration_number: null,
    programme_operator: null,
    pcr_reference: null,
    declared_unit: null,
  }
}

interface MetadataFormProps {
  metadata: DocumentMetadata
  clarifyingAnswers: Record<number, string>
  isEpd?: boolean
  onChange: (m: DocumentMetadata) => void
  onAnswerChange: (index: number, value: string) => void
}

function MetadataForm({ metadata: m, clarifyingAnswers, isEpd, onChange, onAnswerChange }: MetadataFormProps) {
  const set = (patch: Partial<DocumentMetadata>) => onChange({ ...m, ...patch })

  return (
    <div className="space-y-5">
      {isEpd && (
        <div className="space-y-4 p-4 rounded-lg bg-emerald-50/50 border border-emerald-200">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium text-emerald-800">EPD details</span>
            <span className="text-xs text-emerald-700">Auto-detected from the declaration — verify against the EPD cover page.</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Manufacturer (declared by)</label>
              <input
                type="text"
                value={m.manufacturer ?? ''}
                onChange={e => set({ manufacturer: e.target.value || null })}
                placeholder="e.g. Holcim Deutschland GmbH"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">EPD registration number</label>
              <input
                type="text"
                value={m.epd_registration_number ?? ''}
                onChange={e => set({ epd_registration_number: e.target.value || null })}
                placeholder="e.g. S-P-01234"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Programme operator</label>
              <input
                type="text"
                value={m.programme_operator ?? ''}
                onChange={e => set({ programme_operator: e.target.value || null })}
                placeholder="e.g. The International EPD System"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PCR reference</label>
              <input
                type="text"
                value={m.pcr_reference ?? ''}
                onChange={e => set({ pcr_reference: e.target.value || null })}
                placeholder="e.g. PCR 2019:14 v1.11"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Declared unit</label>
              <input
                type="text"
                value={m.declared_unit ?? ''}
                onChange={e => set({ declared_unit: e.target.value || null })}
                placeholder="e.g. 1 m³ of concrete C30/37"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source organization</label>
          <input
            type="text"
            value={m.source_organization ?? ''}
            onChange={e => set({ source_organization: e.target.value || null })}
            placeholder="e.g. BEIS / DESNZ"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source database (optional)</label>
          <input
            type="text"
            value={m.source_database ?? ''}
            onChange={e => set({ source_database: e.target.value || null })}
            placeholder="e.g. UK GHG Conversion Factors 2023"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Publication year</label>
          <input
            type="number" min="1990" max="2099"
            value={m.publication_year ?? ''}
            onChange={e => set({ publication_year: e.target.value ? Number(e.target.value) : null })}
            placeholder="2023"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reference year (data)</label>
          <input
            type="number" min="1990" max="2099"
            value={m.reference_year ?? ''}
            onChange={e => set({ reference_year: e.target.value ? Number(e.target.value) : null })}
            placeholder="2023"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Country (ISO-3)</label>
          <input
            type="text" maxLength={3}
            value={m.country_iso ?? ''}
            onChange={e => set({ country_iso: e.target.value.toUpperCase() || null })}
            placeholder="GBR"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valid from (YYYY-MM-DD)</label>
          <input
            type="text"
            value={m.valid_from ?? ''}
            onChange={e => set({ valid_from: e.target.value || null })}
            placeholder="2023-01-01"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valid to (YYYY-MM-DD)</label>
          <input
            type="text"
            value={m.valid_to ?? ''}
            onChange={e => set({ valid_to: e.target.value || null })}
            placeholder="open-ended"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">GWP basis</label>
          <select
            value={m.gwp_basis ?? ''}
            onChange={e => set({ gwp_basis: e.target.value || null })}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">—</option>
            {['AR4', 'AR5', 'AR6', 'GWP20', 'GWP100', 'Not stated'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">GHG scope</label>
          <select
            value={m.ghg_scope ?? ''}
            onChange={e => set({ ghg_scope: e.target.value || null })}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">—</option>
            {['1', '2', '3'].map(v => <option key={v} value={v}>Scope {v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Geography type</label>
          <select
            value={m.geography_type ?? ''}
            onChange={e => set({ geography_type: e.target.value || null })}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">—</option>
            {['global', 'national', 'regional', 'sub-national', 'grid-zone'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">System boundary</label>
          <select
            value={m.system_boundary ?? ''}
            onChange={e => set({ system_boundary: e.target.value || null })}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">—</option>
            {['gate-to-gate', 'cradle-to-gate', 'cradle-to-grave', 'well-to-tank', 'tank-to-wheel', 'well-to-wheel', 'use-phase'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calculation method</label>
          <select
            value={m.calculation_method ?? ''}
            onChange={e => set({ calculation_method: e.target.value || null })}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">—</option>
            {['fuel-based', 'activity-based', 'spend-based', 'mass-balance', 'supplier-specific', 'average-data'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data origin</label>
          <select
            value={m.data_origin ?? ''}
            onChange={e => set({ data_origin: e.target.value || null })}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">—</option>
            {['primary', 'secondary'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes (applied to every record)</label>
        <p className="text-[11px] text-muted-foreground">Key usage guidance / caveats — e.g. "UK use only", "Gross CV basis", "Excludes biogenic CO₂".</p>
        <textarea
          value={m.notes ?? ''}
          onChange={e => set({ notes: e.target.value || null })}
          placeholder="Auto-filled from cover page / notes sheet…"
          rows={2}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guidance notes</label>
        <textarea
          value={m.guidance_notes ?? ''}
          onChange={e => set({ guidance_notes: e.target.value || null })}
          rows={3}
          placeholder="e.g. Factors based on gross calorific values. Excludes biogenic CO2."
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {m.clarifying_questions && m.clarifying_questions.length > 0 && (
        <div className="space-y-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-sm font-medium text-blue-800">Claude has clarifying questions about this document</span>
          </div>
          <p className="text-xs text-blue-700">Your answers will be included as context for every extracted record.</p>
          {m.clarifying_questions.map((q, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs font-medium text-blue-800">{q}</p>
              <textarea
                value={clarifyingAnswers[i] ?? ''}
                onChange={e => onAnswerChange(i, e.target.value)}
                rows={2}
                placeholder="Your answer…"
                className="w-full px-3 py-1.5 rounded-md border border-blue-300 bg-white text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


export default function IngestionPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('upload')
  const [mode, setMode] = useState<'file' | 'url'>('file')
  const [docType, setDocType] = useState<DocumentType>('generic')
  const [url, setUrl] = useState('')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [confirmedMetadata, setConfirmedMetadata] = useState<DocumentMetadata>(emptyMetadata())
  const [clarifyingAnswers, setClarifyingAnswers] = useState<Record<number, string>>({})
  const [selectedSections, setSelectedSections] = useState<number[]>([])
  const [sessionStatus, setSessionStatus] = useState<SessionStatusType | null>(null)
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [reviewPage, setReviewPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [approved, setApproved] = useState<Set<number>>(new Set())
  const [rejected, setRejected] = useState<Set<number>>(new Set())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({})
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const PAGE_SIZE = 50

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const result = await ingestionApi.uploadAndScan(file, docType)
      setScanResult(result)
      // Auto-select only data sheets (skip cover/notes pages)
      setSelectedSections(result.sections_found.filter(s => s.page_range !== 'cover/notes').map(s => s.index))
      // Pre-fill metadata from auto-detected values
      if (result.document_metadata) {
        setConfirmedMetadata({ ...emptyMetadata(), ...result.document_metadata })
      } else {
        setConfirmedMetadata(emptyMetadata())
      }
      setClarifyingAnswers({})
      setStep('confirm-metadata')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleUrlScan = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = await ingestionApi.urlScan(url, docType)
      setScanResult(result)
      // Auto-select only data sheets (skip cover/notes pages)
      setSelectedSections(result.sections_found.filter(s => s.page_range !== 'cover/notes').map(s => s.index))
      if (result.document_metadata) {
        setConfirmedMetadata({ ...emptyMetadata(), ...result.document_metadata })
      } else {
        setConfirmedMetadata(emptyMetadata())
      }
      setClarifyingAnswers({})
      setStep('confirm-metadata')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'URL scan failed')
    } finally {
      setLoading(false)
    }
  }

  // Merge clarifying question answers into guidance_notes before extraction
  const buildFinalMetadata = (): DocumentMetadata => {
    const questions = confirmedMetadata.clarifying_questions ?? []
    const qaLines = questions
      .map((q, i) => clarifyingAnswers[i]?.trim() ? `Q: ${q}\nA: ${clarifyingAnswers[i].trim()}` : null)
      .filter(Boolean)

    if (qaLines.length === 0) return confirmedMetadata

    const existingNotes = confirmedMetadata.guidance_notes ?? ''
    const combined = [existingNotes, '---', ...qaLines].filter(Boolean).join('\n')
    return { ...confirmedMetadata, guidance_notes: combined }
  }

  const handleStartExtraction = async () => {
    if (!scanResult || selectedSections.length === 0) return
    setLoading(true)
    setError('')
    try {
      const finalMeta = buildFinalMetadata()
      await ingestionApi.startExtraction(scanResult.session_id, selectedSections, finalMeta)
      setStep('extracting')
      // Poll for completion
      const interval = setInterval(async () => {
        const status = await ingestionApi.getSession(scanResult.session_id)
        setSessionStatus(status)
        if (status.status === 'in_review') {
          clearInterval(interval)
          await loadReviewPage(1)
          setStep('review')
        } else if (status.status === 'failed') {
          clearInterval(interval)
          setError(status.error_message ?? 'Extraction failed')
          setStep('upload')
        }
      }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setLoading(false)
    }
  }

  const loadReviewPage = async (page: number) => {
    if (!scanResult) return
    const data = await ingestionApi.getRecords(scanResult.session_id, page, PAGE_SIZE) as { records: Record<string, unknown>[]; total: number }
    setRecords(data.records)
    setTotalRecords(data.total)
    setReviewPage(page)
  }

  const handleApprove = async (index: number) => {
    if (!scanResult) return
    if (approved.has(index)) {
      // Toggle off — move back to pending
      await ingestionApi.reviewRecord(scanResult.session_id, index, 'pending')
      setApproved(prev => { const s = new Set(prev); s.delete(index); return s })
    } else {
      await ingestionApi.reviewRecord(scanResult.session_id, index, 'approve')
      setApproved(prev => new Set([...prev, index]))
      setRejected(prev => { const s = new Set(prev); s.delete(index); return s })
    }
  }

  const handleReject = async (index: number) => {
    if (!scanResult) return
    if (rejected.has(index)) {
      // Toggle off — move back to pending
      await ingestionApi.reviewRecord(scanResult.session_id, index, 'pending')
      setRejected(prev => { const s = new Set(prev); s.delete(index); return s })
    } else {
      await ingestionApi.reviewRecord(scanResult.session_id, index, 'reject')
      setRejected(prev => new Set([...prev, index]))
      setApproved(prev => { const s = new Set(prev); s.delete(index); return s })
    }
  }

  const handleBulkApprove = async () => {
    if (!scanResult) return
    setLoading(true)
    setError('')
    try {
      await ingestionApi.bulkReview(scanResult.session_id, 'approve_all')
      const allIndices = new Set(Array.from({ length: totalRecords }, (_, i) => i))
      setApproved(allIndices)
      setRejected(new Set())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bulk approve failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCommit = async () => {
    if (!scanResult) return
    setLoading(true)
    try {
      const result = await ingestionApi.commit(scanResult.session_id)
      setSummary(result)
      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Commit failed')
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (absIndex: number, record: Record<string, unknown>) => {
    // Flatten nested {value: ...} → plain values for the edit form
    const draft: Record<string, unknown> = {}
    for (const [k, entry] of Object.entries(record)) {
      if (entry && typeof entry === 'object' && 'value' in (entry as Record<string, unknown>)) {
        draft[k] = (entry as Record<string, unknown>).value
      } else {
        draft[k] = entry
      }
    }
    setEditDraft(draft)
    setEditingIndex(absIndex)
  }

  const handleSaveEdit = async (absIndex: number, andApprove: boolean) => {
    if (!scanResult) return
    setLoading(true)
    try {
      const action = andApprove ? 'approve' : 'pending'
      await ingestionApi.reviewRecord(scanResult.session_id, absIndex, action, editDraft)
      if (andApprove) {
        setApproved(prev => new Set([...prev, absIndex]))
        setRejected(prev => { const s = new Set(prev); s.delete(absIndex); return s })
      }
      await loadReviewPage(reviewPage)
      setEditingIndex(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const setDraft = (patch: Record<string, unknown>) => setEditDraft(prev => ({ ...prev, ...patch }))

  const totalPages = Math.ceil(totalRecords / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="h-12 border-b border-border bg-card flex items-center px-4 gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to database
        </button>
        <span className="text-muted-foreground">·</span>
        <span className="text-sm font-medium">Ingest Emission Factors</span>

        {/* Step indicator */}
        {step !== 'upload' && step !== 'done' && (
          <>
            <span className="text-muted-foreground">·</span>
            <div className="flex items-center gap-1.5 text-xs">
              {(['confirm-metadata', 'selecting', 'extracting', 'review'] as const).map((s, i) => {
                const labels: Record<string, string> = {
                  'confirm-metadata': 'Confirm context',
                  'selecting': 'Select sections',
                  'extracting': 'Extracting',
                  'review': 'Review',
                }
                const steps: Step[] = ['confirm-metadata', 'selecting', 'extracting', 'review']
                const currentIdx = steps.indexOf(step)
                const isActive = s === step
                const isDone = i < currentIdx
                return (
                  <span
                    key={s}
                    className={cn(
                      'px-2 py-0.5 rounded',
                      isActive && 'bg-primary text-primary-foreground font-medium',
                      isDone && 'text-muted-foreground',
                      !isActive && !isDone && 'text-muted-foreground/50',
                    )}
                  >
                    {i + 1}. {labels[s]}
                  </span>
                )
              })}
            </div>
          </>
        )}
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Upload Source Document</h2>
              <p className="text-sm text-muted-foreground mt-1">Upload a PDF, Excel, or CSV file — or paste a URL to a public source.</p>
            </div>

            <div className="flex gap-2">
              {(['file', 'url'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn('h-8 px-4 rounded-md text-sm font-medium transition-colors', mode === m ? 'bg-primary text-primary-foreground' : 'border border-input hover:bg-muted/50')}
                >
                  {m === 'file' ? <><Upload className="w-3.5 h-3.5 inline mr-1.5" />File</> : <><Link className="w-3.5 h-3.5 inline mr-1.5" />URL</>}
                </button>
              ))}
            </div>

            {/* Document type */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Document type</label>
              <div className="flex gap-2">
                {([
                  { value: 'generic', label: 'Generic source' },
                  { value: 'epd', label: 'EPD' },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setDocType(value)}
                    className={cn('h-8 px-4 rounded-md text-sm font-medium transition-colors', docType === value ? 'bg-primary text-primary-foreground' : 'border border-input hover:bg-muted/50')}
                  >
                    {value === 'epd' && <Leaf className="w-3.5 h-3.5 inline mr-1.5" />}
                    {label}
                  </button>
                ))}
              </div>
              {docType === 'epd' && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <Leaf className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
                  <p>
                    An <strong>Environmental Product Declaration</strong> is a verified product carbon report (EN 15804 / ISO 14025).
                    Claude will read the declared unit, lifecycle modules (A1-A3, A4, C1-C4, D…) and GWP indicators, and auto-fill the
                    manufacturer, EPD registration number, declared unit and supplier fields — one record per declared module.
                  </p>
                </div>
              )}
            </div>

            {mode === 'file' ? (
              <label className={cn('flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-12 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors', loading && 'opacity-50 pointer-events-none')}>
                {loading ? (
                  <><Loader2 className="w-8 h-8 text-primary animate-spin mb-3" /><p className="text-sm text-muted-foreground">Scanning document…</p></>
                ) : (
                  <><FileText className="w-8 h-8 text-muted-foreground mb-3" /><p className="text-sm font-medium">Click to upload</p><p className="text-xs text-muted-foreground mt-1">PDF, Excel (.xlsx), or CSV</p></>
                )}
                <input type="file" className="hidden" accept=".pdf,.xlsx,.xls,.csv" onChange={handleFileUpload} disabled={loading} />
              </label>
            ) : (
              <div className="space-y-3">
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://www.gov.uk/government/publications/greenhouse-gas-reporting..."
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={handleUrlScan}
                  disabled={loading || !url.trim()}
                  className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Scanning…</> : 'Scan URL'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Confirm document metadata ── */}
        {step === 'confirm-metadata' && scanResult && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Confirm Document Context</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Claude has auto-detected the following metadata from the document. Review and correct any values — they will be applied to <strong>every extracted record</strong>.
              </p>
            </div>

            <MetadataForm
              metadata={confirmedMetadata}
              clarifyingAnswers={clarifyingAnswers}
              isEpd={docType === 'epd'}
              onChange={setConfirmedMetadata}
              onAnswerChange={(i, v) => setClarifyingAnswers(prev => ({ ...prev, [i]: v }))}
            />

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('selecting')}
                className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                Confirm & select sections →
              </button>
              <button
                onClick={() => { setScanResult(null); setStep('upload') }}
                className="h-9 px-4 rounded-md border border-input text-sm hover:bg-muted/50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Select sections ── */}
        {step === 'selecting' && scanResult && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Select Sections to Extract</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {scanResult.page_count} pages · {scanResult.sections_found.length} section{scanResult.sections_found.length !== 1 ? 's' : ''} found
                {scanResult.has_scanned_pages && ' · Contains scanned (image) pages'}
              </p>
            </div>

            {/* Cost estimate */}
            <div className="flex items-center gap-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-medium text-amber-800">Estimated cost: ~${scanResult.estimated_cost_usd.toFixed(2)}</span>
                <span className="text-amber-700 ml-2">(~{scanResult.estimated_tokens.toLocaleString()} tokens)</span>
              </div>
            </div>

            {/* Section list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Select sections to extract:</span>
                <button
                  onClick={() => setSelectedSections(scanResult.sections_found.filter(s => s.page_range !== 'cover/notes').map(s => s.index))}
                  className="hover:text-foreground"
                >
                  Select all data sheets
                </button>
              </div>
              {scanResult.sections_found.map((section: DocumentSection) => {
                const isCover = section.page_range === 'cover/notes'
                return (
                <div key={section.index} className={cn(
                  'flex items-start gap-3 p-3 rounded-md border transition-colors',
                  isCover
                    ? 'border-dashed border-muted-foreground/30 bg-muted/30 opacity-70 cursor-default'
                    : cn('cursor-pointer', selectedSections.includes(section.index) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30')
                )}>
                  {isCover ? (
                    <div className="mt-0.5 w-4 h-4 flex items-center justify-center text-muted-foreground" title="Cover/notes sheets are read for metadata only">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-primary"
                      checked={selectedSections.includes(section.index)}
                      onChange={e => {
                        if (e.target.checked) setSelectedSections(prev => [...prev, section.index])
                        else setSelectedSections(prev => prev.filter(i => i !== section.index))
                      }}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{section.title}</span>
                      {isCover ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">Cover / Notes — metadata only</span>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground">{section.page_range}</span>
                          {section.row_count_estimate > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">~{section.row_count_estimate} rows</span>
                          )}
                        </>
                      )}
                    </div>
                    {!isCover && section.description && <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>}
                    {!isCover && section.column_headers.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Columns: {section.column_headers.join(', ')}</p>
                    )}
                  </div>
                </div>
                )
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleStartExtraction}
                disabled={selectedSections.length === 0 || loading}
                className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Starting…</> : `Extract ${selectedSections.length} section${selectedSections.length !== 1 ? 's' : ''}`}
              </button>
              <button
                onClick={() => setStep('confirm-metadata')}
                className="h-9 px-4 rounded-md border border-input text-sm hover:bg-muted/50"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Extracting ── */}
        {step === 'extracting' && (
          <div className="bg-card border border-border rounded-xl p-12 text-center space-y-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <div>
              <p className="text-sm font-medium">Extracting emission factors…</p>
              <p className="text-xs text-muted-foreground mt-1">Claude is reading the document. This may take a few minutes for large files.</p>
            </div>
            {sessionStatus && (
              <p className="text-xs text-muted-foreground">Status: {sessionStatus.status}</p>
            )}
          </div>
        )}

        {/* ── Step 5: Review ── */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Review Extracted Records</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalRecords} records extracted · {approved.size} approved · {rejected.size} rejected
                  · Page {reviewPage} of {totalPages}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkApprove}
                  disabled={loading}
                  className="h-8 px-3 rounded-md text-xs border border-input hover:bg-muted/50 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? <><Loader2 className="w-3 h-3 animate-spin" />Approving…</> : 'Approve all'}
                </button>
                <button
                  onClick={handleCommit}
                  disabled={loading || approved.size === 0}
                  className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Committing…</> : `Commit ${approved.size} records`}
                </button>
              </div>
            </div>

            {/* Record rows (source-schema) */}
            <div className="space-y-2">
              {records.map((record, i) => {
                const absIndex = (reviewPage - 1) * PAGE_SIZE + i
                const isApproved = approved.has(absIndex)
                const isRejected = rejected.has(absIndex)

                // Extract source-schema fields (handles both {value:...} wrapper and bare values).
                const fld = (k: string): unknown => {
                  const e = record[k]
                  if (e && typeof e === 'object' && 'value' in (e as Record<string, unknown>)) return (e as Record<string, unknown>).value
                  return e
                }
                const activity = fld('activity_name') as string | undefined
                const efValue = fld('ef_value') as number | string | null | undefined
                const species = fld('ghg_species') as string | undefined
                const numUnit = fld('numerator_unit') as string | undefined
                const denUnit = fld('denominator_unit') as string | undefined
                const country = fld('country_iso') as string | undefined
                const scope = fld('ghg_scope') as string | undefined
                const gwp = fld('gwp_basis') as string | undefined
                const category = fld('emission_category') as string | undefined
                const refYear = fld('reference_year') as number | undefined
                const sourceOrg = fld('source_organization') as string | undefined
                const supplierName = fld('supplier_name') as string | undefined
                const epdReference = fld('supplier_epd_reference') as string | undefined
                const declaredUnit = (fld('denominator_basis') ?? fld('denominator_unit')) as string | undefined
                const systemBoundary = fld('system_boundary') as string | undefined
                const hasOutlier = record.has_outlier_values as boolean
                const hasUnitMismatch = record.has_unit_mismatch as boolean

                const toNum = (v: number | string | null | undefined) => {
                  if (v == null || v === '') return null
                  const n = Number(v)
                  return isNaN(n) ? null : n
                }
                const efVal = toNum(efValue)

                return (
                  <div key={absIndex} className={cn('bg-card border rounded-lg p-3 transition-colors', isApproved && 'border-emerald-300 bg-emerald-50/50', isRejected && 'border-red-300 bg-red-50/50', !isApproved && !isRejected && 'border-border')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{activity ?? '—'}</span>
                          {hasOutlier && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Outlier value</span>}
                          {hasUnitMismatch && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">Unit mismatch</span>}
                          {efVal == null && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">No EF value</span>}
                        </div>

                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          <span className={cn('font-mono font-semibold', efVal != null ? 'text-foreground' : 'text-muted-foreground')}>
                            {efVal != null ? efVal.toFixed(6) : '—'}
                          </span>
                          {species && <span className="text-muted-foreground">{species}</span>}
                          {(numUnit || denUnit) && (
                            <span className="text-muted-foreground">{numUnit ?? '?'} / {denUnit ?? '?'}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {country && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{country}</span>}
                          {scope && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">Scope {scope}</span>}
                          {gwp && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{gwp}</span>}
                          {category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{category}</span>}
                          {refYear && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{refYear}</span>}
                          {sourceOrg && <span className="text-[10px] text-muted-foreground">· {sourceOrg}</span>}
                        </div>

                        {/* EPD provenance — surfaced so the reviewer can verify against the declaration */}
                        {docType === 'epd' && (
                          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap p-1.5 rounded bg-emerald-50/60 border border-emerald-100 text-[11px]">
                            <span className="flex items-center gap-1 text-emerald-700 font-medium"><Leaf className="w-3 h-3" />EPD</span>
                            <span className="text-muted-foreground">Manufacturer: <span className="text-foreground font-medium">{supplierName ?? '—'}</span></span>
                            <span className="text-muted-foreground">Reg. no: <span className="text-foreground font-mono">{epdReference ?? '—'}</span></span>
                            <span className="text-muted-foreground">Declared unit: <span className="text-foreground">{declaredUnit ?? '—'}</span></span>
                            {systemBoundary && <span className="text-muted-foreground">Boundary: <span className="text-foreground">{systemBoundary}</span></span>}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => editingIndex === absIndex ? setEditingIndex(null) : openEdit(absIndex, record)}
                          className={cn('h-7 px-3 rounded text-xs font-medium transition-colors', editingIndex === absIndex ? 'bg-muted border border-border' : 'border border-input hover:bg-muted/50')}
                        >
                          {editingIndex === absIndex ? 'Close' : 'Edit'}
                        </button>
                        <button
                          onClick={() => handleApprove(absIndex)}
                          className={cn('h-7 px-3 rounded text-xs font-medium transition-colors', isApproved ? 'bg-emerald-600 text-white' : 'border border-emerald-300 text-emerald-700 hover:bg-emerald-50')}
                        >
                          {isApproved ? '✓ Approved' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(absIndex)}
                          className={cn('h-7 px-3 rounded text-xs font-medium transition-colors', isRejected ? 'bg-red-500 text-white' : 'border border-red-200 text-red-600 hover:bg-red-50')}
                        >
                          {isRejected ? '✗ Rejected' : 'Reject'}
                        </button>
                      </div>
                    </div>

                    {/* ── Inline edit panel (source-schema) ── */}
                    {editingIndex === absIndex && (
                      <div className="mt-3 pt-3 border-t border-border space-y-3">
                        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-auto pr-1">
                          {[
                            { key: 'activity_name', label: 'Activity name' },
                            { key: 'emission_category', label: 'Emission category' },
                            { key: 'sub_category', label: 'Sub-category' },
                            { key: 'ghg_scope', label: 'GHG scope (1/2/3)' },
                            { key: 'ef_value', label: 'EF value', type: 'number' },
                            { key: 'ghg_species', label: 'GHG species' },
                            { key: 'numerator_unit', label: 'Numerator unit' },
                            { key: 'denominator_unit', label: 'Denominator unit' },
                            { key: 'country_iso', label: 'Country (ISO3)' },
                            { key: 'geography_type', label: 'Geography type' },
                            { key: 'reference_year', label: 'Reference year', type: 'number' },
                            { key: 'valid_from', label: 'Valid from (YYYY-MM-DD)' },
                            { key: 'valid_to', label: 'Valid to (YYYY-MM-DD)' },
                            { key: 'gwp_basis', label: 'GWP basis' },
                            { key: 'source_organization', label: 'Source organization' },
                            { key: 'data_origin', label: 'Data origin' },
                            { key: 'calculation_method', label: 'Calc method' },
                            { key: 'system_boundary', label: 'System boundary' },
                            { key: 'notes', label: 'Notes' },
                            ...(docType === 'epd' ? [
                              { key: 'supplier_name', label: 'Manufacturer (supplier)' },
                              { key: 'supplier_country', label: 'Supplier country (ISO3)' },
                              { key: 'supplier_sector', label: 'Supplier sector' },
                              { key: 'supplier_epd_reference', label: 'EPD registration number' },
                              { key: 'denominator_basis', label: 'Declared unit (basis)' },
                            ] : []),
                          ].map(({ key, label, type }) => (
                            <label key={key} className="block">
                              <span className="text-[10px] text-muted-foreground">{label}</span>
                              <input
                                type={type ?? 'text'}
                                className="w-full h-7 px-2 rounded border border-input bg-background text-xs"
                                value={editDraft[key] != null ? String(editDraft[key]) : ''}
                                onChange={e => setDraft({ [key]: type === 'number'
                                  ? (e.target.value !== '' ? Number(e.target.value) : null)
                                  : (e.target.value || null) })}
                              />
                            </label>
                          ))}
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleSaveEdit(absIndex, true)}
                            disabled={loading}
                            className="h-8 px-4 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {loading ? <><Loader2 className="w-3 h-3 animate-spin" />Saving…</> : '✓ Save & Approve'}
                          </button>
                          <button
                            onClick={() => handleSaveEdit(absIndex, false)}
                            disabled={loading}
                            className="h-8 px-3 rounded border border-input text-xs hover:bg-muted/50 disabled:opacity-50"
                          >
                            Save only
                          </button>
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="h-8 px-3 rounded text-xs text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button disabled={reviewPage <= 1} onClick={() => loadReviewPage(reviewPage - 1)} className="h-8 px-3 rounded border border-input text-sm disabled:opacity-30 hover:bg-muted/50">
                  ← Prev
                </button>
                <span className="text-sm text-muted-foreground">Page {reviewPage} of {totalPages}</span>
                <button disabled={reviewPage >= totalPages} onClick={() => loadReviewPage(reviewPage + 1)} className="h-8 px-3 rounded border border-input text-sm disabled:opacity-30 hover:bg-muted/50">
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 6: Done ── */}
        {step === 'done' && summary && (
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
            <div>
              <h2 className="text-lg font-semibold">Import Complete</h2>
              <div className="mt-3 grid grid-cols-3 gap-4 max-w-sm mx-auto text-center">
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-2xl font-bold text-emerald-700">{summary.approved}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Committed</p>
                </div>
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-2xl font-bold text-red-600">{summary.rejected}</p>
                  <p className="text-xs text-red-500 mt-0.5">Rejected</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-2xl font-bold text-amber-700">{summary.conflicts_flagged}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Conflicts</p>
                </div>
              </div>
              {summary.conflicts_flagged > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  {summary.conflicts_flagged} conflict{summary.conflicts_flagged !== 1 ? 's' : ''} flagged — review in the database.
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => navigate('/')}
                className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
              >
                View database
              </button>
              <button
                onClick={() => {
                  setStep('upload')
                  setScanResult(null)
                  setSelectedSections([])
                  setApproved(new Set())
                  setRejected(new Set())
                  setSummary(null)
                  setConfirmedMetadata(emptyMetadata())
                  setClarifyingAnswers({})
                  setDocType('generic')
                }}
                className="h-9 px-4 rounded-md border border-input text-sm hover:bg-muted/50"
              >
                Upload another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
