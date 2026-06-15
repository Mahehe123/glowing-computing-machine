// Series (column D) -> category. Mirrors scripts/generate_products_sql.py.
// Used as a fallback if a product row has no category stored.
export const SERIES_CATEGORY = {
  AB: 'Oil free compressor', OF: 'Oil free compressor',
  EG: 'Oil lube compressor', EN: 'Oil lube compressor', EQ: 'Oil lube compressor',
  AT: 'Air Tank', AF: 'Air filter', Dryer: 'Dryer',
}

export const CATEGORY_ORDER = [
  'Oil free compressor', 'Oil lube compressor', 'Air Tank', 'Air filter', 'Dryer',
]

export const categoryOf = (product) =>
  product?.category || SERIES_CATEGORY[product?.series] || product?.series || '—'

// Sort a list of category names into our preferred order (unknowns last, alphabetical).
export function sortCategories(cats) {
  return [...cats].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a)
    const ib = CATEGORY_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}
