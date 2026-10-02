'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

type TipoToast = 'ok' | 'error' | 'info'
type Toast = { id: number; tipo: TipoToast; texto: string }

const Ctx = createContext<(texto: string, tipo?: TipoToast) => void>(() => {})

export function useToast() {
  return useContext(Ctx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  const cerrar = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const mostrar = useCallback(
    (texto: string, tipo: TipoToast = 'info') => {
      const id = ++seq.current
      setToasts((t) => [...t.slice(-3), { id, tipo, texto }])
      setTimeout(() => cerrar(id), tipo === 'error' ? 6500 : 3800)
    },
    [cerrar]
  )

  return (
    <Ctx.Provider value={mostrar}>
      {children}
      <div className="cj-toasts" aria-live="polite">
        {toasts.map((t) => {
          const Icono = t.tipo === 'ok' ? CheckCircle2 : t.tipo === 'error' ? AlertTriangle : Info
          return (
            <div key={t.id} className={`cj-toast cj-toast--${t.tipo}`} role={t.tipo === 'error' ? 'alert' : 'status'}>
              <Icono size={18} aria-hidden />
              <span>{t.texto}</span>
              <button type="button" onClick={() => cerrar(t.id)} aria-label="Cerrar aviso">
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}
