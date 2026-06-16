import { createContext, useContext, useCallback, useState } from 'react'

const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

let idSeq = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'info') => {
    const id = ++idSeq
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const COLORS = {
    success: 'bg-green-600', error: 'bg-red-600', info: 'bg-slate-800', warn: 'bg-amber-600',
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div key={t.id} className={`${COLORS[t.type] || COLORS.info} text-white text-sm rounded-md shadow-lg px-4 py-2.5 animate-[fadeIn_0.15s_ease]`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
