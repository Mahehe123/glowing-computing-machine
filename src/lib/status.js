export const STATUSES = ['draft', 'sent', 'won', 'lost', 'expired']

export const STATUS_META = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-700' },
  sent: { label: 'Sent', cls: 'bg-blue-100 text-blue-700' },
  won: { label: 'Won', cls: 'bg-green-100 text-green-700' },
  lost: { label: 'Lost', cls: 'bg-red-100 text-red-700' },
  expired: { label: 'Expired', cls: 'bg-amber-100 text-amber-700' },
}

// Quotes that represent live, open pipeline value.
export const OPEN_STATUSES = ['draft', 'sent']
