import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Link, FileText, CheckCircle, AlertTriangle, Loader2, HelpCircle } from 'lucide-react'
import { ingestionApi } from '@/lib/api'
import type { ScanResult, DocumentSection, SessionStatus as SessionStatusType, ReviewSummary, DocumentMetadata } from '@/types/emission-factor'
import { cn } from '@/lib/utils'

type Step = 'upload' | 'confirm-metadata' | 'selecting' | 'extracting' | 'review' | 'done'

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

const GWP_VERSIONS = ['AR4', 'AR5', 'AR6', 'GWP20', 'GWP100', 'Not stated']

const SCOPE_OPTIONS = [
  'Scope 1',
  'Scope 2',
  'Scope 3 — Category 1: Purchased goods and services',
  'Scope 3 — Category 2: Capital goods',
  'Scope 3 — Category 3: Fuel and energy-related activities',
  'Scope 3 — Category 4: Upstream transportation & distribution',
  'Scope 3 — Category 5: Waste generated in operations',
  'Scope 3 — Category 6: Business travel',
  'Scope 3 — Category 7: Employee commuting',
  'Scope 3 — Category 8: Upstream leased assets',
  'Scope 3 — Category 9: Downstream transportation & distribution',
  'Scope 3 — Category 10: Processing of sold products',
  'Scope 3 — Category 11: Use of sold products',
  'Scope 3 — Category 12: End-of-life treatment of sold products',
  'Scope 3 — Category 13: Downstream leased assets',
  'Scope 3 — Category 14: Franchises',
  'Scope 3 — Category 15: Investments',
]

function emptyMetadata(): DocumentMetadata {
  return {
    source_name: null,
    source_type: null,
    year: null,
    validity_start: null,
    validity_end: null,
    geography_country: null,
    geography_description: null,
    gwp_version: null,
    applicable_scopes: null,
    lca_stages: null,
    comments_applicability: null,
    guidance_notes: null,
    clarifying_questions: null,
  }
}

interface MetadataFormProps {
  metadata: DocumentMetadata
  clarifyingAnswers: Record<number, string>
  onChange: (m: DocumentMetadata) => void
  onAnswerChange: (index: number, value: string) => void
}

