'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'

export type PortalToastTipo = 'ok' | 'error'

type Item = { id: number; tipo: PortalToastTipo; texto: string }

export function usePortalToast() {
  const [toasts, setToasts] = useState<Item[]>([])
  const [listo, setListo] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    setListo(true)
  }, [])

  const cerrar = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const toast = useCallback(
    (texto: string, tipo: PortalToastTipo = 'ok') => {
      const id = ++seq.current
      setToasts((t) => [...t.slice(-2), { id, tipo, texto }])
      window.setTimeout(() => cerrar(id), tipo === 'error' ? 6500 : 3600)
    },
    [cerrar]
  )

  const host =
    listo && typeof document !== 'undefined'
      ? createPortal(
          <div className="portal-toasts" aria-live="polite">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`portal-toast portal-toast--${t.tipo}`}
                role={t.tipo === 'error' ? 'alert' : 'status'}
              >
                {t.tipo === 'error' ? (
                  <AlertTriangle size={18} aria-hidden />
                ) : (
                  <CheckCircle2 size={18} aria-hidden />
                )}
                <span>{t.texto}</span>
                <button type="button" onClick={() => cerrar(t.id)} aria-label="Cerrar aviso">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )
      : null

  return { toast, host }
}
