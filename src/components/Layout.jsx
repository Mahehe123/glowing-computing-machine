import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { profile, user, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const name = profile?.full_name || user?.email || 'User'

  const nav = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/quotes', label: 'Quotations' },
    { to: '/customers', label: 'Customers' },
    { to: '/catalog', label: 'Catalog' },
    { to: '/comparison', label: 'Comparison' },
    ...(isAdmin ? [{ to: '/users', label: 'Users' }, { to: '/settings', label: 'Settings' }] : []),
    { to: '/profile', label: 'My Profile' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand text-white">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
          <div className="font-bold tracking-tight">AirQuote</div>
          <nav className="flex gap-1 flex-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm ${
                    isActive ? 'bg-white/20 font-semibold' : 'hover:bg-white/10'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={() => navigate('/quotes/new')}
            className="bg-white text-brand text-sm font-semibold px-3 py-1.5 rounded-md hover:bg-brand-light"
          >
            + New Quote
          </button>
          <div className="flex items-center gap-3 text-sm">
            <span className="opacity-90">{name}</span>
            <button onClick={signOut} className="opacity-80 hover:opacity-100 underline">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
