import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fileToResizedDataURL } from '../lib/image'

const empty = {
  full_name: '', company_name: '', phone: '', email: '',
  address: '', logo_url: '', default_terms: '', signature: '',
}

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (profile) {
      // coalesce null DB columns to '' so inputs stay controlled
      const clean = Object.fromEntries(Object.entries(profile).map(([k, v]) => [k, v ?? '']))
      setForm({ ...empty, ...clean })
    } else if (user) setForm({ ...empty, email: user.email })
  }, [profile, user])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onLogo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await fileToResizedDataURL(file, 400)
      setForm((f) => ({ ...f, logo_url: dataUrl }))
    } catch (err) {
      setMsg({ type: 'err', text: err.message })
    }
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const payload = { id: user.id, ...form, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('profiles').upsert(payload)
    setBusy(false)
    if (error) setMsg({ type: 'err', text: error.message })
    else { setMsg({ type: 'ok', text: 'Profile saved.' }); refreshProfile() }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-1">My Profile</h1>
      <p className="text-sm text-slate-500 mb-5">
        Auto-filled into every quotation you create.
      </p>
      <form onSubmit={save} className="card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name" value={form.full_name} onChange={set('full_name')} />
          <Field label="Contact email" value={form.email} onChange={set('email')} />
          <Field label="Company name" value={form.company_name} onChange={set('company_name')} />
          <Field label="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <Field label="Company address" value={form.address} onChange={set('address')} textarea />
        <div className="col-span-2">
          <label className="label">Company logo (appears on every quotation)</label>
          <div className="flex items-center gap-4">
            <div className="w-28 h-16 border rounded-md flex items-center justify-center bg-slate-50 overflow-hidden">
              {form.logo_url
                ? <img src={form.logo_url} alt="logo" className="max-w-full max-h-full object-contain" />
                : <span className="text-xs text-slate-400">No logo</span>}
            </div>
            <div className="flex flex-col gap-2">
              <input type="file" accept="image/*" onChange={onLogo} className="text-sm" />
              {form.logo_url && (
                <button type="button" className="text-xs text-red-600 hover:underline self-start" onClick={() => setForm((f) => ({ ...f, logo_url: '' }))}>
                  Remove logo
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">PNG/JPG. Auto-resized and stored with your profile — no extra setup.</p>
        </div>
        <Field label="Default quote terms & conditions" value={form.default_terms} onChange={set('default_terms')} textarea rows={4} />
        <Field label="Signature line (e.g. 'Prepared by')" value={form.signature} onChange={set('signature')} />
        {msg && <div className={`text-sm ${msg.type === 'err' ? 'text-red-600' : 'text-green-700'}`}>{msg.text}</div>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>
    </div>
  )
}

function Field({ label, textarea, rows = 2, ...props }) {
  return (
    <div className={textarea ? 'col-span-2' : ''}>
      <label className="label">{label}</label>
      {textarea ? <textarea className="input" rows={rows} {...props} /> : <input className="input" {...props} />}
    </div>
  )
}
