'use client'

/**
 * 2026-10-10 — Popup de Beneficios externos (vista del alumno) sobre el dashboard,
 * para no salir de la página al abrir la tarjeta.
 */

import { useEffect, useId, useRef } from 'react'
import { Eye, X } from 'lucide-react'
import Cuestionario from './Cuestionario'
import './beneficios-externos.css'

type Props = {
  abierto: boolean
  onCerrar: () => void
}

export default function BeneficiosExternosModal({ abierto, onCerrar }: Props) {
  const tituloId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('.bx-opcion, button')?.focus()
    }, 40)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div className="bx-modal" role="presentation">
      <button type="button" className="bx-modal-fondo" aria-label="Cerrar" onClick={onCerrar} />
      <div ref={panelRef} className="bx-modal-panel" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        <div className="bx-modal-barra">
          <p className="bx-preview" role="note">
            <Eye size={15} aria-hidden />
            Vista previa del alumno · las respuestas no se guardan.
          </p>
          <button type="button" className="bx-modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} aria-hidden />
          </button>
        </div>
        <Cuestionario tituloId={tituloId} />
      </div>
    </div>
  )
}
