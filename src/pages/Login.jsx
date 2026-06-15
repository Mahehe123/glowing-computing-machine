import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SetupNotice from '../components/SetupNotice'

export default function Login() {
  const { session, signIn, signUp, isConfigured } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!isConfigured) return <SetupNotice />
  if (session) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const fn = mode === 'signin' ? signIn : signUp
    const { error } = await fn(email, password)
    setBusy(false)
    if (error) setMsg({ type: 'err', text: error.message })
    else if (mode === 'signup')
      setMsg({ type: 'ok', text: 'Account created. Check your email if confirmation is required, then sign in.' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold text-brand">AirQuote</h1>
        <p className="text-sm text-slate-500 mb-5">Compressor quotations & sales</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {msg && (
            <div className={`text-sm ${msg.type === 'err' ? 'text-red-600' : 'text-green-700'}`}>{msg.text}</div>
          )}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button
          className="text-xs text-brand mt-4 hover:underline"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null) }}
        >
          {mode === 'signin' ? "New here? Create an account" : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
