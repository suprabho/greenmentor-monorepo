import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Supabase is only the OAuth broker (Google sign-in). The app session itself
// is the backend-issued EFDB JWT — the Supabase session is discarded right
// after the /auth/oauth exchange, so nothing else should depend on it.
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, { auth: { flowType: 'pkce' } })
    : null
