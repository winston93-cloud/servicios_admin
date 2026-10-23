'use client'

import { useEffect, useState } from 'react'
import { kiApi } from '../kinder-ingles/components/kiApi'

const API = '/api/boletas-primaria-espanol/fechas'

type Fechas = { trimestre: number; inicio: string; fin: string }
type Borrador = Record<number, { inicio: string; fin: string }>

function borradorDe(fechas: Fechas[]): Borrador {
  return Object.fromEntries(
    [1, 2, 3].map((t) => {
      const f = fechas.find((x) => x.trimestre === t)
      return [t, { inicio: f?.inicio ?? '', fin: f?.fin ?? '' }]
    })
  )
}

/** Fechas de inicio y fin de cada trimestre: Classroom solo cuenta las tareas con fecha dentro de ellas. */
export default function PrimariaFechas({ ciclo }: { ciclo: number }) {
  const [fechas, setFechas] = useState<Fechas[] | null>(null)
  const [borrador, setBorrador] = useState<Borrador>(() => borradorDe([]))
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let vivo = true
    setErr('')
    setMsg('')
    setFechas(null)
    kiApi<{ fechas: Fechas[] }>(`${API}?ciclo=${ciclo}`)
      .then((r) => {
        if (!vivo) return
        setFechas(r.fechas ?? [])
        setBorrador(borradorDe(r.fechas ?? []))
      })
      .catch((e) => vivo && setErr(e instanceof Error ? e.message : 'No se pudieron cargar las fechas.'))
    return () => {
      vivo = false
    }
  }, [ciclo])

  async function guardar() {
    setGuardando(true)
    setErr('')
    setMsg('')
    try {
      const lista = [1, 2, 3].map((t) => ({ trimestre: t, ...borrador[t] }))
      const r = await kiApi<{ fechas: Fechas[] }>(API, { method: 'POST', body: JSON.stringify({ ciclo, fechas: lista }) })
      setFechas(r.fechas)
      setBorrador(borradorDe(r.fechas))
      setMsg('Fechas guardadas.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudieron guardar las fechas.')
    } finally {
      setGuardando(false)
    }
  }

  const faltan = fechas ? [1, 2, 3].filter((t) => !fechas.some((f) => f.trimestre === t)) : []

  return (
    <details className="ki-paper bm-panel pr-fechas" open={faltan.length > 0 || undefined}>
      <summary>
        Fechas de los trimestres (Classroom)
        {faltan.length > 0 && <span className="pr-fechas-falta">Falta el {faltan.join(', ')}</span>}
      </summary>
      <p className="ki-hint">
        Las calificaciones de Classroom solo cuentan las tareas con fecha de entrega (o de creación) dentro del trimestre.
        Sin fechas, el trimestre no se lee de Classroom.
      </p>
      {err && (
        <p className="ki-msg is-error" role="alert">
          {err}
        </p>
      )}
      <div className="pr-fechas-filas">
        {[1, 2, 3].map((t) => (
          <fieldset key={t} className="pr-fechas-fila">
            <legend>Trimestre {t}</legend>
            <label>
              Inicio
              <input
                type="date"
                value={borrador[t].inicio}
                disabled={!fechas}
                onChange={(e) => setBorrador((b) => ({ ...b, [t]: { ...b[t], inicio: e.target.value } }))}
              />
            </label>
            <label>
              Fin
              <input
                type="date"
                value={borrador[t].fin}
                min={borrador[t].inicio || undefined}
                disabled={!fechas}
                onChange={(e) => setBorrador((b) => ({ ...b, [t]: { ...b[t], fin: e.target.value } }))}
              />
            </label>
          </fieldset>
        ))}
      </div>
      <div className="pr-fechas-acciones">
        <button type="button" className="ki-btn primary" disabled={!fechas || guardando} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Guardar fechas'}
        </button>
        {msg && (
          <span className="ki-hint" role="status">
            {msg}
          </span>
        )}
      </div>
    </details>
  )
}
