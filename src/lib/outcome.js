// Win/Loss capture options.
export const OUTCOME_REASONS = ['Pricing', 'Branding', 'Relationship', 'Aftermarket', 'Other']
export const COMPETITOR_BRANDS = ['Atlas Copco', 'IR', 'Kobelco', 'Others']

// Resolve the stored value for display/analytics (use the free-text note when "Other"/"Others").
export const reasonLabel = (q) =>
  q?.outcome_reason === 'Other' ? (q.outcome_reason_note || 'Other') : q?.outcome_reason || '—'
export const competitorLabel = (q) =>
  q?.competitor === 'Others' ? (q.competitor_note || 'Others') : q?.competitor || '—'
