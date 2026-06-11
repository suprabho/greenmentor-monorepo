import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { Upload, MessageSquare, LogOut, User, AlertTriangle, LogIn, PieChart } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { efApi } from '@/lib/api'

interface TopBarProps {
  onChatOpen: () => void
  onConflictsOpen?: () => void
}

export default function TopBar({ onChatOpen, onConflictsOpen }: TopBarProps) {
  const navigate = useNavigate()
  const { token, user, logout, isAdmin } = useAuthStore()

  const { data: conflictCount } = useQuery<number>({
    queryKey: ['conflicts-count'],
    queryFn: () => efApi.conflictsCount(),
    enabled: !!token,
    refetchInterval: 60_000,  // refresh every minute
    staleTime: 30_000,
  })

  return (
    <header className="h-12 border-b border-border bg-card flex items-center px-4 gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-[10px] font-bold">EF</span>
        </div>
        <span className="font-semibold text-sm tracking-tight">EFDB</span>
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/coverage')}
          className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium border border-border hover:bg-muted/50 transition-colors"
        >
          <PieChart className="w-3.5 h-3.5" />
          Coverage
        </button>
        {isAdmin() && (
          <button
            onClick={() => navigate('/ingest')}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
        )}
        {/* Conflict badge — only shown when there are flagged records */}
        {conflictCount != null && conflictCount > 0 && (
          <button
            onClick={onConflictsOpen}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
            title={`${conflictCount} records flagged for conflict review`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {conflictCount} Conflicts
          </button>
        )}
        {token && (
          <button
            onClick={onChatOpen}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium border border-border hover:bg-muted/50 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            AI Chat
          </button>
        )}
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border">
          {token ? (
            <>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span>{user?.full_name ?? user?.email}</span>
                <span className="px-1 py-0.5 rounded text-[10px] bg-muted font-medium uppercase tracking-wider">
                  {user?.role}
                </span>
              </div>
              <button
                onClick={() => { logout(); navigate('/login') }}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium border border-border hover:bg-muted/50 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
