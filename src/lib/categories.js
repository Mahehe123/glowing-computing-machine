// Series (column D) -> category. Categories are the equipment families.
export const SERIES_CATEGORY = {
  AB: 'Air compressor', OF: 'Air compressor',
  EG: 'Air compressor', EN: 'Air compressor', EQ: 'Air compressor',
  AT: 'Air receiver tank', AF: 'Filter', Dryer: 'Dryer',
}

export const CATEGORY_ORDER = ['Air compressor', 'Dryer', 'Filter', 'Air receiver tank']

// Equipment + its Type options (drives the Add-product form and is the canonical taxonomy).
export const EQUIPMENT_TYPES = {
  'Air compressor': ['Oil-Free', 'Oil Lubricated'],
  'Dryer': ['Refrigerant', 'Desiccant', 'Membrane'],
  'Filter': ['Pre', 'Post', 'Carbon'],
  'Air receiver tank': ['Air receiver tank'],
}

// Categories treated as compressors (FAD clauses, comparison energy logic).
export const COMPRESSOR_CATEGORIES = ['Air compressor']

export const categoryOf = (product) =>
  product?.category || SERIES_CATEGORY[product?.series] || product?.series || '—'

export const isCompressor = (product) => COMPRESSOR_CATEGORIES.includes(categoryOf(product))

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
