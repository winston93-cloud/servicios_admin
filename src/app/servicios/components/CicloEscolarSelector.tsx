'use client'

import { CalendarRange, Loader2 } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'

export interface CicloEscolarSelectorProps {
  /** Etiqueta visible junto al selector. */
  etiqueta?: string
  /** Oculta el texto «Ciclo activo del sistema: …». */
  mostrarCicloSistema?: boolean
  /** Variante compacta para colocar junto a la búsqueda. */
  variante?: 'barra' | 'inline'
  id?: string
  className?: string
}

export default function CicloEscolarSelector({
  etiqueta = 'Consultar ciclo',
  mostrarCicloSistema = true,
  variante = 'barra',
  id = 'ciclo-escolar-global',
  className = '',
}: CicloEscolarSelectorProps) {
  const {
    cicloSeleccionado,
    cicloActualSistema,
    etiquetaCicloActualSistema,
    opcionesSelector,
    cargando,
    error,
    setCicloSeleccionado,
  } = useCicloEscolar()

  const etiquetaConsulta =
    opcionesSelector.find((o) => o.valor === cicloSeleccionado)?.etiqueta ?? 'Ciclo escolar'

  const rootClass = [
    'ciclo-escolar-selector',
    variante === 'inline' ? 'ciclo-escolar-selector--inline' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass} role="group" aria-label={etiqueta}>
      <label htmlFor={id} className="ciclo-escolar-selector-label">
        <CalendarRange size={18} aria-hidden className="ciclo-escolar-selector-icon" />
        <span className="ciclo-escolar-selector-text">{etiqueta}</span>
      </label>
      <div className="ciclo-escolar-selector-control">
        {cargando ? (
          <span className="ciclo-escolar-selector-loading" aria-live="polite">
            <Loader2 size={18} className="ciclo-escolar-selector-spinner" aria-hidden />
            Cargando…
          </span>
        ) : (
          <select
            id={id}
            className="ciclo-escolar-selector-select"
            value={String(cicloSeleccionado)}
            onChange={(e) => setCicloSeleccionado(Number(e.target.value))}
            disabled={opcionesSelector.length === 0}
            aria-label={`${etiqueta}: ${etiquetaConsulta}`}
            title="Filtra pagos y alumnos por ciclo escolar."
          >
            {opcionesSelector.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
                {opcion.valor === cicloActualSistema ? ' (actual)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>
      {mostrarCicloSistema ? (
        <p className="ciclo-escolar-selector-actual" title="Definido en catálogo de ciclos escolares">
          Ciclo activo del sistema: <strong>{etiquetaCicloActualSistema}</strong>
        </p>
      ) : null}
      {error && (
        <p className="ciclo-escolar-selector-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
