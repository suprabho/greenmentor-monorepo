import { useState, useEffect, useCallback } from 'react'
import { Search, Loader2, Leaf, Bell, Inbox, Play, Trash2, Plus, CheckCircle, AlertTriangle } from 'lucide-react'
import { environdecApi } from '@/lib/api'
import type { EnvirondecHit, EnvirondecWatch, EnvirondecQueueItem, EnvirondecIngestResponse } from '@/lib/api'
import { cn } from '@/lib/utils'

type Tab = 'search' | 'watches' | 'queue'

/**
 * On-demand ingestion from the International EPD System (environdec.com).
 * Search the Data Hub, pull only the EPDs you pick into a review session — no
 * LLM, no bulk import. `onIngested` hands a created review session back to the
 * IngestionPage's existing review→commit flow.
 */
export default function EnvirondecPanel({ onIngested }: { onIngested: (sessionId: string) => void }) {
  const [tab, setTab] = useState<Tab>('search')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Leaf className="w-5 h-5 text-emerald-600" />
        <div>
          <h2 className="text-lg font-semibold">International EPD System</h2>
          <p className="text-sm text-muted-foreground">
            Search environdec.com and ingest only the EPDs you need — machine-readable, no AI cost.
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {([
          { id: 'search', label: 'Search & ingest', icon: Search },
          { id: 'watches', label: 'Watches', icon: Bell },
          { id: 'queue', label: 'Queue', icon: Inbox },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setError(''); setNotice('') }}
            className={cn('flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
              tab === id ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-50 text-emerald-800 text-sm border border-emerald-200">
          <CheckCircle className="w-4 h-4 shrink-0" />{notice}
        </div>
      )}

      {tab === 'search' && <SearchTab onIngested={onIngested} setError={setError} setNotice={setNotice} />}
      {tab === 'watches' && <WatchesTab setError={setError} setNotice={setNotice} />}
      {tab === 'queue' && <QueueTab onIngested={onIngested} setError={setError} setNotice={setNotice} />}
    </div>
  )
}

// Summarize a non-committed / committed ingest response into a user notice.
function ingestNotice(r: EnvirondecIngestResponse): string {
  const bits: string[] = []
  if (r.committed && r.commit_summary) {
    bits.push(`Committed ${String(r.commit_summary.approved ?? 0)} record(s) to the database`)
    const conflicts = Number(r.commit_summary.conflicts_flagged ?? 0)
    if (conflicts) bits.push(`${conflicts} conflict(s) flagged`)
  } else if (r.ingested > 0) {
    bits.push(`${r.ingested} EPD(s) added to a review session`)
  }
  if (r.skipped > 0) {
    const reasons = r.results.filter(x => x.status !== 'ingestible')
    const already = reasons.filter(x => x.status === 'already_in_efdb').length
    const noData = reasons.filter(x => x.status === 'no_dataset' || x.status === 'no_gwp').length
    const parts: string[] = []
    if (already) parts.push(`${already} already in EFDB`)
    if (noData) parts.push(`${noData} PDF-only (no machine-readable data)`)
    bits.push(`skipped ${r.skipped}${parts.length ? ` (${parts.join(', ')})` : ''}`)
  }
  return bits.join(' · ')
}

const inputCls = 'w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const btnPrimary = 'h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2'
const btnGhost = 'h-9 px-4 rounded-md border border-input text-sm hover:bg-muted/50 disabled:opacity-50 flex items-center gap-2'

interface TabProps { setError: (s: string) => void; setNotice: (s: string) => void }

