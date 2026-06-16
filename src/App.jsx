import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import QuotationEditor from './pages/QuotationEditor'
import Quotations from './pages/Quotations'
import Customers from './pages/Customers'
import Catalog from './pages/Catalog'
import Comparison from './pages/Comparison'
import Profile from './pages/Profile'
import Users from './pages/Users'
import Settings from './pages/Settings'
import SetupNotice from './components/SetupNotice'
import AccessBlocked from './components/AccessBlocked'

function Protected({ children }) {
  const { session, profile, isActive, loading, isConfigured } = useAuth()
  if (!isConfigured) return <SetupNotice />
  if (loading) return <div className="p-8 text-slate-500">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <div className="p-8 text-slate-500">Loading…</div> // profile still fetching
  if (!isActive) return <AccessBlocked />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/quotes" element={<Quotations />} />
        <Route path="/quotes/new" element={<QuotationEditor />} />
        <Route path="/quotes/:id" element={<QuotationEditor />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/comparison" element={<Comparison />} />
        <Route path="/users" element={<Users />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