function MetadataForm({ metadata: m, clarifyingAnswers, onChange, onAnswerChange }: MetadataFormProps) {
  const set = (patch: Partial<DocumentMetadata>) => onChange({ ...m, ...patch })

  const toggleScope = (scope: string) => {
    const current = m.applicable_scopes ?? []
    if (current.includes(scope)) {
      set({ applicable_scopes: current.filter(s => s !== scope) })
    } else {
      set({ applicable_scopes: [...current, scope] })
    }
  }

  return (
    <div className="space-y-5">
      {/* Source name */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source Name</label>
          <input
            type="text"
            value={m.source_name ?? ''}
            onChange={e => set({ source_name: e.target.value || null })}
            placeholder="e.g. UK Government GHG Conversion Factors 2023"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source Type</label>
          <select
            value={m.source_type ?? ''}
            onChange={e => set({ source_type: e.target.value || null })}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Select type —</option>
            {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Publication Year</label>
          <input
            type="number"
            value={m.year ?? ''}
            onChange={e => set({ year: e.target.value ? Number(e.target.value) : null })}
            placeholder="2023"
            min="1990"
            max="2099"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valid From (year)</label>
          <input
            type="number"
            value={m.validity_start ?? ''}
            onChange={e => set({ validity_start: e.target.value ? Number(e.target.value) : null })}
            placeholder="2023"
            min="1990"
            max="2099"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Valid To (year)</label>
          <input
            type="number"
            value={m.validity_end ?? ''}
            onChange={e => set({ validity_end: e.target.value ? Number(e.target.value) : null })}
            placeholder="open-ended"
            min="1990"
            max="2099"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Geography (ISO alpha-2)</label>
          <input
            type="text"
            value={m.geography_country ?? ''}
            onChange={e => set({ geography_country: e.target.value.toUpperCase() || null })}
            placeholder="GB"
            maxLength={2}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">GWP Version</label>
          <select
            value={m.gwp_version ?? ''}
            onChange={e => set({ gwp_version: e.target.value || null })}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Select —</option>
            {GWP_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">LCA Stage(s)</label>
          <input
            type="text"
            value={m.lca_stages?.join(', ') ?? ''}
            onChange={e => set({ lca_stages: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : null })}
            placeholder="e.g. Combustion, Well-to-tank"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Applicability notes from cover page */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Applicability Notes <span className="text-primary normal-case font-normal">(from cover page)</span></label>
        <p className="text-[11px] text-muted-foreground">Key usage guidance from the cover page — applied to every record's Comments field (e.g. "UK use only", "Gross CV basis", "Excludes biogenic CO₂").</p>
        <textarea
          value={m.comments_applicability ?? ''}
          onChange={e => set({ comments_applicability: e.target.value || null })}
          placeholder="Auto-filled from cover page / notes sheet…"
          rows={2}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Applicable scopes */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Applicable Scopes</label>
        <div className="grid grid-cols-2 gap-1">
          {SCOPE_OPTIONS.slice(0, 3).map(scope => (
            <label key={scope} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
              <input
                type="checkbox"
                className="accent-primary"
                checked={(m.applicable_scopes ?? []).includes(scope)}
                onChange={() => toggleScope(scope)}
              />
              {scope}
            </label>
          ))}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show Scope 3 categories…</summary>
          <div className="grid grid-cols-1 gap-0.5 mt-2 pl-2">
            {SCOPE_OPTIONS.slice(3).map(scope => (
              <label key={scope} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={(m.applicable_scopes ?? []).includes(scope)}
                  onChange={() => toggleScope(scope)}
                />
                {scope}
              </label>
            ))}
          </div>
        </details>
      </div>

      {/* Guidance notes */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Guidance Notes</label>
        <p className="text-[11px] text-muted-foreground">Key applicability notes that should be attached to every record (e.g. gross vs net CV, biofuel blending rules, exclusions).</p>
        <textarea
          value={m.guidance_notes ?? ''}
          onChange={e => set({ guidance_notes: e.target.value || null })}
          rows={3}
          placeholder="e.g. Factors are based on gross calorific values. Excludes biogenic CO2."
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Clarifying questions from Claude */}
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
      const result = await ingestionApi.uploadAndScan(file)
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
      const result = await ingestionApi.urlScan(url)
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
    // Convert full date strings to plain year numbers for year inputs
    if (draft.validity_start) {
      draft.validity_start_year = parseInt(String(draft.validity_start).slice(0, 4)) || ''
    } else {
      draft.validity_start_year = ''
    }
    if (draft.validity_end) {
      draft.validity_end_year = parseInt(String(draft.validity_end).slice(0, 4)) || ''
    } else {
      draft.validity_end_year = ''
    }
    setEditDraft(draft)
    setEditingIndex(absIndex)
  }

  const handleSaveEdit = async (absIndex: number, andApprove: boolean) => {
    if (!scanResult) return
    setLoading(true)
    try {
      // Build clean payload: convert year numbers → ISO date strings, remove helper keys
      const { validity_start_year, validity_end_year, ...rest } = editDraft
      const payload: Record<string, unknown> = {
        ...rest,
        validity_start: validity_start_year ? `${validity_start_year}-01-01` : null,
        validity_end: validity_end_year ? `${validity_end_year}-12-31` : null,
      }
      const action = andApprove ? 'approve' : 'pending'
      await ingestionApi.reviewRecord(scanResult.session_id, absIndex, action, payload)
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

            {/* Record rows */}
            <div className="space-y-2">
              {records.map((record, i) => {
                const absIndex = (reviewPage - 1) * PAGE_SIZE + i
                const isApproved = approved.has(absIndex)
                const isRejected = rejected.has(absIndex)
                const activityField = record.source_activity_name as { value?: string } | undefined
                const canonicalField = record.canonical_activity_name as { value?: string } | undefined
                const unitField = record.unit as { value?: string } | undefined
                const co2eField = record.ef_total_co2e as { value?: number | string | null; extraction_confidence?: string } | undefined
                const co2Field = record.ef_co2 as { value?: number | string | null } | undefined
                const ch4Field = record.ef_ch4 as { value?: number | string | null } | undefined
                const n2oField = record.ef_n2o as { value?: number | string | null } | undefined
                const scopesField = record.applicable_scopes as { value?: string[] } | undefined
                const gwpField = record.gwp_version as { value?: string } | undefined
                const countryField = record.geography_country as { value?: string } | undefined
                const hasOutlier = record.has_outlier_values as boolean
                const hasUnitMismatch = record.has_unit_mismatch as boolean

                // Pick the best displayable EF value
                const toNum = (v: number | string | null | undefined) => {
                  if (v == null || v === '') return null
                  const n = Number(v)
                  return isNaN(n) ? null : n
                }
                const co2eVal = toNum(co2eField?.value)
                const co2Val = toNum(co2Field?.value)
                const ch4Val = toNum(ch4Field?.value)
                const n2oVal = toNum(n2oField?.value)
                const hasAnyValue = co2eVal != null || co2Val != null || ch4Val != null || n2oVal != null
                const isLowConf = co2eField?.extraction_confidence === 'low'

                return (
                  <div key={absIndex} className={cn('bg-card border rounded-lg p-3 transition-colors', isApproved && 'border-emerald-300 bg-emerald-50/50', isRejected && 'border-red-300 bg-red-50/50', !isApproved && !isRejected && 'border-border')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* Activity name + flags */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {canonicalField?.value ?? activityField?.value ?? '—'}
                          </span>
                          {hasOutlier && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Outlier value</span>}
                          {hasUnitMismatch && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">Unit mismatch</span>}
                          {isLowConf && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Low confidence</span>}
                          {!hasAnyValue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">No EF value extracted</span>}
                        </div>

                        {/* Source name if different from canonical */}
                        {activityField?.value && canonicalField?.value && activityField.value !== canonicalField.value && (
                          <p className="text-xs text-muted-foreground">Source: {activityField.value}</p>
                        )}

                        {/* EF values row */}
                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          <span className={cn('font-mono font-semibold', co2eVal != null ? 'text-foreground' : 'text-muted-foreground')}>
                            {co2eVal != null ? co2eVal.toFixed(4) : '—'}
                          </span>
                          <span className="text-muted-foreground">{unitField?.value ?? '—'}</span>
                          {co2Val != null && (
                            <span className="text-muted-foreground">CO₂: <span className="font-mono text-foreground">{co2Val.toFixed(4)}</span></span>
                          )}
                          {ch4Val != null && (
                            <span className="text-muted-foreground">CH₄: <span className="font-mono text-foreground">{ch4Val.toFixed(6)}</span></span>
                          )}
                          {n2oVal != null && (
                            <span className="text-muted-foreground">N₂O: <span className="font-mono text-foreground">{n2oVal.toFixed(6)}</span></span>
                          )}
                        </div>

                        {/* Tags row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {countryField?.value && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{countryField.value}</span>
                          )}
                          {gwpField?.value && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{gwpField.value}</span>
                          )}
                          {scopesField?.value && Array.isArray(scopesField.value) && scopesField.value.slice(0, 2).map(s => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{s}</span>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons */}
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

                    {/* ── Inline edit panel ── */}
                    {editingIndex === absIndex && (
                      <div className="mt-3 pt-3 border-t border-border space-y-4">
                        {/* Names */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Canonical Activity Name</label>
                            <input
                              className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                              value={String(editDraft.canonical_activity_name ?? '')}
                              onChange={e => setDraft({ canonical_activity_name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Source Activity Name</label>
                            <input
                              className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                              value={String(editDraft.source_activity_name ?? '')}
                              onChange={e => setDraft({ source_activity_name: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* Unit + Activity Category */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Unit</label>
                            <input
                              className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                              value={String(editDraft.unit ?? '')}
                              onChange={e => setDraft({ unit: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Activity Category</label>
                            <input
                              className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                              value={String(editDraft.activity_category ?? '')}
                              onChange={e => setDraft({ activity_category: e.target.value || null })}
                            />
                          </div>
                        </div>

                        {/* EF values */}
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">EF Values (kg per unit)</label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { key: 'ef_total_co2e', label: 'Total CO₂e' },
                              { key: 'ef_co2',        label: 'CO₂' },
                              { key: 'ef_ch4',        label: 'CH₄' },
                              { key: 'ef_n2o',        label: 'N₂O' },
                              { key: 'ef_pfc',        label: 'PFC' },
                              { key: 'ef_sf6',        label: 'SF₆' },
                              { key: 'ef_nf3',        label: 'NF₃' },
                            ].map(({ key, label }) => (
                              <div key={key} className="space-y-0.5">
                                <label className="text-[10px] text-muted-foreground">{label}</label>
                                <input
                                  type="number"
                                  step="any"
                                  className="w-full h-7 px-2 rounded border border-input bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                                  value={editDraft[key] != null ? String(editDraft[key]) : ''}
                                  onChange={e => setDraft({ [key]: e.target.value !== '' ? Number(e.target.value) : null })}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Classification */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">GWP Version</label>
                            <select
                              className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                              value={String(editDraft.gwp_version ?? '')}
                              onChange={e => setDraft({ gwp_version: e.target.value || null })}
                            >
                              <option value="">— Select —</option>
                              {GWP_VERSIONS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Country (ISO 2)</label>
                            <input
                              maxLength={2}
                              className="w-full h-8 px-2 rounded border border-input bg-background text-xs uppercase focus:outline-none focus:ring-2 focus:ring-ring"
                              value={String(editDraft.geography_country ?? '')}
                              onChange={e => setDraft({ geography_country: e.target.value.toUpperCase() || null })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Valid From / To (year)</label>
                            <div className="flex gap-1">
                              <input
                                type="number" min="1990" max="2099" placeholder="From"
                                className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                value={(editDraft.validity_start_year as number | string) ?? ''}
                                onChange={e => setDraft({ validity_start_year: e.target.value ? Number(e.target.value) : '' })}
                              />
                              <input
                                type="number" min="1990" max="2099" placeholder="To"
                                className="w-full h-8 px-2 rounded border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                value={(editDraft.validity_end_year as number | string) ?? ''}
                                onChange={e => setDraft({ validity_end_year: e.target.value ? Number(e.target.value) : '' })}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Scope multi-select */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">GHG Scope(s)</label>
                          <div className="flex flex-wrap gap-1.5">
                            {SCOPE_OPTIONS.map(scope => {
                              const current = (editDraft.applicable_scopes as string[] | null) ?? []
                              const active = current.includes(scope)
                              return (
                                <button
                                  key={scope}
                                  type="button"
                                  onClick={() => setDraft({ applicable_scopes: active ? current.filter(s => s !== scope) : [...current, scope] })}
                                  className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-colors', active ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted/50')}
                                >
                                  {scope.replace('Scope 3 — Category ', 'S3-C')}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Comments */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Comments — Applicability</label>
                            <textarea
                              rows={2}
                              className="w-full px-2 py-1.5 rounded border border-input bg-background text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                              value={String(editDraft.comments_applicability ?? '')}
                              onChange={e => setDraft({ comments_applicability: e.target.value || null })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Comments — Limitations</label>
                            <textarea
                              rows={2}
                              className="w-full px-2 py-1.5 rounded border border-input bg-background text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                              value={String(editDraft.comments_limitations ?? '')}
                              onChange={e => setDraft({ comments_limitations: e.target.value || null })}
                            />
                          </div>
                        </div>

                        {/* Save actions */}
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
