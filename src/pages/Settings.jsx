import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Admin-only app settings.
export default function Settings() {
  const { isAdmin } = useAuth()
  const [months, setMonths] = useState(6)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('app_settings').select('cost_stale_months').eq('id', 1).single()
      .then(({ data }) => { if (data) setMonths(data.cost_stale_months) })
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/" replace />

  async function save(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('app_settings')
      .update({ cost_stale_months: Number(months) || 6, updated_at: new Date().toISOString() }).eq('id', 1)
    setBusy(false)
    setMsg(error ? { t: 'err', m: error.message } : { t: 'ok', m: 'Settings saved.' })
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold mb-1">Settings</h1>
      <p className="text-sm text-slate-500 mb-5">Administrative configuration.</p>
      <form onSubmit={save} className="card p-5 space-y-3">
        <h2 className="font-semibold text-sm">Cost freshness</h2>
        <div>
          <label className="label">Flag a product's cost as stale after (months)</label>
          <input type="number" min="1" className="input max-w-[160px]" value={months} onChange={(e) => setMonths(e.target.value)} />
          <p className="text-xs text-slate-400 mt-1">
            The Catalog shows a ⚠ amber date next to any cost older than this. Default 6 months.
          </p>
        </div>
        {msg && <div className={`text-sm ${msg.t === 'err' ? 'text-red-600' : 'text-green-700'}`}>{msg.m}</div>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      </form>
    </div>
  )
}
