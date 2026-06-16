import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { parseCompetitorsWorkbook } from '../lib/xlsxImport'
import { useToast } from '../context/ToastContext'

const empty = {
  brand: '', model: '', type: '', loading_pressure: '', flow_m3min: '', flow_cfm: '',
  rated_kw: '', real_kw: '', noise_db: '', dimension: '', weight_kg: '', price_rm: '', is_inverter: false,
}
const numFields = ['loading_pressure', 'flow_m3min', 'flow_cfm', 'rated_kw', 'real_kw', 'noise_db', 'weight_kg', 'price_rm']

export default function CompetitorsModal({ onClose, onChanged }) {
  const { user } = useAuth()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [importMsg, setImportMsg] = useState(null)

  async function load() {
    const { data } = await supabase.from('competitors').select('*').order('brand').order('model')
    setRows(data || [])
    onChanged?.()
  }
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'is_inverter' ? e.target.checked : e.target.value }))
  function clean(f) {
    const o = { ...f }
    for (const k of numFields) o[k] = o[k] === '' ? null : Number(o[k])
    return o
  }

  async function save(e) {
    e.preventDefault()
    if (!form.brand || !form.model) return toast('Brand and Model are required.', 'warn')
    const payload = editing ? clean(form) : { ...clean(form), created_by: user.id }
    const q = editing
      ? supabase.from('competitors').update(payload).eq('id', editing)
      : supabase.from('competitors').insert(payload)
    const { error } = await q
    if (error) return toast(error.message, 'error')
    setForm(empty); setEditing(null); load()
  }

  function edit(c) {
    setEditing(c.id)
    setForm({ ...empty, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? (k === 'is_inverter' ? false : '')])) })
  }
  async function remove(id) {
    if (!confirm('Delete this competitor model?')) return
    const { error } = await supabase.from('competitors').delete().eq('id', id)
    if (error) toast(error.message, 'error'); else load()
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportMsg('Reading…')
    try {
      const { competitors, errors } = await parseCompetitorsWorkbook(file)
      if (!competitors.length) { setImportMsg('No rows found.'); return }
      const { error } = await supabase.from('competitors').insert(competitors.map((c) => ({ ...c, created_by: user.id })))
      if (error) throw error
      setImportMsg(`Imported ${competitors.length} competitor models.${errors.length ? ` (${errors.length} warnings)` : ''}`)
      load()
    } catch (err) { setImportMsg(err.message) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-3xl max-h-[88vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">Competitor models</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>

        <div className="flex items-center gap-3 mb-4 text-sm">
          <label className="btn-ghost cursor-pointer">
            Import competitor Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
          </label>
          {importMsg && <span className="text-xs text-slate-500">{importMsg}</span>}
        </div>

        <form onSubmit={save} className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 items-end">
          <Field label="Brand *" value={form.brand} onChange={set('brand')} />
          <Field label="Model *" value={form.model} onChange={set('model')} />
          <Field label="Type" value={form.type} onChange={set('type')} />
          <Field label="Pressure (bar)" type="number" value={form.loading_pressure} onChange={set('loading_pressure')} />
          <Field label="Flow m³/min" type="number" value={form.flow_m3min} onChange={set('flow_m3min')} />
          <Field label="Flow CFM" type="number" value={form.flow_cfm} onChange={set('flow_cfm')} />
          <Field label="Rated kW" type="number" value={form.rated_kw} onChange={set('rated_kw')} />
          <Field label="Real kW" type="number" value={form.real_kw} onChange={set('real_kw')} />
          <Field label="Noise dB" type="number" value={form.noise_db} onChange={set('noise_db')} />
          <Field label="Dimension (L x W x H mm)" value={form.dimension} onChange={set('dimension')} />
          <Field label="Weight kg" type="number" value={form.weight_kg} onChange={set('weight_kg')} />
          <Field label="Price RM" type="number" value={form.price_rm} onChange={set('price_rm')} />
          <label className="flex items-center gap-2 text-xs text-slate-600 mt-4">
            <input type="checkbox" checked={form.is_inverter} onChange={set('is_inverter')} /> Inverter / VSD
          </label>
          <div className="flex gap-2">
            <button className="btn-primary py-1.5">{editing ? 'Update' : 'Add'}</button>
            {editing && <button type="button" className="btn-ghost py-1.5" onClick={() => { setEditing(null); setForm(empty) }}>Cancel</button>}
          </div>
        </form>

        <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
          {rows.length === 0 && <div className="p-3 text-sm text-slate-400">No competitor models yet.</div>}
          {rows.map((c) => (
            <div key={c.id} className="p-2.5 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium">{c.brand} {c.model}</span>
                <span className="text-xs text-slate-400 ml-2">
                  {[c.type, c.rated_kw && `${c.rated_kw}kW`, c.flow_m3min && `${c.flow_m3min} m³/min`, c.is_inverter && 'VSD'].filter(Boolean).join(' · ')}
                </span>
              </div>
              <div className="flex gap-2 text-xs">
                <button className="text-brand hover:underline" onClick={() => edit(c)}>Edit</button>
                <button className="text-red-600 hover:underline" onClick={() => remove(c.id)}>Del</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Field({ label, type = 'text', ...props }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input py-1" {...props} />
    </div>
  )
}
