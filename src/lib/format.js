export const RM = (n) =>
  new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0)

export const num = (n, d = 0) =>
  new Intl.NumberFormat('en-MY', { maximumFractionDigits: d }).format(Number(n) || 0)

export const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

export const daysBetween = (a, b = new Date()) =>
  Math.floor((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24))
