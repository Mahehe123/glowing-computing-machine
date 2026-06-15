import { useAuth } from '../context/AuthContext'

export default function AccessBlocked() {
  const { user, signOut } = useAuth()
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-md p-6 text-center">
        <h1 className="text-lg font-bold text-slate-800 mb-2">Access not enabled</h1>
        <p className="text-sm text-slate-600">
          Your account (<b>{user?.email}</b>) doesn't have access to AirQuote yet, or it has been
          revoked. Please contact your administrator.
        </p>
        <button onClick={signOut} className="btn-ghost mt-5">Sign out</button>
      </div>
    </div>
  )
}
