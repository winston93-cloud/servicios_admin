'use client'

import { NIVELES_TALLER } from '@/lib/talleres/talleresTypes'
import {
  etiquetaNivelPreferido,
  guardarNivelPreferido,
  type NivelPreferidoTalleres,
} from '@/lib/talleres/talleresNivelPreferido'

export default function NivelPreferidoGate({
  abierto,
  valorActual,
  onElegir,
}: {
  abierto: boolean
  /** Preferencia ya guardada (para resaltar al reabrir). */
  valorActual?: NivelPreferidoTalleres
  onElegir: (nivel: number) => void
}) {
  if (!abierto) return null

  const elegir = (nivel: number) => {
    guardarNivelPreferido(nivel)
    onElegir(nivel)
  }

  return (
    <div className="tl-pref-backdrop" role="dialog" aria-modal="true" aria-labelledby="tl-pref-titulo">
      <div className="tl-pref-card">
        <p className="tl-kicker">Talleres</p>
        <h2 id="tl-pref-titulo" className="tl-pref-titulo">
          Nivel por defecto
        </h2>
        <p className="tl-pref-lead">
          Elige con qué nivel abrir los filtros. Puedes cambiar de nivel dentro del sistema cuando
          quieras; esto solo fija el valor inicial.
        </p>
        <div className="tl-pref-opciones" role="group" aria-label="Nivel por defecto">
          {NIVELES_TALLER.map((n) => (
            <button
              key={n.valor}
              type="button"
              className="tl-pref-opcion"
              data-activo={valorActual === n.valor || undefined}
              onClick={() => elegir(n.valor)}
            >
              <strong>{n.etiqueta}</strong>
              <span>{n.corto}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="tl-pref-sin-fijo"
          data-activo={valorActual === 0 || undefined}
          onClick={() => elegir(0)}
        >
          Continuar sin elegir fijo
          <span>Los filtros empiezan en «Todos»</span>
        </button>
        {valorActual != null ? (
          <p className="tl-pref-actual">Actual: {etiquetaNivelPreferido(valorActual)}</p>
        ) : null}
      </div>
    </div>
  )
}
