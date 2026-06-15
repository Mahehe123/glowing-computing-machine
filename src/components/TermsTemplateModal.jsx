import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Shared library of T&C templates. Click one to drop it into the quote.
export default function TermsTemplateModal({ onApply, onClose }) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [editing, setEditing] = useState(null)

  async function load() {
    const { data } = await supabase.from('quote_templates').select('*').order('name')
    setRows(data || [])
  }
  useEffect(() => { load() }, [])

  function reset() { setName(''); setBody(''); setEditing(null) }

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    const payload = editing ? { name, body } : { name, body, created_by: user.id }
    const q = editing
      ? supabase.from('quote_templates').update(payload).eq('id', editing)
      : supabase.from('quote_templates').insert(payload)
    const { error } = await q
    if (error) return alert(error.message)
    reset(); load()
  }

  async function remove(id) {
    if (!confirm('Delete this template?')) return
    const { error } = await supabase.from('quote_templates').delete().eq('id', id)
    if (error) alert(error.message); else load()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">Terms &amp; Conditions templates</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* List */}
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1">SAVED TEMPLATES (shared)</div>
            <div className="border rounded-md divide-y max-h-72 overflow-y-auto">
              {rows.length === 0 && <div className="p-3 text-sm text-slate-400">No templates yet.</div>}
              {rows.map((t) => (
                <div key={t.id} className="p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{t.name}</div>
                    <div className="flex gap-2 text-xs">
                      <button className="text-brand hover:underline" onClick={() => { onApply(t.body); onClose() }}>Use</button>
                      <button className="text-slate-500 hover:underline" onClick={() => { setEditing(t.id); setName(t.name); setBody(t.body) }}>Edit</button>
                      <button className="text-red-600 hover:underline" onClick={() => remove(t.id)}>Del</button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 line-clamp-2 mt-0.5 whitespace-pre-line">{t.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Editor */}
          <form onSubmit={save} className="space-y-2">
            <div className="text-xs font-semibold text-slate-400">{editing ? 'EDIT TEMPLATE' : 'NEW TEMPLATE'}</div>
            <input className="input" placeholder="Template name (e.g. Standard Terms)" value={name} onChange={(e) => setName(e.target.value)} />
            <textarea className="input" rows={8} placeholder="Terms & conditions text…" value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-primary">{editing ? 'Update' : 'Save template'}</button>
              {editing && <button type="button" className="btn-ghost" onClick={reset}>Cancel edit</button>}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
