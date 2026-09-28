'use client'

import { useEffect, useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { NIVELES_TALLER, etiquetaNivel } from '@/lib/talleres/talleresTypes'

export function TlModal({
  abierto,
  titulo,
  subtitulo,
  onCerrar,
  children,
  pie,
  ancho = 'normal',
}: {
  abierto: boolean
  titulo: string
  subtitulo?: string
  onCerrar: () => void
  children: ReactNode
  pie?: ReactNode
  ancho?: 'normal' | 'amplio'
}) {
  const tituloId = useId()
  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [abierto, onCerrar])

  if (!abierto) return null
  return (
    <div className="tl-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="tl-modal" data-ancho={ancho} role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        <header className="tl-modal-head">
          <div className="tl-min0">
            <h2 id={tituloId} className="tl-modal-title">{titulo}</h2>
            {subtitulo ? <p className="tl-modal-sub">{subtitulo}</p> : null}
          </div>
          <button type="button" className="tl-icon-btn" onClick={onCerrar} aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="tl-modal-body">{children}</div>
        {pie ? <footer className="tl-modal-foot">{pie}</footer> : null}
      </div>
    </div>
  )
}

/** Selector múltiple de niveles tipo chips. `permitidos` limita las opciones activas. */
export function NivelesChips({
  valor,
  onChange,
  permitidos,
  disabled,
}: {
  valor: number[]
  onChange: (v: number[]) => void
  permitidos?: number[]
  disabled?: boolean
}) {
  return (
    <div className="tl-chips" role="group" aria-label="Niveles">
      {NIVELES_TALLER.map((n) => {
        const activo = valor.includes(n.valor)
        const habilitado = !permitidos || permitidos.includes(n.valor)
        return (
          <button
            key={n.valor}
            type="button"
            className="tl-chip"
            data-activo={activo || undefined}
            aria-pressed={activo}
            disabled={disabled || !habilitado}
            onClick={() =>
              onChange(
                activo ? valor.filter((x) => x !== n.valor) : [...valor, n.valor].sort((a, b) => a - b)
              )
            }
          >
            {n.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

export function NivelesBadges({ niveles }: { niveles: number[] }) {
  if (!niveles.length) return <span className="tl-muted">—</span>
  return (
    <span className="tl-badges">
      {niveles.map((n) => (
        <span key={n} className="tl-badge" data-nivel={n}>
          {etiquetaNivel(n)}
        </span>
      ))}
    </span>
  )
}

export function Campo({
  etiqueta,
  children,
  ayuda,
  completo,
}: {
  etiqueta: string
  children: ReactNode
  ayuda?: string
  completo?: boolean
}) {
  return (
    <label className="tl-field" data-completo={completo || undefined}>
      <span className="tl-field-label">{etiqueta}</span>
      {children}
      {ayuda ? <span className="tl-field-help">{ayuda}</span> : null}
    </label>
  )
}