// ── Search tab ──────────────────────────────────────────────────────────────
function SearchTab({ onIngested, setError, setNotice }: TabProps & { onIngested: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [owner, setOwner] = useState('')
  const [geo, setGeo] = useState('')
  const [classific, setClassific] = useState('')
  const [hits, setHits] = useState<EnvirondecHit[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [searched, setSearched] = useState(false)

  const runSearch = async () => {
    if (!query.trim() && !owner.trim()) { setError('Enter a product name or manufacturer to search.'); return }
    setLoading(true); setError(''); setNotice(''); setSelected(new Set())
    try {
      const res = await environdecApi.search({
        query: query.trim() || undefined, owner: owner.trim() || undefined,
        geo: geo.trim() || undefined, classific: classific.trim() || undefined, page_size: 50,
      })
      setHits(res.hits); setTotal(res.total); setSearched(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Search failed') }
    finally { setLoading(false) }
  }

  const toggle = (uuid: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(uuid) ? s.delete(uuid) : s.add(uuid); return s })

  const selectableHits = hits.filter(h => h.uuid && !h.already_in_efdb)
  const allSelected = selectableHits.length > 0 && selectableHits.every(h => selected.has(h.uuid!))

  const ingest = async (autoCommit: boolean) => {
    const chosen = hits.filter(h => h.uuid && selected.has(h.uuid))
    if (chosen.length === 0) return
    setIngesting(true); setError(''); setNotice('')
    try {
      const res = await environdecApi.ingest({ hits: chosen.map(h => h.raw), auto_commit: autoCommit })
      setNotice(ingestNotice(res))
      if (!res.committed && res.session_id) { onIngested(res.session_id); return }
      // committed or nothing ingestible → refresh dedup flags
      setSelected(new Set())
      await runSearch()
    } catch (e) { setError(e instanceof Error ? e.message : 'Ingest failed') }
    finally { setIngesting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Product name — e.g. cement, plasterboard" value={query}
          onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()} />
        <input className={inputCls} placeholder="Manufacturer / owner — e.g. Holcim" value={owner}
          onChange={e => setOwner(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()} />
        <input className={inputCls} placeholder="Country filter (ISO-2, e.g. SE) — optional" value={geo}
          onChange={e => setGeo(e.target.value)} />
        <input className={inputCls} placeholder="Category contains… — optional" value={classific}
          onChange={e => setClassific(e.target.value)} />
      </div>
      <button onClick={runSearch} disabled={loading} className={btnPrimary}>
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Searching…</> : <><Search className="w-4 h-4" />Search Data Hub</>}
      </button>

      {searched && (
        <div className="text-xs text-muted-foreground">
          {total.toLocaleString()} match{total !== 1 ? 'es' : ''} on environdec · showing {hits.length}
          {total > hits.length && ' — narrow your search to see more'}
        </div>
      )}

      {hits.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" className="accent-primary" checked={allSelected}
                onChange={e => setSelected(e.target.checked ? new Set(selectableHits.map(h => h.uuid!)) : new Set())} />
              Select all ingestible ({selectableHits.length})
            </label>
            <div className="flex gap-2">
              <button onClick={() => ingest(false)} disabled={ingesting || selected.size === 0} className={btnGhost}>
                {ingesting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Ingest {selected.size} → review
              </button>
              <button onClick={() => ingest(true)} disabled={ingesting || selected.size === 0} className={btnPrimary}>
                {ingesting ? <><Loader2 className="w-4 h-4 animate-spin" />Ingesting…</> : `Ingest ${selected.size} + auto-commit`}
              </button>
            </div>
          </div>

          <div className="border border-border rounded-lg divide-y divide-border max-h-[420px] overflow-auto">
            {hits.map(h => {
              const disabled = !h.uuid || h.already_in_efdb
              return (
                <label key={h.uuid ?? h.regNo} className={cn('flex items-start gap-3 p-3 text-sm',
                  disabled ? 'opacity-60' : 'cursor-pointer hover:bg-muted/30')}>
                  <input type="checkbox" className="mt-1 accent-primary" disabled={disabled}
                    checked={!!h.uuid && selected.has(h.uuid)} onChange={() => h.uuid && toggle(h.uuid)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{h.name?.trim() || '—'}</span>
                      {h.already_in_efdb && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">In EFDB</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">{h.registration_number || h.regNo}</span>
                      {h.geo && <span className="px-1.5 py-0.5 rounded bg-muted">{h.geo}</span>}
                      {h.classific && <span className="px-1.5 py-0.5 rounded bg-muted truncate max-w-[220px]">{h.classific}</span>}
                      {h.owner && <span>· {h.owner}</span>}
                      {h.validUntil && <span>· valid to {h.validUntil}</span>}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Only EPDs with a machine-readable dataset (A1–A3 GWP + declared unit) can be ingested. PDF-only declarations are reported and skipped.
          </p>
        </>
      )}
    </div>
  )
}

// ── Watches tab ─────────────────────────────────────────────────────────────
function WatchesTab({ setError, setNotice }: TabProps) {
  const [watches, setWatches] = useState<EnvirondecWatch[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', query: '', owner: '', geo: '', classific: '', mode: 'queue' })

  const load = useCallback(async () => {
    setLoading(true)
    try { setWatches(await environdecApi.listWatches()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load watches') }
    finally { setLoading(false) }
  }, [setError])

  useEffect(() => { void load() }, [load])

  const create = async () => {
    if (!form.name.trim()) { setError('Name your watch.'); return }
    if (!form.query && !form.owner && !form.geo && !form.classific) { setError('Add at least one criterion.'); return }
    try {
      await environdecApi.createWatch({
        name: form.name.trim(), query: form.query || undefined, owner: form.owner || undefined,
        geo: form.geo || undefined, classific: form.classific || undefined, mode: form.mode,
      })
      setForm({ name: '', query: '', owner: '', geo: '', classific: '', mode: 'queue' })
      setShowForm(false); setNotice('Watch created.'); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Create failed') }
  }

  const run = async (id: string) => {
    setBusyId(id); setError(''); setNotice('')
    try {
      const r = await environdecApi.runWatch(id)
      setNotice(`Found ${r.new_found} new EPD(s) — queued ${r.queued}, auto-ingested ${r.auto_ingested}.`)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Run failed') }
    finally { setBusyId(null) }
  }

  const toggle = async (w: EnvirondecWatch) => {
    try { await environdecApi.updateWatch(w.id, { enabled: !w.enabled }); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Update failed') }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this watch and its queued items?')) return
    try { await environdecApi.deleteWatch(id); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Delete failed') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Saved searches. A scheduled job surfaces newly-published EPDs — queued for review, or auto-ingested.
        </p>
        <button onClick={() => setShowForm(v => !v)} className={btnGhost}><Plus className="w-4 h-4" />New watch</button>
      </div>

      {showForm && (
        <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
          <input className={inputCls} placeholder="Watch name — e.g. Indian cement EPDs" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} placeholder="Product name (query)" value={form.query} onChange={e => setForm({ ...form, query: e.target.value })} />
            <input className={inputCls} placeholder="Manufacturer / owner" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} />
            <input className={inputCls} placeholder="Country (ISO-2)" value={form.geo} onChange={e => setForm({ ...form, geo: e.target.value })} />
            <input className={inputCls} placeholder="Category contains…" value={form.classific} onChange={e => setForm({ ...form, classific: e.target.value })} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground">On new match:</label>
            <select className="h-9 px-3 rounded-md border border-input bg-background text-sm" value={form.mode}
              onChange={e => setForm({ ...form, mode: e.target.value })}>
              <option value="queue">Queue for review</option>
              <option value="auto">Auto-ingest to review session</option>
            </select>
            <button onClick={create} className={btnPrimary}>Create watch</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
      ) : watches.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No watches yet.</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {watches.map(w => (
            <div key={w.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{w.name}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border',
                    w.mode === 'auto' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200')}>
                    {w.mode === 'auto' ? 'auto-ingest' : 'queue'}
                  </span>
                  {!w.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">paused</span>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {[w.query && `“${w.query}”`, w.owner && `owner: ${w.owner}`, w.geo, w.classific].filter(Boolean).join(' · ') || 'no criteria'}
                  {' · '}{w.seen_count} seen · {w.pending_count} pending
                  {w.last_checked_at && ` · checked ${new Date(w.last_checked_at).toLocaleDateString()}`}
                </div>
              </div>
              <button onClick={() => run(w.id)} disabled={busyId === w.id} className={btnGhost} title="Run now">
                {busyId === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              </button>
              <button onClick={() => toggle(w)} className="text-xs text-muted-foreground hover:text-foreground px-2">
                {w.enabled ? 'Pause' : 'Resume'}
              </button>
              <button onClick={() => remove(w.id)} className="text-muted-foreground hover:text-destructive p-1" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Queue tab ───────────────────────────────────────────────────────────────
function QueueTab({ onIngested, setError, setNotice }: TabProps & { onIngested: (id: string) => void }) {
  const [items, setItems] = useState<EnvirondecQueueItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [ingesting, setIngesting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await environdecApi.listQueue()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load queue') }
    finally { setLoading(false) }
  }, [setError])

  useEffect(() => { void load() }, [load])

  const toggle = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const ingest = async (autoCommit: boolean) => {
    if (selected.size === 0) return
    setIngesting(true); setError(''); setNotice('')
    try {
      const res = await environdecApi.ingestQueue([...selected], autoCommit)
      setNotice(ingestNotice(res))
      if (!res.committed && res.session_id) { onIngested(res.session_id); return }
      setSelected(new Set()); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Ingest failed') }
    finally { setIngesting(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">EPDs surfaced by your watches, awaiting ingestion.</p>
        <div className="flex gap-2">
          <button onClick={() => ingest(false)} disabled={ingesting || selected.size === 0} className={btnGhost}>
            {ingesting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Ingest {selected.size} → review
          </button>
          <button onClick={() => ingest(true)} disabled={ingesting || selected.size === 0} className={btnPrimary}>
            Ingest {selected.size} + auto-commit
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Queue is empty. Watches will add new EPDs here.</p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border max-h-[420px] overflow-auto">
          {items.map(it => (
            <label key={it.id} className="flex items-start gap-3 p-3 text-sm cursor-pointer hover:bg-muted/30">
              <input type="checkbox" className="mt-1 accent-primary" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
              <div className="min-w-0 flex-1">
                <span className="font-medium">{it.product_name || '—'}</span>
                <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">{it.registration_number}</span>
                  {it.geo && <span className="px-1.5 py-0.5 rounded bg-muted">{it.geo}</span>}
                  {it.classific && <span className="px-1.5 py-0.5 rounded bg-muted truncate max-w-[220px]">{it.classific}</span>}
                  {it.owner && <span>· {it.owner}</span>}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
