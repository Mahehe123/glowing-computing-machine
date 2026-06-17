import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Admin-only app settings.
export default function Settings() {
  const { isAdmin } = useAuth()
  const [months, setMonths] = useState(6)
  const [minMargin, setMinMargin] = useState(15)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('app_settings').select('cost_stale_months, min_margin_pct').eq('id', 1).single()
      .then(({ data }) => {
        if (!data) return
        setMonths(data.cost_stale_months)
        if (data.min_margin_pct != null) setMinMargin(data.min_margin_pct)
      })
  }, [isAdmin])

  if (!isAdmin) return <Navigate to="/" replace />

  async function save(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('app_settings')
      .update({
        cost_stale_months: Number(months) || 6,
        min_margin_pct: minMargin === '' ? 15 : Number(minMargin),
        updated_at: new Date().toISOString(),
      }).eq('id', 1)
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
        <h2 className="font-semibold text-sm pt-2">Margin threshold</h2>
        <div>
          <label className="label">Flag margins below (%)</label>
          <input type="number" min="0" max="95" step="0.1" className="input max-w-[160px]" value={minMargin} onChange={(e) => setMinMargin(e.target.value)} />
          <p className="text-xs text-slate-400 mt-1">
            Margins below this show in red on the Catalog and in the quotation editor. Default 15%.
          </p>
        </div>
        {msg && <div className={`text-sm ${msg.t === 'err' ? 'text-red-600' : 'text-green-700'}`}>{msg.m}</div>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      </form>
    </div>
  )
}
