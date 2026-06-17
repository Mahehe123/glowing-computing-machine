import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { RM, daysBetween } from '../lib/format'
import { OPEN_STATUSES } from '../lib/status'
import { reasonLabel, competitorLabel } from '../lib/outcome'
import { sweepExpired } from '../lib/quotes'

const RANGE_LABEL = { all: 'All time', month: 'This month', quarter: 'This quarter', ytd: 'Year to date', '12m': 'Last 12 months' }
const PREV_LABEL = { month: 'last month', quarter: 'last quarter', ytd: 'same period last year', '12m': 'prior 12 months' }

// Current + previous comparable date windows for the selected range (null = all time, no comparison).
function periodBounds(range) {
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth()
  const d = (yy, mm, dd = 1) => new Date(yy, mm, dd)
  switch (range) {
    case 'month': return { cur: [d(y, mo), d(y, mo + 1)], prev: [d(y, mo - 1), d(y, mo)] }
    case 'quarter': { const q = Math.floor(mo / 3); return { cur: [d(y, q * 3), d(y, q * 3 + 3)], prev: [d(y, q * 3 - 3), d(y, q * 3)] } }
    case 'ytd': return { cur: [d(y, 0), now], prev: [d(y - 1, 0), new Date(y - 1, mo, now.getDate() + 1)] }
    case '12m': return { cur: [d(y, mo - 11), d(y, mo + 1)], prev: [d(y, mo - 23), d(y, mo - 11)] }
    default: return { cur: null, prev: null }
  }
}
const inWin = (ds, win) => { if (!win) return true; if (!ds) return false; const t = new Date(ds); return t >= win[0] && t < win[1] }

// Pro-rate an annual target onto the selected range.
function targetForRange(annual, range) {
  if (!annual) return 0
  switch (range) {
    case 'month': return annual / 12
    case 'quarter': return annual / 4
    case 'ytd': { const now = new Date(); const start = new Date(now.getFullYear(), 0, 0); return annual * (((now - start) / 86400000) / 365) }
    case '12m': return annual
    default: return 0
  }
}

function metrics(list) {
  const won = list.filter((q) => q.status === 'won')
  const lost = list.filter((q) => q.status === 'lost')
  const open = list.filter((q) => OPEN_STATUSES.includes(q.status))
  const wonRevenue = won.reduce((s, q) => s + Number(q.total || 0), 0)
  const pipeline = open.reduce((s, q) => s + Number(q.total || 0), 0)
  const decided = won.length + lost.length
  return {
    won, lost, open, wonRevenue, pipeline, decided,
    winRate: decided ? (won.length / decided) * 100 : 0,
    avgDeal: won.length ? wonRevenue / won.length : 0,
    wonCount: won.length, lostCount: lost.length,
  }
}
const deltaPct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)
const monthShort = (k) => { const [y, mo] = k.split('-'); return new Date(Number(y), Number(mo) - 1, 1).toLocaleString('en-MY', { month: 'short' }) }

