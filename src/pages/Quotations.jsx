import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { RM, fmtDate, daysBetween } from '../lib/format'
import { STATUS_META, STATUSES } from '../lib/status'

export default function Quotations() {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')

  async function load() {
    const { data } = await supabase
      .from('quotations')
      .select('*, customers(company)')
      .order('quote_date', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  async function setQuoteStatus(id, s) {
    await supabase.from('quotations').update({ status: s }).eq('id', id)
    load()
  }
  async function remove(id) {
    if (!confirm('Delete this quotation?')) return
    await supabase.from('quotations').delete().eq('id', id)
    load()
  }

  const filtered = rows.filter((r) =>
    (!status || r.status === status) &&
    (!q || `${r.quote_no} ${r.customers?.company || ''}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Quotations</h1>
        <Link to="/quotes/new" className="btn-primary">+ New Quote</Link>
      </div>
      <div className="flex gap-2 mb-3">
        <input className="input max-w-xs" placeholder="Search quote / customer…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[160px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left p-3">Quote</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Valid</th>
              <th className="text-right p-3">Total</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r) => {
              const expSoon = r.valid_until && ['draft', 'sent'].includes(r.status) && daysBetween(new Date(), r.valid_until) <= 7
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3"><Link to={`/quotes/${r.id}`} className="text-brand font-medium hover:underline">{r.quote_no}</Link></td>
                  <td className="p-3">{r.customers?.company || <span className="text-slate-400">—</span>}</td>
                  <td className="p-3">{fmtDate(r.quote_date)}</td>
                  <td className="p-3">
                    {fmtDate(r.valid_until)}
                    {expSoon && <span className="badge bg-amber-100 text-amber-700 ml-1">soon</span>}
                  </td>
                  <td className="p-3 text-right font-medium">{RM(r.total)}</td>
                  <td className="p-3">
                    <select value={r.status} onChange={(e) => setQuoteStatus(r.id, e.target.value)}
                      className={`badge border-0 ${STATUS_META[r.status]?.cls}`}>
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                    </select>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => remove(r.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">No quotations.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
