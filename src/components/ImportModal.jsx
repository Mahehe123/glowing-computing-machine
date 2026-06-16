import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseProductsWorkbook } from '../lib/xlsxImport'

// Admin Excel import for the product catalog. Upserts by model (update existing, insert new);
// never touches cost_rm / lead_time_weeks (those are set in-app).
export default function ImportModal({ existing, onClose, onDone }) {
  const [parsed, setParsed] = useState(null)
  const [errors, setErrors] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  // model(lowercased) -> existing id
  const byModel = {}
  for (const p of existing) byModel[String(p.model).trim().toLowerCase()] = p.id

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    try {
      const { products, errors } = await parseProductsWorkbook(file)
      setParsed(products)
      setErrors(errors)
    } catch (err) {
      setErrors([`Could not read file: ${err.message}`])
      setParsed(null)
    }
  }

  const newOnes = parsed?.filter((p) => !byModel[p.model.toLowerCase()]) || []
  const updates = parsed?.filter((p) => byModel[p.model.toLowerCase()]) || []

  async function apply() {
    setBusy(true)
    try {
      if (newOnes.length) {
        const { error } = await supabase.from('products').insert(newOnes)
        if (error) throw error
      }
      for (const p of updates) {
        const { error } = await supabase.from('products').update(p).eq('id', byModel[p.model.toLowerCase()])
        if (error) throw error
      }
      setResult({ ok: true, text: `Imported ${parsed.length} products (${newOnes.length} new, ${updates.length} updated).` })
      onDone?.()
    } catch (err) {
      setResult({ ok: false, text: err.message })
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">Import equipment from Excel</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>
        <p className="text-sm text-slate-500 mb-3">
          Upload an <b>.xlsx</b> with the standard equipment headers. Matches by <b>Model</b>:
          existing models are updated, new ones added. Your cost &amp; lead-time stay untouched.
        </p>

        <input type="file" accept=".xlsx,.xls" onChange={onFile} className="text-sm mb-3" />

        {errors.length > 0 && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3 max-h-28 overflow-y-auto">
            {errors.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        )}

        {parsed && (
          <div className="text-sm border rounded-md divide-y mb-3 max-h-60 overflow-y-auto">
            <div className="p-2 bg-slate-50 flex justify-between font-medium">
              <span>{parsed.length} products parsed</span>
              <span className="text-slate-500">{newOnes.length} new · {updates.length} update</span>
            </div>
            {parsed.map((p, i) => (
              <div key={i} className="p-2 flex justify-between text-xs">
                <span className="font-medium">{p.model} <span className="text-slate-400">{p.category}</span></span>
                <span className={byModel[p.model.toLowerCase()] ? 'text-amber-600' : 'text-green-700'}>
                  {byModel[p.model.toLowerCase()] ? 'update' : 'new'}
                </span>
              </div>
            ))}
          </div>
        )}

        {result && <div className={`text-sm mb-2 ${result.ok ? 'text-green-700' : 'text-red-600'}`}>{result.text}</div>}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>{result?.ok ? 'Done' : 'Cancel'}</button>
          {parsed && !result?.ok && (
            <button className="btn-primary" disabled={busy || parsed.length === 0} onClick={apply}>
              {busy ? 'Importing…' : `Import ${parsed.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
