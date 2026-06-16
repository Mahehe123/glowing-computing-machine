import { useState } from 'react'
import { RM } from '../lib/format'
import { categoryOf } from '../lib/categories'
import { generalSpecRows } from '../lib/quoteDoc'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

const CORE_FIELDS = [
  ['brand', 'Brand', 'text'], ['air_quality', 'Air quality', 'text'], ['wc_ac', 'Cooling', 'text'],
  ['kw', 'kW', 'number'], ['hp', 'hp', 'number'], ['cfm_min', 'Min CFM', 'number'], ['cfm_max', 'Max CFM', 'number'],
  ['price_rm', 'Selling RM', 'number'], ['cost_rm', 'Cost RM', 'number'], ['lead_time_weeks', 'Lead (wks)', 'number'],
]

// Read-only spec viewer, or an editable form when `editable` (admin). Always confirms before saving.
export default function SpecModal({ product, onClose, editable = false, onSaved }) {
  const [edit, setEdit] = useState(false)
  const [core, setCore] = useState({})
  const [specs, setSpecs] = useState({})
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  if (!product) return null

  function startEdit() {
    setCore(Object.fromEntries(CORE_FIELDS.map(([k]) => [k, product[k] ?? ''])))
    setSpecs({ ...(product.specs || {}) })
    setEdit(true)
  }

  async function save() {
    if (!confirm(`Save changes to ${product.model}?`)) return
    setBusy(true)
    const patch = { specs }
    for (const [k, , type] of CORE_FIELDS) patch[k] = type === 'number' ? (core[k] === '' ? null : Number(core[k])) : (core[k] || null)
    if (Number(core.cost_rm) !== Number(product.cost_rm ?? 0)) patch.cost_updated_at = new Date().toISOString()
    if (Number(core.price_rm) !== Number(product.price_rm ?? 0)) patch.price_updated_at = new Date().toISOString()
    const { error } = await supabase.from('products').update(patch).eq('id', product.id)
    setBusy(false)
    if (error) return toast(error.message, 'error')
    toast('Saved.', 'success')
    onSaved?.(); onClose()
  }

  function tryClose() {
    if (edit && !confirm('Discard unsaved changes?')) return
    onClose()
  }

  const coreRows = generalSpecRows(product)
  const specEntries = Object.entries(product.specs || {})

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={tryClose}>
      <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-start justify-between sticky top-0 bg-white">
          <div>
            <div className="font-bold">{product.model}</div>
            <div className="text-xs text-slate-500">
              <span className="badge bg-brand-light text-brand mr-1">{categoryOf(product)}</span>{product.type}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {editable && !edit && <button className="btn-ghost py-1 px-2 text-xs" onClick={startEdit}>Edit</button>}
            <button onClick={tryClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {!edit ? (
            <>
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1">GENERAL</div>
                <dl className="text-sm divide-y">
                  {coreRows.map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1.5"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-right">{String(v)}</dd></div>
                  ))}
                  <div className="flex justify-between py-1.5"><dt className="text-slate-500">Selling price</dt><dd className="font-medium text-right">{product.price_rm ? RM(product.price_rm) : 'TBD'}</dd></div>
                </dl>
              </div>
              {specEntries.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-1">SPECIFICATIONS</div>
                  <dl className="text-sm divide-y">
                    {specEntries.map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1.5 gap-4"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-right">{String(v)}</dd></div>
                    ))}
                  </dl>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-xs font-semibold text-slate-400">GENERAL</div>
              <div className="grid grid-cols-2 gap-2">
                {CORE_FIELDS.map(([k, label, type]) => (
                  <div key={k}>
                    <label className="label">{label}</label>
                    <input type={type} className="input py-1" value={core[k]} onChange={(e) => setCore((c) => ({ ...c, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
              {Object.keys(specs).length > 0 && (
                <>
                  <div className="text-xs font-semibold text-slate-400">SPECIFICATIONS</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(specs).map((k) => (
                      <div key={k}>
                        <label className="label">{k}</label>
                        <input className="input py-1" value={specs[k] ?? ''} onChange={(e) => setSpecs((s) => ({ ...s, [k]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button className="btn-ghost" onClick={() => setEdit(false)}>Cancel</button>
                <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
