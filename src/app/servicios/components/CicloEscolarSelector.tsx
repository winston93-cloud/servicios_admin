'use client'

import { CalendarRange, Loader2 } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'

export default function CicloEscolarSelector() {
  const {
    cicloSeleccionado,
    opcionesSelector,
    cargando,
    error,
    setCicloSeleccionado,
  } = useCicloEscolar()

  const etiquetaActiva =
    opcionesSelector.find((o) => o.valor === cicloSeleccionado)?.etiqueta ?? 'Ciclo escolar'

  return (
    <div className="ciclo-escolar-selector" role="group" aria-label="Ciclo escolar de trabajo">
      <label htmlFor="ciclo-escolar-global" className="ciclo-escolar-selector-label">
        <CalendarRange size={18} aria-hidden className="ciclo-escolar-selector-icon" />
        <span className="ciclo-escolar-selector-text">Ciclo escolar</span>
      </label>
      <div className="ciclo-escolar-selector-control">
        {cargando ? (
          <span className="ciclo-escolar-selector-loading" aria-live="polite">
            <Loader2 size={18} className="ciclo-escolar-selector-spinner" aria-hidden />
            Cargando…
          </span>
        ) : (
          <select
            id="ciclo-escolar-global"
            className="ciclo-escolar-selector-select"
            value={String(cicloSeleccionado)}
            onChange={(e) => setCicloSeleccionado(Number(e.target.value))}
            disabled={opcionesSelector.length === 0}
            aria-label={`Ciclo escolar activo: ${etiquetaActiva}`}
            title="Filtra alumnos y operaciones por ciclo escolar"
          >
            {opcionesSelector.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        )}
      </div>
      {error && (
        <p className="ciclo-escolar-selector-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
