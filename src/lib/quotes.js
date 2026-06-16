import { supabase } from './supabase'

// Flip draft/sent quotes whose valid_until has passed to 'expired'.
// Best-effort on load; RLS limits it to the caller's own quotes (admins: all).
export async function sweepExpired() {
  const today = new Date().toISOString().slice(0, 10)
  try {
    await supabase.from('quotations').update({ status: 'expired' })
      .lt('valid_until', today).in('status', ['draft', 'sent'])
  } catch { /* non-critical */ }
}
