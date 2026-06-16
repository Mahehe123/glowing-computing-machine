import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pct } from '../lib/format'
import { categoryOf, sortCategories } from '../lib/categories'
import SpecModal from '../components/SpecModal'

// Pull display specs from the family-scoped JSONB (compressors use Loading Pressure;
// flow lives in core cfm_max for compressors, or specs for dryers/filters).
const loadingPressure = (p) => p.specs?.['Loading Pressure'] ?? null
const flowCfm = (p) => p.cfm_max ?? p.specs?.['Flow, cfm'] ?? p.specs?.['filter, cfm'] ?? null
const dash = (v, suffix = '') => (v === null || v === undefined || v === '' ? '—' : `${v}${suffix}`)

// Product catalog admin: edit selling price + cost (cost is internal, never on a quote PDF).
export default function Catalog() {
  const [rows, setRows] = useState([])
  const [edits, setEdits] = useState({}) // id -> {price_rm, cost_rm}
  const [saving, setSaving] = useState(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [specProduct, setSpecProduct] = useState(null)

  async function load() {
    const { data } = await supabase.from('products').select('*').order('series').order('model')
    setRows(data || [])
    setEdits({})
  }
  useEffect(() => { load() }, [])

  const setVal = (id, key, v) =>
    setEdits((e) => ({ ...e, [id]: { ...e[id], [key]: v } }))

  function valueOf(r, key) {
    const e = edits[r.id]
    if (e && e[key] !== undefined) return e[key]
    return r[key] ?? ''
  }

  async function save(r) {
    const e = edits[r.id]
    if (!e) return
    setSaving(r.id)
    const patch = {}
    if (e.price_rm !== undefined) patch.price_rm = Number(e.price_rm) || 0
    if (e.cost_rm !== undefined) patch.cost_rm = Number(e.cost_rm) || 0
    if (e.lead_time_weeks !== undefined) patch.lead_time_weeks = e.lead_time_weeks === '' ? null : Number(e.lead_time_weeks)
    const { error } = await supabase.from('products').update(patch).eq('id', r.id)
    setSaving(null)
    if (error) return alert(error.message)
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...patch } : x)))
    setEdits((s) => { const c = { ...s }; delete c[r.id]; return c })
  }

  const categories = useMemo(() => sortCategories([...new Set(rows.map(categoryOf))]), [rows])
  const filtered = useMemo(
    () => rows.filter((r) =>
      (!cat || categoryOf(r) === cat) &&
      `${r.model} ${r.series} ${r.type}`.toLowerCase().includes(q.toLowerCase())),
    [rows, q, cat],
  )

  const margin = (r) => {
    const p = Number(valueOf(r, 'price_rm')) || 0
    const c = Number(valueOf(r, 'cost_rm')) || 0
    if (!p || !c) return null
    return ((p - c) / p) * 100
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Product Catalog</h1>
      <p className="text-sm text-slate-500 mb-4">
        Set the <b>selling price</b> (shown to customers) and your <b>cost</b> (internal only —
        powers the margin charts on the dashboard, never appears on a quote).
      </p>
      <div className="flex gap-2 mb-3">
        <input className="input max-w-xs" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[220px]" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left p-3">Model</th>
              <th className="text-left p-3">Category</th>
              <th className="text-right p-3">Loading pressure</th>
              <th className="text-right p-3">Flow (CFM)</th>
              <th className="text-right p-3">Selling (RM)</th>
              <th className="text-right p-3">Cost (RM)</th>
              <th className="text-right p-3">Margin</th>
              <th className="text-right p-3">Lead (wks)</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((r) => {
              const m = margin(r)
              const dirty = !!edits[r.id]
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3"><div className="font-medium">{r.model}</div><div className="text-xs text-slate-400">{r.type}</div></td>
                  <td className="p-3"><span className="badge bg-brand-light text-brand">{categoryOf(r)}</span> <span className="text-xs text-slate-400">{r.series}</span></td>
                  <td className="p-3 text-right text-slate-600">{dash(loadingPressure(r), ' bar')}</td>
                  <td className="p-3 text-right text-slate-600">{dash(flowCfm(r))}</td>
                  <td className="p-3 text-right">
                    <input type="number" className="input py-1 w-28 text-right ml-auto"
                      value={valueOf(r, 'price_rm')} onChange={(e) => setVal(r.id, 'price_rm', e.target.value)} />
                  </td>
                  <td className="p-3 text-right">
                    <input type="number" className="input py-1 w-28 text-right ml-auto" placeholder="—"
                      value={valueOf(r, 'cost_rm')} onChange={(e) => setVal(r.id, 'cost_rm', e.target.value)} />
                  </td>
                  <td className={`p-3 text-right font-medium ${m === null ? 'text-slate-300' : m < 15 ? 'text-red-600' : 'text-green-700'}`}>
                    {m === null ? '—' : pct(m)}
                  </td>
                  <td className="p-3 text-right">
                    <input type="number" className="input py-1 w-16 text-right ml-auto" placeholder="—"
                      value={valueOf(r, 'lead_time_weeks')} onChange={(e) => setVal(r.id, 'lead_time_weeks', e.target.value)} />
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button className="btn-ghost py-1 px-2 text-xs mr-1" onClick={() => setSpecProduct(r)}>Specs</button>
                    <button className="btn-primary py-1 px-2 text-xs disabled:opacity-40"
                      disabled={!dirty || saving === r.id} onClick={() => save(r)}>
                      {saving === r.id ? '…' : 'Save'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-400">No products.</td></tr>}
          </tbody>
        </table>
      </div>
      <SpecModal product={specProduct} onClose={() => setSpecProduct(null)} />
    </div>
  )
}