export default function DashboardV2() {
  const [allQuotes, setAllQuotes] = useState([])
  const [profiles, setProfiles] = useState([])
  const [range, setRange] = useState('ytd')
  const [sp, setSp] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      await sweepExpired()
      const [{ data: q }, { data: p }] = await Promise.all([
        supabase.from('quotations').select('*, customers(company)'),
        supabase.from('profiles').select('id, full_name, email, active, sales_target'),
      ])
      setAllQuotes(q || [])
      setProfiles(p || [])
      setLoading(false)
    })()
  }, [])

  const bounds = useMemo(() => periodBounds(range), [range])
  const spQuotes = useMemo(() => allQuotes.filter((q) => !sp || q.salesperson_id === sp), [allQuotes, sp])
  const cur = useMemo(() => metrics(spQuotes.filter((q) => inWin(q.quote_date, bounds.cur))), [spQuotes, bounds])
  const prev = useMemo(() => metrics(spQuotes.filter((q) => inWin(q.quote_date, bounds.prev))), [spQuotes, bounds])

  const annualTarget = useMemo(() => {
    if (sp) return Number(profiles.find((x) => x.id === sp)?.sales_target) || 0
    return profiles.filter((p) => p.active !== false).reduce((s, p) => s + (Number(p.sales_target) || 0), 0)
  }, [profiles, sp])
  const periodTarget = targetForRange(annualTarget, range)
  const targetPct = periodTarget > 0 ? Math.min((cur.wonRevenue / periodTarget) * 100, 999) : null

  // Last 12 months: quotes created (activity) + won revenue (outcome).
  const byMonth = useMemo(() => {
    const m = {}
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const dd = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const k = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}`
      m[k] = { month: monthShort(k), quotes: 0, won: 0 }
    }
    spQuotes.forEach((q) => {
      const k = (q.quote_date || '').slice(0, 7)
      if (!m[k]) return
      m[k].quotes += 1
      if (q.status === 'won') m[k].won += Number(q.total || 0)
    })
    return Object.values(m)
  }, [spQuotes])
  const bestMonth = useMemo(() => byMonth.reduce((a, b) => (b.won > (a?.won || 0) ? b : a), null), [byMonth])

  const breakdown = (list, fn) => {
    const map = {}
    list.forEach((q) => { const k = fn(q) === '—' ? 'Unspecified' : fn(q); map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }
  const winReason = useMemo(() => breakdown(cur.won, reasonLabel), [cur])
  const wonAgainst = useMemo(() => breakdown(cur.won, competitorLabel), [cur])
  const lossReason = useMemo(() => breakdown(cur.lost, reasonLabel), [cur])
  const lostTo = useMemo(() => breakdown(cur.lost, competitorLabel), [cur])

  const aging = useMemo(
    () => spQuotes.filter((q) => OPEN_STATUSES.includes(q.status))
      .map((q) => ({ ...q, age: daysBetween(q.quote_date), expIn: q.valid_until ? daysBetween(new Date(), q.valid_until) : null }))
      .sort((a, b) => b.age - a.age),
    [spQuotes],
  )

  if (loading) return <div className="text-slate-500">Loading dashboard…</div>

  const wonDelta = deltaPct(cur.wonRevenue, prev.wonRevenue)
  const dir = wonDelta == null ? null : wonDelta >= 0 ? 'up' : 'down'
  const headline = range === 'all'
    ? `All time: ${RM(cur.wonRevenue)} won across ${cur.wonCount} deals.`
    : `${RANGE_LABEL[range]}: ${RM(cur.wonRevenue)} won`
      + (wonDelta != null ? `, ${dir} ${Math.abs(Math.round(wonDelta))}% vs ${PREV_LABEL[range]}` : '')
      + '.'
  const winRatePts = prev.decided > 0 ? cur.winRate - prev.winRate : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Sales Dashboard</h1>
        <div className="flex gap-2">
          <select className="input max-w-[160px] py-1.5 text-sm" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="all">All time</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="ytd">Year to date</option>
            <option value="12m">Last 12 months</option>
          </select>
          <select className="input max-w-[180px] py-1.5 text-sm" value={sp} onChange={(e) => setSp(e.target.value)}>
            <option value="">All salespeople</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </select>
        </div>
      </div>

      {/* HERO — headline insight + revenue + progress to target */}
      <div className="card p-5 flex flex-wrap items-center gap-6">
        <div className="flex-1 min-w-[280px]">
          <div className="text-xs text-slate-500">{RANGE_LABEL[range]}</div>
          <div className="text-[21px] font-semibold leading-snug mt-1 mb-3">{headline}</div>
          <div className="text-3xl font-bold">{RM(cur.wonRevenue)}</div>
          {targetPct != null ? (
            <div className="mt-3 max-w-md">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progress to {sp ? '' : 'team '}target ({RM(periodTarget)})</span>
                <span className="font-medium text-slate-700">{Math.round(targetPct)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded overflow-hidden">
                <div className="h-full rounded bg-brand" style={{ width: `${Math.min(targetPct, 100)}%` }} />
              </div>
            </div>
          ) : (
            <div className="mt-3 text-xs text-slate-400">
              {annualTarget > 0 ? 'Pick a period to see progress to target.' : 'Set targets under Users to track progress.'}
            </div>
          )}
        </div>
        <div className="min-w-[150px] space-y-3">
          <div>
            <div className="text-xs text-slate-500">Best month</div>
            <div className="font-semibold mt-0.5">{bestMonth && bestMonth.won > 0 ? `${bestMonth.month} · ${RM(bestMonth.won)}` : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Deals decided</div>
            <div className="font-semibold mt-0.5">{cur.wonCount} won · {cur.lostCount} lost</div>
          </div>
        </div>
      </div>

      {/* KPI row with deltas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Won revenue" value={RM(cur.wonRevenue)}><Delta v={wonDelta} range={range} /></Kpi>
        <Kpi label="Open pipeline" value={RM(cur.pipeline)}><Delta v={deltaPct(cur.pipeline, prev.pipeline)} range={range} /></Kpi>
        <Kpi label="Win rate" value={`${cur.winRate.toFixed(0)}%`}><Delta pts={winRatePts} range={range} /></Kpi>
        <Kpi label="Avg deal size" value={RM(cur.avgDeal)}><Delta v={deltaPct(cur.avgDeal, prev.avgDeal)} range={range} /></Kpi>
      </div>

      {/* Activity vs results — combined dual-axis */}
      <Panel title="Activity vs results" hint="Quotes created per month (bars) and won revenue (line). Wins lag activity, so months won't always line up.">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={byMonth} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" fontSize={11} />
            <YAxis yAxisId="left" fontSize={11} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v, n) => (n === 'Won revenue' ? [RM(v), n] : [v, n])} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="quotes" name="Quotes created" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={34} />
            <Line yAxisId="right" dataKey="won" name="Won revenue" stroke="#0f4c81" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      {/* Why we win / why we lose */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Why we win" hint={`${cur.wonCount} won deals`}>
          <Bars data={winReason} color="#16a34a" />
          {winReason.length > 0 && <Callout tone="win">You win most on {winReason[0].name.toLowerCase()}{wonAgainst[0] ? `; strongest against ${wonAgainst[0].name}` : ''}.</Callout>}
        </Panel>
        <Panel title="Why we lose" hint={`${cur.lostCount} lost deals`}>
          <Bars data={lossReason} color="#ef4444" />
          {lossReason.length > 0 && <Callout tone="loss">{shareLabel(lossReason)}{lostTo[0] ? `; most went to ${lostTo[0].name}` : ''}.</Callout>}
        </Panel>
      </div>

      {/* Needs follow-up */}
      <Panel title="Needs follow-up" hint="Open quotes, oldest first — your action list now">
        {aging.length === 0 ? <div className="h-24 flex items-center justify-center text-sm text-slate-400">Nothing open. 🎉</div> : (
          <div className="divide-y">
            {aging.slice(0, 8).map((q) => (
              <div key={q.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <Link to={`/quotes/${q.id}`} className="text-brand font-medium hover:underline">{q.quote_no}</Link>
                  <span className="text-slate-500 ml-2">{q.customers?.company || '—'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{RM(q.total)}</span>
                  <span className="text-xs text-slate-400">{q.age}d old</span>
                  {q.expIn !== null && q.expIn <= 7 && (
                    <span className="badge bg-amber-100 text-amber-700">{q.expIn < 0 ? 'expired' : `exp ${q.expIn}d`}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

function shareLabel(arr) {
  const total = arr.reduce((s, d) => s + d.value, 0)
  const top = arr[0]
  const p = total ? Math.round((top.value / total) * 100) : 0
  return `${top.name} drives ${p}% of losses`
}

function Bars({ data, color }) {
  if (!data.length) return <div className="text-sm text-slate-400">No data yet.</div>
  const total = data.reduce((s, d) => s + d.value, 0)
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <div>
      {data.map((d) => (
        <div key={d.name} className="flex items-center gap-2 mb-1.5">
          <div className="w-28 text-xs text-slate-600 truncate">{d.name}</div>
          <div className="flex-1 bg-slate-100 rounded h-4 overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
          <div className="w-9 text-xs text-right font-medium">{total ? Math.round((d.value / total) * 100) : 0}%</div>
        </div>
      ))}
    </div>
  )
}

function Callout({ tone, children }) {
  const cls = tone === 'win' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
  return <div className={`mt-3 text-xs leading-relaxed rounded px-3 py-2 ${cls}`}>{children}</div>
}

function Delta({ v, pts, range }) {
  const x = pts != null ? pts : v
  if (x == null) return <span className="text-xs text-slate-400">{range === 'all' ? '' : 'no prior period'}</span>
  const up = x >= 0
  const label = pts != null ? `${Math.abs(Math.round(x))} pts` : `${Math.abs(Math.round(x))}%`
  return <span className={`text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>{up ? '▲' : '▼'} {label} vs {PREV_LABEL[range] || 'prior'}</span>
}

function Kpi({ label, value, children }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      <div className="mt-1">{children}</div>
    </div>
  )
}
function Panel({ title, hint, children }) {
  return (
    <div className="card p-4">
      <div className="mb-2">
        <h2 className="font-semibold text-sm">{title}</h2>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      {children}
    </div>
  )
}
