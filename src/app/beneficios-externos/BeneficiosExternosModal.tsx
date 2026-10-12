'use client'

/**
 * 2026-10-10 — Popup de Beneficios externos (vista del alumno) sobre el dashboard,
 * para no salir de la página al abrir la tarjeta.
 * 2026-10-12 — `guardar`: abierto por un alumno, la respuesta se guarda.
 */

import { useEffect, useId, useRef } from 'react'
import Cuestionario from './Cuestionario'
import './beneficios-externos.css'

type Props = {
  abierto: boolean
  onCerrar: () => void
  guardar?: boolean
}

export default function BeneficiosExternosModal({ abierto, onCerrar, guardar = false }: Props) {
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
      const panel = panelRef.current
      ;(panel?.querySelector<HTMLElement>('.bx-opcion') ?? panel?.querySelector<HTMLElement>('button'))?.focus()
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
        <Cuestionario tituloId={tituloId} onCerrar={onCerrar} guardar={guardar} />
      </div>
    </div>
  )
}
