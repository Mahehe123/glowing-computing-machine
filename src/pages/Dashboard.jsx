import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { RM, num, pct, fmtDate, daysBetween } from '../lib/format'
import { OPEN_STATUSES, STATUS_META } from '../lib/status'
import { categoryOf } from '../lib/categories'

export default function Dashboard() {
  const [quotes, setQuotes] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const [{ data: q }, { data: it }] = await Promise.all([
        supabase.from('quotations').select('*, customers(company)'),
        supabase.from('quotation_items').select('unit_price, unit_cost, qty, line_total, quotation_id, products(series, category), quotations(status)'),
      ])
      setQuotes(q || [])
      setItems(it || [])
      setLoading(false)
    })()
  }, [])

  const m = useMemo(() => {
    const won = quotes.filter((q) => q.status === 'won')
    const lost = quotes.filter((q) => q.status === 'lost')
    const open = quotes.filter((q) => OPEN_STATUSES.includes(q.status))
    const wonRevenue = won.reduce((s, q) => s + Number(q.total || 0), 0)
    const pipeline = open.reduce((s, q) => s + Number(q.total || 0), 0)
    const decided = won.length + lost.length
    const winRate = decided ? (won.length / decided) * 100 : 0
    const avgDeal = won.length ? wonRevenue / won.length : 0

    // funnel
    const funnel = ['draft', 'sent', 'won', 'lost'].map((s) => ({
      name: STATUS_META[s].label, value: quotes.filter((q) => q.status === s).length, key: s,
    }))

    // cost per quote (snapshotted unit_cost × qty)
    const costByQuote = {}
    items.forEach((it) => {
      const id = it.quotation_id
      costByQuote[id] = (costByQuote[id] || 0) + (Number(it.unit_cost) || 0) * (Number(it.qty) || 0)
    })

    // revenue + cost by month (won)
    const byMonth = {}
    won.forEach((q) => {
      const k = (q.quote_date || '').slice(0, 7)
      if (!k) return
      byMonth[k] = byMonth[k] || { revenue: 0, cost: 0 }
      byMonth[k].revenue += Number(q.total || 0)
      byMonth[k].cost += costByQuote[q.id] || 0
    })
    const revenueSeries = Object.entries(byMonth).sort().slice(-12)
      .map(([k, v]) => ({ month: k, revenue: Math.round(v.revenue), cost: Math.round(v.cost) }))

    // realized margin on won deals
    const wonCost = won.reduce((s, q) => s + (costByQuote[q.id] || 0), 0)
    const grossMargin = wonRevenue - wonCost
    const marginPct = wonRevenue ? (grossMargin / wonRevenue) * 100 : 0
    const hasCostData = wonCost > 0

    // discount leakage (all quotes): gross vs net at line level
    let gross = 0, net = 0
    items.forEach((it) => {
      gross += (Number(it.unit_price) || 0) * (Number(it.qty) || 0)
      net += Number(it.line_total) || 0
    })
    const leakage = gross - net
    const leakagePct = gross ? (leakage / gross) * 100 : 0

    // win rate by category (won vs decided, by line count)
    const byCat = {}
    items.forEach((it) => {
      const s = it.products ? categoryOf(it.products) : null
      const st = it.quotations?.status
      if (!s || !['won', 'lost'].includes(st)) return
      byCat[s] = byCat[s] || { won: 0, total: 0 }
      byCat[s].total++
      if (st === 'won') byCat[s].won++
    })
    const seriesWin = Object.entries(byCat).map(([s, v]) => ({
      series: s, rate: v.total ? (v.won / v.total) * 100 : 0, total: v.total,
    })).sort((a, b) => b.rate - a.rate)

    // aging / action list: open quotes, oldest first; flag expiring
    const aging = open.map((q) => ({
      ...q,
      age: daysBetween(q.quote_date),
      expIn: q.valid_until ? daysBetween(new Date(), q.valid_until) : null,
    })).sort((a, b) => b.age - a.age)

    const thisMonth = new Date().toISOString().slice(0, 7)
    const quotesThisMonth = quotes.filter((q) => (q.quote_date || '').startsWith(thisMonth)).length

    return { wonRevenue, wonCost, grossMargin, marginPct, hasCostData, pipeline, winRate, avgDeal, funnel, revenueSeries, leakage, leakagePct, seriesWin, aging, quotesThisMonth, wonCount: won.length }
  }, [quotes, items])

  if (loading) return <div className="text-slate-500">Loading dashboard…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Sales Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Kpi label="Won revenue" value={RM(m.wonRevenue)} sub={`${m.wonCount} deals`} />
        <Kpi label="Gross margin" value={m.hasCostData ? RM(m.grossMargin) : '—'} sub={m.hasCostData ? pct(m.marginPct) : 'add costs in Catalog'} accent />
        <Kpi label="Open pipeline" value={RM(m.pipeline)} sub="live quotes" />
        <Kpi label="Win rate" value={pct(m.winRate)} sub="won / decided" />
        <Kpi label="Avg deal size" value={RM(m.avgDeal)} />
        <Kpi label="Quotes this month" value={num(m.quotesThisMonth)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue vs cost over time */}
        <Panel title="Selling vs cost by month" hint="Won deals — the gap is your gross margin">
          {m.revenueSeries.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={m.revenueSeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v, n) => [RM(v), n === 'revenue' ? 'Selling' : 'Cost']} />
                <Legend formatter={(v) => (v === 'revenue' ? 'Selling' : 'Cost')} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" fill="#0f4c81" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Funnel */}
        <Panel title="Pipeline funnel">
          <div className="space-y-2 py-2">
            {m.funnel.map((f) => {
              const max = Math.max(...m.funnel.map((x) => x.value), 1)
              return (
                <div key={f.key} className="flex items-center gap-3">
                  <div className="w-14 text-xs text-slate-500">{f.name}</div>
                  <div className="flex-1 bg-slate-100 rounded h-7 overflow-hidden">
                    <div className={`h-full ${STATUS_META[f.key].cls}`} style={{ width: `${(f.value / max) * 100}%` }} />
                  </div>
                  <div className="w-8 text-sm font-semibold text-right">{f.value}</div>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* Discount leakage */}
        <Panel title="Discount leakage" hint="How much list value you're giving away in discounts">
          <div className="flex items-end gap-6 py-2">
            <div>
              <div className="text-3xl font-bold text-amber-600">{RM(m.leakage)}</div>
              <div className="text-sm text-slate-500">{pct(m.leakagePct)} of list value discounted</div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Across all quoted line items. Watch this trend — small % cuts compound fast on big-ticket compressors.</p>
        </Panel>

        {/* Win rate by category */}
        <Panel title="Win rate by product category">
          {m.seriesWin.length === 0 ? <Empty msg="No decided quotes yet." /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={m.seriesWin} layout="vertical">
                <XAxis type="number" domain={[0, 100]} fontSize={11} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="series" fontSize={10} width={110} />
                <Tooltip formatter={(v) => pct(v)} />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                  {m.seriesWin.map((e, i) => <Cell key={i} fill={e.rate >= 50 ? '#16a34a' : '#f59e0b'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Action list: aging / expiring open quotes */}
      <Panel title="Needs follow-up" hint="Open quotes, oldest first — your daily action list">
        {m.aging.length === 0 ? <Empty msg="Nothing open. 🎉" /> : (
          <div className="divide-y">
            {m.aging.slice(0, 8).map((q) => (
              <div key={q.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <Link to={`/quotes/${q.id}`} className="text-brand font-medium hover:underline">{q.quote_no}</Link>
                  <span className="text-slate-500 ml-2">{q.customers?.company || '—'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{RM(q.total)}</span>
                  <span className="text-xs text-slate-400">{q.age}d old</span>
                  {q.expIn !== null && q.expIn <= 7 && (
                    <span className="badge bg-amber-100 text-amber-700">
                      {q.expIn < 0 ? 'expired' : `exp ${q.expIn}d`}
                    </span>
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

function Kpi({ label, value, sub, accent }) {
  return (
    <div className={`card p-4 ${accent ? 'ring-1 ring-brand/30' : ''}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
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
function Empty({ msg = 'No data yet.' }) {
  return <div className="h-40 flex items-center justify-center text-sm text-slate-400">{msg}</div>
}
