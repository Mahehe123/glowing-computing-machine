import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fmtDate } from '../lib/format'

// Admin-only: manage team access (revoke/restore, promote/demote).
export default function Users() {
  const { isAdmin, user } = useAuth()
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(null)

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('email')
    setRows(data || [])
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  if (!isAdmin) return <Navigate to="/" replace />

  async function update(id, patch) {
    setBusy(id)
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    setBusy(null)
    if (error) return alert(error.message)
    load()
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Users &amp; Access</h1>
      <p className="text-sm text-slate-500 mb-5">
        Invite-only — create accounts in the Supabase dashboard. Here you control who has access and who's an admin.
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Joined</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const isMe = r.id === user.id
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-medium">{r.full_name || r.email || '—'}</div>
                    {r.full_name && <div className="text-xs text-slate-400">{r.email}</div>}
                  </td>
                  <td className="p-3">
                    <span className={`badge ${r.role === 'admin' ? 'bg-brand-light text-brand' : 'bg-slate-100 text-slate-600'}`}>{r.role}</span>
                  </td>
                  <td className="p-3">
                    <span className={`badge ${r.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {r.active ? 'active' : 'revoked'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500">{fmtDate(r.updated_at)}</td>
                  <td className="p-3 text-right whitespace-nowrap space-x-2">
                    {isMe ? (
                      <span className="text-xs text-slate-400">(you)</span>
                    ) : (
                      <>
                        <button className="text-xs text-brand hover:underline" disabled={busy === r.id}
                          onClick={() => update(r.id, { role: r.role === 'admin' ? 'sales' : 'admin' })}>
                          {r.role === 'admin' ? 'Make sales' : 'Make admin'}
                        </button>
                        <button className={`text-xs hover:underline ${r.active ? 'text-red-600' : 'text-green-700'}`} disabled={busy === r.id}
                          onClick={() => update(r.id, { active: !r.active })}>
                          {r.active ? 'Revoke access' : 'Restore access'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No users.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Note: "Revoke" instantly blocks all data access (enforced in the database). To permanently delete a login, remove it in Supabase → Authentication → Users.
      </p>
    </div>
  )
}
