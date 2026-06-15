import { useState } from 'react'
import { OUTCOME_REASONS, COMPETITOR_BRANDS } from '../lib/outcome'

// Captures win/loss reason + competitor when a quote is marked Won or Lost.
export default function OutcomeModal({ mode, initial, onSave, onCancel }) {
  const [reason, setReason] = useState(initial?.outcome_reason || '')
  const [reasonNote, setReasonNote] = useState(initial?.outcome_reason_note || '')
  const [competitor, setCompetitor] = useState(initial?.competitor || '')
  const [competitorNote, setCompetitorNote] = useState(initial?.competitor_note || '')

  const won = mode === 'won'
  const verb = won ? 'won' : 'lost'

  function save() {
    onSave({
      outcome_reason: reason || null,
      outcome_reason_note: reason === 'Other' ? (reasonNote || null) : null,
      competitor: competitor || null,
      competitor_note: competitor === 'Others' ? (competitorNote || null) : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold text-lg mb-1">
          Marked as <span className={won ? 'text-green-700' : 'text-red-600'}>{verb.toUpperCase()}</span>
        </h2>
        <p className="text-sm text-slate-500 mb-4">A couple of quick details power the win/loss analysis.</p>

        <div className="space-y-4">
          <div>
            <label className="label">Reason {won ? 'we won' : 'we lost'}</label>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">— select —</option>
              {OUTCOME_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === 'Other' && (
              <input className="input mt-2" placeholder="Describe the reason" value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} />
            )}
          </div>

          <div>
            <label className="label">{won ? 'Won against which brand' : 'Lost to which brand'}</label>
            <select className="input" value={competitor} onChange={(e) => setCompetitor(e.target.value)}>
              <option value="">— select —</option>
              {COMPETITOR_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            {competitor === 'Others' && (
              <input className="input mt-2" placeholder="Type the brand name" value={competitorNote} onChange={(e) => setCompetitorNote(e.target.value)} />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
