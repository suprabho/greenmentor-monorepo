import type { EFFilters, EFListResponse, EmissionFactor, ScanResult, SessionStatus, ReviewSummary, User, DocumentMetadata } from '@/types/emission-factor'

const BASE = '/api'

function authHeader(): HeadersInit {
  const token = localStorage.getItem('efdb_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>('/auth/me'),
}

// ── Emission factors ──────────────────────────────────────────────────────
export const efApi = {
  list: (filters: EFFilters = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    })
    return request<EFListResponse>(`/emission-factors?${params}`)
  },

  // Unauthenticated listing — backend only accepts a subset of filters.
  listPublic: (filters: EFFilters = {}) => {
    const ALLOWED = ['q', 'country', 'scope', 'species', 'sort_by', 'sort_dir', 'page', 'page_size'] as const
    const params = new URLSearchParams()
    for (const k of ALLOWED) {
      const v = filters[k]
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    }
    return request<EFListResponse>(`/emission-factors/public?${params}`)
  },

  semanticSearch: (q: string, year?: number, country?: string, maxDqScore?: number) => {
    const params = new URLSearchParams({ q })
    if (year) params.set('year', String(year))
    if (country) params.set('country', country)
    if (maxDqScore) params.set('max_dq_score', String(maxDqScore))
    return request<EFListResponse>(`/emission-factors/search/semantic?${params}`)
  },

  get: (id: string) => request<EmissionFactor>(`/emission-factors/${id}`),

  update: (id: string, data: Record<string, unknown>) =>
    request<EmissionFactor>(`/emission-factors/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  supersede: (id: string, reason: string) =>
    request<EmissionFactor>(`/emission-factors/${id}/supersede`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getVersions: (id: string) => request<unknown[]>(`/emission-factors/${id}/versions`),
  getConflicts: (id: string) => request<unknown[]>(`/emission-factors/${id}/conflicts`),
  getAuditLog: (id: string) => request<unknown[]>(`/emission-factors/${id}/audit-log`),
  resolveConflict: (id: string, resolutionNote?: string) =>
    request<EmissionFactor>(`/emission-factors/${id}/resolve-conflict`, {
      method: 'POST',
      body: JSON.stringify({ resolution_note: resolutionNote ?? '' }),
    }),
  conflictsCount: () =>
    request<{ total: number }>(`/emission-factors?conflicts_only=true&page_size=1&page=1`)
      .then(r => r.total),

  restoreVersion: (id: string, version: number) =>
    request<EmissionFactor>(`/emission-factors/${id}/restore-version/${version}`, { method: 'POST' }),

  exportCsv: (filters: EFFilters = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
    })
    return fetch(`${BASE}/emission-factors/export/csv?${params}`, { headers: authHeader() as Record<string, string> })
  },
}

// ── Ingestion ─────────────────────────────────────────────────────────────
export const ingestionApi = {
  uploadAndScan: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const r = await fetch(`${BASE}/ingestion/upload/scan`, {
      method: 'POST',
      headers: authHeader() as Record<string, string>,
      body: form,
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }))
      throw new Error(err.detail ?? `HTTP ${r.status}`)
    }
    return r.json() as Promise<ScanResult>
  },

  urlScan: async (url: string) => {
    const form = new FormData()
    form.append('url', url)
    const r = await fetch(`${BASE}/ingestion/url/scan`, {
      method: 'POST',
      headers: authHeader() as Record<string, string>,
      body: form,
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }))
      throw new Error(err.detail ?? `HTTP ${r.status}`)
    }
    return r.json() as Promise<ScanResult>
  },

  startExtraction: (sessionId: string, sectionIndices: number[], confirmedMetadata?: DocumentMetadata | null) =>
    request(`/ingestion/sessions/${sessionId}/extract`, {
      method: 'POST',
      body: JSON.stringify({ section_indices: sectionIndices, confirmed_metadata: confirmedMetadata ?? null }),
    }),

  getSession: (sessionId: string) =>
    request<SessionStatus>(`/ingestion/sessions/${sessionId}`),

  getRecords: (sessionId: string, page = 1, pageSize = 50) =>
    request(`/ingestion/sessions/${sessionId}/records?page=${page}&page_size=${pageSize}`),

  reviewRecord: (sessionId: string, index: number, action: string, editedData?: Record<string, unknown>, rejectionReason?: string) =>
    request(`/ingestion/sessions/${sessionId}/review/${index}`, {
      method: 'POST',
      body: JSON.stringify({ action, edited_data: editedData, rejection_reason: rejectionReason }),
    }),

  bulkReview: (sessionId: string, action: string, indices?: number[], rejectionReason?: string) =>
    request(`/ingestion/sessions/${sessionId}/review/bulk`, {
      method: 'POST',
      body: JSON.stringify({ action, indices, rejection_reason: rejectionReason }),
    }),

  commit: (sessionId: string) =>
    request<ReviewSummary>(`/ingestion/sessions/${sessionId}/commit`, { method: 'POST' }),
}

// ── Chat ──────────────────────────────────────────────────────────────────
export const chatApi = {
  stream: async (
    messages: { role: string; content: string }[],
    minConfidence: number | undefined,
    onChunk: (text: string) => void,
  ) => {
    const res = await fetch(`${BASE}/chat/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader() as Record<string, string>),
      },
      body: JSON.stringify({ messages, min_confidence: minConfidence }),
    })
    if (!res.ok) throw new Error(`Chat error: ${res.statusText}`)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.content) onChunk(data.content)
          } catch {}
        }
      }
    }
  },
}
