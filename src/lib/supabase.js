import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  // Don't crash the whole app — the UI shows a friendly setup message instead.
  console.warn(
    'Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
  )
}

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
