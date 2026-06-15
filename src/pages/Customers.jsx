import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RM, fmtDate } from '../lib/format'
import { STATUS_META } from '../lib/status'

const empty = { company: '', contact_person: '', email: '', phone: '', address: '' }

export default function Customers() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [quotes, setQuotes] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState(null) // customer whose quotes are shown

  async function load() {
    const [{ data: cust }, { data: qts }] = await Promise.all([
      supabase.from('customers').select('*').order('company'),
      supabase.from('quotations').select('id, quote_no, customer_id, status, total, quote_date').order('quote_date', { ascending: false }),
    ])
    setRows(cust || [])
    setQuotes(qts || [])
  }
  useEffect(() => { load() }, [])

  // customer_id -> { count, quoted, won, list }
  const stats = useMemo(() => {
    const m = {}
    for (const qt of quotes) {
      if (!qt.customer_id) continue
      const s = (m[qt.customer_id] ||= { count: 0, quoted: 0, won: 0, list: [] })
      s.count++
      s.quoted += Number(qt.total) || 0
      if (qt.status === 'won') s.won += Number(qt.total) || 0
      s.list.push(qt)
    }
    return m
  }, [quotes])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    const payload = editing ? { ...form } : { ...form, created_by: user.id }
    const query = editing
      ? supabase.from('customers').update(payload).eq('id', editing)
      : supabase.from('customers').insert(payload)
    const { error } = await query
    setBusy(false)
    if (!error) { setForm(empty); setEditing(null); load() }
    else alert(error.message)
  }

  function edit(c) { setEditing(c.id); setForm({ company: c.company, contact_person: c.contact_person || '', email: c.email || '', phone: c.phone || '', address: c.address || '' }) }

  async function remove(id) {
    if (!confirm('Delete this customer?')) return
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) alert(error.message); else load()
  }

  const filtered = rows.filter((c) =>
    (c.company + c.contact_person + c.email).toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Customers</h1>
      <p className="text-sm text-slate-500 mb-5">Shared across the whole team.</p>
      <div className="grid md:grid-cols-3 gap-6">
        <form onSubmit={save} className="card p-4 space-y-3 md:col-span-1 h-fit">
          <h2 className="font-semibold text-sm">{editing ? 'Edit customer' : 'Add customer'}</h2>
          <Input label="Company *" value={form.company} onChange={set('company')} required />
          <Input label="Contact person" value={form.contact_person} onChange={set('contact_person')} />
          <Input label="Email" value={form.email} onChange={set('email')} />
          <Input label="Phone" value={form.phone} onChange={set('phone')} />
          <div>
            <label className="label">Address</label>
            <textarea className="input" rows={2} value={form.address} onChange={set('address')} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>{editing ? 'Update' : 'Add'}</button>
            {editing && <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setForm(empty) }}>Cancel</button>}
          </div>
        </form>

        <div className="md:col-span-2">
          <input className="input mb-3" placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="card divide-y">
            {filtered.length === 0 && <div className="p-4 text-sm text-slate-400">No customers yet.</div>}
            {filtered.map((c) => {
              const s = stats[c.id] || { count: 0, quoted: 0, won: 0 }
              return (
                <div key={c.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{c.company}</div>
                    <div className="text-xs text-slate-500">
                      {[c.contact_person, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div className="text-xs mt-1 flex gap-3">
                      <span className="text-slate-500">{s.count} quote{s.count === 1 ? '' : 's'}</span>
                      <span className="text-slate-500">Quoted: <b>{RM(s.quoted)}</b></span>
                      <span className="text-green-700">Won: <b>{RM(s.won)}</b></span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs whitespace-nowrap">
                    <button className="text-brand hover:underline disabled:text-slate-300" disabled={!s.count} onClick={() => setViewing(c)}>View quotes</button>
                    <button className="text-slate-500 hover:underline" onClick={() => edit(c)}>Edit</button>
                    <button className="text-red-600 hover:underline" onClick={() => remove(c.id)}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold">{viewing.company}</h2>
                <div className="text-xs text-slate-500">{(stats[viewing.id]?.count || 0)} quotations · Quoted {RM(stats[viewing.id]?.quoted)} · Won {RM(stats[viewing.id]?.won)}</div>
              </div>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
            </div>
            <div className="divide-y">
              {(stats[viewing.id]?.list || []).map((qt) => (
                <div key={qt.id} className="py-2 flex items-center justify-between text-sm">
                  <Link to={`/quotes/${qt.id}`} className="text-brand hover:underline">{qt.quote_no}</Link>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{fmtDate(qt.quote_date)}</span>
                    <span className={`badge ${STATUS_META[qt.status]?.cls}`}>{STATUS_META[qt.status]?.label}</span>
                    <span className="font-medium w-24 text-right">{RM(qt.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Input({ label, ...props }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" {...props} />
    </div>
  )
}
