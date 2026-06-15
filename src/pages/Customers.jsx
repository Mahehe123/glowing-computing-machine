import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const empty = { company: '', contact_person: '', email: '', phone: '', address: '' }

export default function Customers() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase.from('customers').select('*').order('company')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    const payload = editing
      ? { ...form }
      : { ...form, created_by: user.id }
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
            {filtered.map((c) => (
              <div key={c.id} className="p-3 flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm">{c.company}</div>
                  <div className="text-xs text-slate-500">
                    {[c.contact_person, c.email, c.phone].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <button className="text-brand hover:underline" onClick={() => edit(c)}>Edit</button>
                  <button className="text-red-600 hover:underline" onClick={() => remove(c.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
