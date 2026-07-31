'use client'

import {
  getCiclosEscolaresOpciones,
  type CicloEscolar,
} from '@/lib/ciclosEscolares'
import { NIVELES, type NivelId } from '@/lib/reportesCatalogData'

type ReporteParametrosProps = {
  nivel: NivelId
  onNivelChange: (n: NivelId) => void
  mostrarNivel?: boolean
  nivelesOpciones?: NivelId[]
  ciclo: number
  onCicloChange: (n: number) => void
  mostrarCiclo?: boolean
  cicloLabel?: string
  ciclosOpciones?: CicloEscolar[]
}

export default function ReporteParametros({
  nivel,
  onNivelChange,
  mostrarNivel = true,
  nivelesOpciones,
  ciclo,
  onCicloChange,
  mostrarCiclo = false,
  cicloLabel = 'Ciclo',
  ciclosOpciones,
}: ReporteParametrosProps) {
  const opciones = ciclosOpciones ?? getCiclosEscolaresOpciones()
  const niveles =
    nivelesOpciones && nivelesOpciones.length > 0
      ? NIVELES.filter((n) => nivelesOpciones.includes(n.id))
      : NIVELES

  return (
    <div className="reporte-tile-params">
      {mostrarNivel ? (
        <label className="reporte-tile-field">
          <span>Nivel</span>
          <select
            value={nivel}
            onChange={(e) => onNivelChange(e.target.value as NivelId)}
          >
            {niveles.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {mostrarCiclo ? (
        <label className="reporte-tile-field">
          <span>{cicloLabel}</span>
          <select
            value={ciclo}
            onChange={(e) => onCicloChange(parseInt(e.target.value, 10))}
          >
            {opciones.map((c) => (
              <option key={c.numero} value={c.numero}>
                {c.etiqueta} ({c.numero})
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
