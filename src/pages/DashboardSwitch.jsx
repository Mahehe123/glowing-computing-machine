import { useState } from 'react'
import Dashboard from './Dashboard'
import DashboardV2 from './DashboardV2'

const KEY = 'aq_dashboard_rev'

// Lets users flip between the new narrative dashboard (v2) and the classic one (v1).
// Choice is remembered per-device in localStorage so we can fall back instantly.
export default function DashboardSwitch() {
  const [rev, setRev] = useState(() => localStorage.getItem(KEY) || 'v2')
  const choose = (r) => { localStorage.setItem(KEY, r); setRev(r) }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden text-xs">
          <button onClick={() => choose('v2')} className={`px-3 py-1 ${rev === 'v2' ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>New</button>
          <button onClick={() => choose('v1')} className={`px-3 py-1 ${rev === 'v1' ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Classic</button>
        </div>
      </div>
      {rev === 'v1' ? <Dashboard /> : <DashboardV2 />}
    </div>
  )
}
