'use client'

import { CalendarRange, Loader2 } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'

export default function CicloEscolarSelector() {
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

  return (
    <div className="ciclo-escolar-selector" role="group" aria-label="Ciclo escolar de consulta">
      <label htmlFor="ciclo-escolar-global" className="ciclo-escolar-selector-label">
        <CalendarRange size={18} aria-hidden className="ciclo-escolar-selector-icon" />
        <span className="ciclo-escolar-selector-text">Consultar ciclo</span>
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
            aria-label={`Consultar alumnos del ciclo ${etiquetaConsulta}`}
            title="Filtra alumnos por ciclo. El ciclo activo del sistema solo se cambia en el catálogo."
          >
            {opcionesSelector.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
                {opcion.valor === cicloActualSistema ? ' (activo)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="ciclo-escolar-selector-actual" title="Definido en catálogo de ciclos escolares">
        Ciclo activo del sistema: <strong>{etiquetaCicloActualSistema}</strong>
      </p>
      {error && (
        <p className="ciclo-escolar-selector-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
