'use client'

import {
  getCiclosEscolaresOpciones,
  type CicloEscolar,
} from '@/lib/ciclosEscolares'
import { NIVELES, type NivelId } from '@/lib/reportesCatalogData'

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

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
  mes?: number
  onMesChange?: (m: number) => void
  mostrarMes?: boolean
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
  mes = new Date().getMonth() + 1,
  onMesChange,
  mostrarMes = false,
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
      {mostrarMes ? (
        <label className="reporte-tile-field">
          <span>Mes</span>
          <select
            value={mes}
            onChange={(e) => onMesChange?.(parseInt(e.target.value, 10))}
          >
            {MESES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  )
}
