import { RM } from '../lib/format'
import { categoryOf } from '../lib/categories'
import { generalSpecRows } from '../lib/quoteDoc'

// Shows every spec a product carries (family-scoped specs + core fields).
export default function SpecModal({ product, onClose }) {
  if (!product) return null
  const core = generalSpecRows(product)
  const specs = Object.entries(product.specs || {})

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-start justify-between sticky top-0 bg-white">
          <div>
            <div className="font-bold">{product.model}</div>
            <div className="text-xs text-slate-500">
              <span className="badge bg-brand-light text-brand mr-1">{categoryOf(product)}</span>
              {product.type}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-1">GENERAL</div>
            <dl className="text-sm divide-y">
              {core.map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-right">{String(v)}</dd></div>
              ))}
              <div className="flex justify-between py-1.5"><dt className="text-slate-500">Selling price</dt><dd className="font-medium text-right">{product.price_rm ? RM(product.price_rm) : 'TBD'}</dd></div>
            </dl>
          </div>
          {specs.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-1">SPECIFICATIONS</div>
              <dl className="text-sm divide-y">
                {specs.map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5 gap-4">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-medium text-right">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
