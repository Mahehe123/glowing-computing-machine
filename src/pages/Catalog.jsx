import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pct, fmtDate } from '../lib/format'
import { categoryOf, sortCategories } from '../lib/categories'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import SpecModal from '../components/SpecModal'
import ImportModal from '../components/ImportModal'
import AddProductModal from '../components/AddProductModal'

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
  const [showImport, setShowImport] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [staleMonths, setStaleMonths] = useState(6)
  const { isAdmin, profile } = useAuth()
  const toast = useToast()
  const company = profile?.company_name || 'Our brand'

  async function load() {
    const [{ data }, { data: s }] = await Promise.all([
      supabase.from('products').select('*').order('series').order('model'),
      supabase.from('app_settings').select('cost_stale_months').eq('id', 1).single(),
    ])
    setRows(data || [])
    setStaleMonths(s?.cost_stale_months ?? 6)
    setEdits({})
  }
  useEffect(() => { load() }, [])

  const costStale = (r) => {
    if (!r.cost_updated_at || !r.cost_rm) return false
    const months = (Date.now() - new Date(r.cost_updated_at)) / (1000 * 60 * 60 * 24 * 30.44)
    return months > staleMonths
  }

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
    if (e.price_rm !== undefined) { patch.price_rm = Number(e.price_rm) || 0; patch.price_updated_at = new Date().toISOString() }
    if (e.cost_rm !== undefined) { patch.cost_rm = Number(e.cost_rm) || 0; patch.cost_updated_at = new Date().toISOString() }
    if (e.lead_time_weeks !== undefined) patch.lead_time_weeks = e.lead_time_weeks === '' ? null : Number(e.lead_time_weeks)
    const { error } = await supabase.from('products').update(patch).eq('id', r.id)
    setSaving(null)
    if (error) return toast(error.message, 'error')
    toast('Saved.', 'success')
    setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...patch } : x)))
    setEdits((s) => { const c = { ...s }; delete c[r.id]; return c })
  }

  const categories = useMemo(() => sortCategories([...new Set(rows.map(categoryOf))]), [rows])
  const filtered = useMemo(
    () => rows.filter((r) =>
      (!cat || categoryOf(r) === cat) &&
      `${r.model} ${r.brand || ''} ${r.series} ${r.type}`.toLowerCase().includes(q.toLowerCase())),
    [rows, q, cat],
  )
  const PAGE = 25
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [q, cat])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const paged = filtered.slice((page - 1) * PAGE, page * PAGE)

  const margin = (r) => {
    const p = Number(valueOf(r, 'price_rm')) || 0
    const c = Number(valueOf(r, 'cost_rm')) || 0
    if (!p || !c) return null
    return ((p - c) / p) * 100
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold mb-1">Product Catalog</h1>
          <p className="text-sm text-slate-500 mb-4">
            Set the <b>selling price</b> (shown to customers) and your <b>cost</b> (internal only —
            powers the margin charts on the dashboard, never appears on a quote).
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setShowAdd(true)}>+ Add product</button>
            <button className="btn-ghost" onClick={() => setShowImport(true)}>Import from Excel</button>
          </div>
        )}
      </div>
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
              <th className="text-left p-3">Brand</th>
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
            {paged.map((r) => {
              const m = margin(r)
              const dirty = !!edits[r.id]
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3 text-sm">{r.brand || company}</td>
                  <td className="p-3"><div className="font-medium">{r.model}</div><div className="text-xs text-slate-400">{r.type}</div></td>
                  <td className="p-3"><span className="badge bg-brand-light text-brand">{categoryOf(r)}</span> <span className="text-xs text-slate-400">{r.series}</span></td>
                  <td className="p-3 text-right text-slate-600">{dash(loadingPressure(r), ' bar')}</td>
                  <td className="p-3 text-right text-slate-600">{dash(flowCfm(r))}</td>
                  <td className="p-3 text-right">
                    <MoneyInput value={valueOf(r, 'price_rm')} onChange={(v) => setVal(r.id, 'price_rm', v)} />
                    {r.price_updated_at && <div className="text-[10px] text-slate-400 mt-0.5">{fmtDate(r.price_updated_at)}</div>}
                  </td>
                  <td className="p-3 text-right">
                    <MoneyInput value={valueOf(r, 'cost_rm')} onChange={(v) => setVal(r.id, 'cost_rm', v)} placeholder="—" />
                    {r.cost_updated_at && (
                      <div className={`text-[10px] mt-0.5 ${costStale(r) ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                        {costStale(r) ? '⚠ ' : ''}{fmtDate(r.cost_updated_at)}
                      </div>
                    )}
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
            {filtered.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-slate-400">No products.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3 text-sm">
          <button className="btn-ghost py-1 px-3" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="text-slate-500">Page {page} of {pages} · {filtered.length} products</span>
          <button className="btn-ghost py-1 px-3" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
      <SpecModal product={specProduct} editable={isAdmin} onSaved={load} onClose={() => setSpecProduct(null)} />
      {showImport && (
        <ImportModal existing={rows} onClose={() => setShowImport(false)} onDone={load} />
      )}
      {showAdd && (
        <AddProductModal defaultBrand={company} onClose={() => setShowAdd(false)} onDone={load} />
      )}
    </div>
  )
}

// Whole-Ringgit input with thousands separators (no decimals).
function MoneyInput({ value, onChange, placeholder }) {
  const digits = String(value ?? '').replace(/[^\d]/g, '')
  const display = digits === '' ? '' : Number(digits).toLocaleString('en-US')
  return (
    <input
      type="text" inputMode="numeric" placeholder={placeholder}
      className="input py-1 w-32 text-right ml-auto"
      value={display}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
    />
  )
}
