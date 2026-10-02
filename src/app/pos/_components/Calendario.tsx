'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dateAFechaIso, esFinDeSemana, fechaIsoADate, fechaMx } from '@/lib/pos/posTipos'

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

type Props = {
  seleccion: string[]
  onCambio: (fechas: string[]) => void
  multiple?: boolean
  /** Permite elegir sábados y domingos. */
  finesDeSemana?: boolean
}

export default function Calendario({ seleccion, onCambio, multiple = true, finesDeSemana = false }: Props) {
  const hoy = fechaMx()
  const inicial = fechaIsoADate(seleccion[0] ?? hoy)
  const [mes, setMes] = useState(() => new Date(inicial.getFullYear(), inicial.getMonth(), 1, 12))
  const elegidas = useMemo(() => new Set(seleccion), [seleccion])

  const celdas = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1, 12)
    const offset = (primero.getDay() + 6) % 7
    const dias = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
    const out: (string | null)[] = Array.from({ length: offset }, () => null)
    for (let d = 1; d <= dias; d++) out.push(dateAFechaIso(new Date(mes.getFullYear(), mes.getMonth(), d, 12)))
    return out
  }, [mes])

  const semanaHabil = useMemo(
    () => celdas.filter((f): f is string => !!f && !esFinDeSemana(f) && f >= hoy),
    [celdas, hoy]
  )

  const alternar = (f: string) => {
    if (!multiple) return onCambio([f])
    const next = new Set(elegidas)
    if (next.has(f)) next.delete(f)
    else next.add(f)
    onCambio([...next].sort())
  }

  const mover = (delta: number) => setMes(new Date(mes.getFullYear(), mes.getMonth() + delta, 1, 12))

  return (
    <div className="cj-cal">
      <div className="cj-cal-head">
        <button type="button" className="cj-icon-btn cj-icon-btn--sm" onClick={() => mover(-1)} aria-label="Mes anterior">
          <ChevronLeft size={18} />
        </button>
        <span className="cj-cal-title">
          {mes.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" className="cj-icon-btn cj-icon-btn--sm" onClick={() => mover(1)} aria-label="Mes siguiente">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="cj-cal-grid" role="grid">
        {DIAS.map((d, i) => (
          <span key={`${d}${i}`} className="cj-cal-dow" aria-hidden>
            {d}
          </span>
        ))}
        {celdas.map((f, i) => {
          if (!f) return <span key={`v${i}`} />
          const bloqueado = !finesDeSemana && esFinDeSemana(f)
          const activo = elegidas.has(f)
          return (
            <button
              key={f}
              type="button"
              disabled={bloqueado}
              className={`cj-cal-day${activo ? ' is-on' : ''}${f === hoy ? ' is-today' : ''}${f < hoy ? ' is-past' : ''}`}
              aria-pressed={activo}
              aria-label={fechaIsoADate(f).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
              onClick={() => alternar(f)}
            >
              {Number(f.slice(8))}
            </button>
          )
        })}
      </div>
      {multiple ? (
        <div className="cj-cal-foot">
          <button type="button" className="cj-chip" onClick={() => onCambio(semanaHabil)} disabled={!semanaHabil.length}>
            Días hábiles restantes del mes
          </button>
          <button type="button" className="cj-chip" onClick={() => onCambio([])} disabled={!seleccion.length}>
            Limpiar
          </button>
        </div>
      ) : null}
    </div>
  )
}
