// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE CLIENT — browser-side, anon key
// Calls go directly to the Supabase REST/Realtime endpoint (not via vite proxy).
// Env vars MUST be VITE_-prefixed to be exposed to the client bundle.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Surfaces a clear error at call sites instead of a cryptic createClient throw.
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured ? createClient(url, anonKey) : null;
