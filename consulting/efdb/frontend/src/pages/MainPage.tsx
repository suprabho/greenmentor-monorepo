import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import TopBar from '@/components/layout/TopBar'
import FilterBar from '@/components/table/FilterBar'
import EFTable from '@/components/table/EFTable'
import SidePanel from '@/components/table/SidePanel'
import ChatPanel from '@/components/chat/ChatPanel'
import type { EmissionFactor, EFFilters } from '@/types/emission-factor'
import { efApi } from '@/lib/api'

const DEFAULT_FILTERS: EFFilters = {
  sort_by: 'confidence_score',
  sort_dir: 'desc',
  page: 1,
  page_size: 50,
}

export default function MainPage() {
  const [filters, setFilters] = useState<EFFilters>(DEFAULT_FILTERS)
  const [selectedEF, setSelectedEF] = useState<EmissionFactor | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['emission-factors', filters],
    queryFn: () => efApi.list(filters),
  })

  const handleFiltersChange = useCallback((f: EFFilters) => {
    setFilters(f)
    setSelectedEF(null)
  }, [])

  const handleSelect = useCallback((ef: EmissionFactor) => {
    setSelectedEF(ef)
    setChatOpen(false)
  }, [])

  const handleUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['emission-factors'] })
    setSelectedEF(null)
  }, [queryClient])

  const handleConflictsOpen = useCallback(() => {
    setFilters(f => ({ ...DEFAULT_FILTERS, conflicts_only: !f.conflicts_only }))
    setSelectedEF(null)
    setChatOpen(false)
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar
        onChatOpen={() => { setChatOpen(v => !v); setSelectedEF(null) }}
        onConflictsOpen={handleConflictsOpen}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <FilterBar filters={filters} onChange={handleFiltersChange} />

        <div className="flex-1 flex min-h-0">
          {/* Main table */}
          <div className="flex-1 min-w-0 min-h-0">
            <EFTable
              data={data?.items ?? []}
              total={data?.total ?? 0}
              filters={filters}
              onFiltersChange={setFilters}
              selectedId={selectedEF?.id ?? null}
              onSelect={handleSelect}
              isLoading={isLoading}
            />
          </div>

          {/* Side panel */}
          {selectedEF && (
            <SidePanel
              ef={selectedEF}
              onClose={() => setSelectedEF(null)}
              onUpdated={handleUpdated}
            />
          )}

          {/* Chat panel */}
          {chatOpen && (
            <ChatPanel onClose={() => setChatOpen(false)} />
          )}
        </div>
      </div>
    </div>
  )
}
