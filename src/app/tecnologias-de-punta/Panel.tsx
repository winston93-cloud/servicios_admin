'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

/** Panel lateral (hoja completa en móvil) con bloqueo de scroll y cierre con Esc. */
export default function Panel({
  abierto,
  titulo,
  onCerrar,
  children,
  pie,
  ancho = 'normal',
}: {
  abierto: boolean
  titulo: ReactNode
  onCerrar: () => void
  children: ReactNode
  pie?: ReactNode
  ancho?: 'normal' | 'amplio'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const cerrarRef = useRef(onCerrar)
  useEffect(() => {
    cerrarRef.current = onCerrar
  }, [onCerrar])

  useEffect(() => {
    if (!abierto) return
    const previo = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
      previo?.focus?.()
    }
  }, [abierto])

  if (!abierto) return null
  return (
    <div className="tp-panel-capa" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar() }}>
      <div
        ref={ref}
        className={`tp-panel${ancho === 'amplio' ? ' tp-panel--amplio' : ''}`}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <header className="tp-panel-cab">
          <div className="tp-panel-titulo">{titulo}</div>
          <button type="button" className="tp-icono-btn" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="tp-panel-cuerpo">{children}</div>
        {pie && <footer className="tp-panel-pie">{pie}</footer>}
      </div>
    </div>
  )
}
