import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

// Supabase redirects with ?error=...&error_description=... (or in the hash)
// when the provider flow fails or the user cancels.
function redirectError(): string | null {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  return search.get('error_description') ?? hash.get('error_description') ?? null
}

// supabase-js parses the redirect URL during client init; the session can land
// a moment after mount, so fall back to onAuthStateChange with a timeout.
async function waitForSession(): Promise<Session | null> {
  const { data } = await supabase!.auth.getSession()
  if (data.session) return data.session
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      sub.subscription.unsubscribe()
      resolve(null)
    }, 8000)
    const { data: sub } = supabase!.auth.onAuthStateChange((_event, session) => {
      if (session) {
        clearTimeout(timer)
        sub.subscription.unsubscribe()
        resolve(session)
      }
    })
  })
}

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const fail = (message: string) => {
      supabase?.auth.signOut({ scope: 'local' }).catch(() => {})
      navigate('/login', { replace: true, state: { error: message } })
    }

    if (!supabase) {
      fail('Google sign-in is not configured')
      return
    }
    const providerError = redirectError()
    if (providerError) {
      fail(providerError)
      return
    }

    ;(async () => {
      const session = await waitForSession()
      if (!session) {
        fail('Google sign-in failed — no session returned')
        return
      }
      try {
        const { access_token, user } = await authApi.oauthLogin(session.access_token)
        // The Supabase session has served its purpose; only the EFDB JWT matters.
        await supabase!.auth.signOut({ scope: 'local' }).catch(() => {})
        setAuth(access_token, user)
        navigate('/', { replace: true })
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Sign-in failed')
      }
    })()
  }, [navigate, setAuth])

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
    </div>
  )
}
