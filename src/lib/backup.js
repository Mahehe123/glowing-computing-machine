import { supabase } from './supabase'

// Full data backup -> downloads a single JSON file to the user's computer.
// They then upload it to Google Drive (off-platform, version-historied copy).
// Admin reads every table (allowed by RLS); restore is possible from this file.
const TABLES = ['profiles', 'products', 'customers', 'quotations', 'quotation_items']
const LAST_BACKUP_KEY = 'airquote_last_backup'

export const getLastBackup = () => {
  const v = localStorage.getItem(LAST_BACKUP_KEY)
  return v ? new Date(v) : null
}

export async function downloadBackup() {
  const data = { app: 'AirQuote', exported_at: new Date().toISOString(), tables: {} }
  const counts = {}

  for (const t of TABLES) {
    const { data: rows, error } = await supabase.from(t).select('*')
    if (error) throw new Error(`${t}: ${error.message}`)
    data.tables[t] = rows
    counts[t] = rows.length
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `airquote-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())
  return counts
}
