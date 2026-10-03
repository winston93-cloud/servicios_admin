'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { NIVELES_TALLER, etiquetaNivel } from '@/lib/talleres/talleresTypes'

/** Modales abiertos, del más viejo al más nuevo: solo el último responde a Escape y queda encima. */
const pilaModales: string[] = []
const Z_BASE_MODAL = 1200

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function TlModal({
  abierto,
  titulo,
  subtitulo,
  onCerrar,
  children,
  pie,
  ancho = 'normal',
  cambiosSinGuardar = false,
}: {
  abierto: boolean
  titulo: string
  subtitulo?: string
  onCerrar: () => void
  children: ReactNode
  pie?: ReactNode
  ancho?: 'normal' | 'amplio'
  /** Pide confirmación antes de cerrar con Escape, fondo o la X. */
  cambiosSinGuardar?: boolean
}) {
  const tituloId = useId()
  const caja = useRef<HTMLDivElement>(null)
  const [nivel, setNivel] = useState(0)
  const cerrarRef = useRef<() => void>(() => {})
  useEffect(() => {
    cerrarRef.current = () => {
      if (cambiosSinGuardar && !window.confirm('Hay cambios sin guardar. ¿Cerrar y descartarlos?')) return
      onCerrar()
    }
  }, [cambiosSinGuardar, onCerrar])

  useEffect(() => {
    if (!abierto) return
    pilaModales.push(tituloId)
    setNivel(pilaModales.length)
    const previo = document.activeElement as HTMLElement | null
    const dialogo = caja.current
    if (dialogo && !dialogo.contains(document.activeElement)) {
      const primero = dialogo.querySelector<HTMLElement>('[autofocus]') ?? dialogo
      primero.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (pilaModales[pilaModales.length - 1] !== tituloId) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        cerrarRef.current()
        return
      }
      if (e.key !== 'Tab' || !caja.current) return
      const items = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const [primero, ultimo] = [items[0], items[items.length - 1]]
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === caja.current)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      const i = pilaModales.lastIndexOf(tituloId)
      if (i >= 0) pilaModales.splice(i, 1)
      if (!pilaModales.length) document.body.style.overflow = prev
      if (previo && document.contains(previo)) previo.focus()
    }
  }, [abierto, tituloId])

  if (!abierto) return null
  return (
    <div
      className="tl-modal-backdrop"
      style={{ zIndex: Z_BASE_MODAL + nivel }}
      onMouseDown={(e) => e.target === e.currentTarget && cerrarRef.current()}
    >
      <div
        ref={caja}
        className="tl-modal"
        data-ancho={ancho}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
      >
        <header className="tl-modal-head">
          <div className="tl-min0">
            <h2 id={tituloId} className="tl-modal-title">{titulo}</h2>
            {subtitulo ? <p className="tl-modal-sub">{subtitulo}</p> : null}
          </div>
          <button type="button" className="tl-icon-btn" onClick={() => cerrarRef.current()} aria-label="Cerrar">
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
  grupo,
}: {
  etiqueta: string
  children: ReactNode
  ayuda?: string
  completo?: boolean
  /** Para grupos de botones (chips, colores): un <label> redirigiría el toque al primer botón. */
  grupo?: boolean
}) {
  const id = useId()
  if (grupo) {
    return (
      <div className="tl-field" data-completo={completo || undefined} role="group" aria-labelledby={id}>
        <span id={id} className="tl-field-label">{etiqueta}</span>
        {children}
        {ayuda ? <span className="tl-field-help">{ayuda}</span> : null}
      </div>
    )
  }
  return (
    <label className="tl-field" data-completo={completo || undefined}>
      <span className="tl-field-label">{etiqueta}</span>
      {children}
      {ayuda ? <span className="tl-field-help">{ayuda}</span> : null}
    </label>
  )
}
