'use client'

import { kiApi } from '@/app/boletas/kinder-ingles/components/kiApi'
import { Lock, LockOpen } from 'lucide-react'
import { useEffect, useState } from 'react'

const API = '/api/boletas-secundaria/periodo'

type Fechas = { trimestre: number; inicio: string; fin: string }
type Periodo = { trimestre: number; actualizadoPor: string; actualizadoAt: string | null; fechas: Fechas[] }
type Borrador = Record<number, { inicio: string; fin: string }>

function borradorDe(fechas: Fechas[]): Borrador {
  return Object.fromEntries([1, 2, 3].map((t) => {
    const f = fechas.find((x) => x.trimestre === t)
    return [t, { inicio: f?.inicio ?? '', fin: f?.fin ?? '' }]
  }))
}

const OPCIONES = [
  { valor: 0, etiqueta: 'Cerrada' },
  { valor: 1, etiqueta: 'Trimestre 1' },
  { valor: 2, etiqueta: 'Trimestre 2' },
  { valor: 3, etiqueta: 'Trimestre 3' },
]

function fecha(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('es-MX', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Monterrey' })
}

/** Dirección abre un trimestre a la captura de maestros (solo uno a la vez) o la cierra. */
export default function SecPeriodo({
  ciclo,
  esActual,
  onAbierto,
}: {
  ciclo: number
  /** Los maestros siempre capturan en el ciclo actual; en ciclos pasados no aplica. */
  esActual: boolean
  onAbierto?: (trimestre: number) => void
}) {
  const [periodo, setPeriodo] = useState<Periodo | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState('')
  const [borrador, setBorrador] = useState<Borrador>(() => borradorDe([]))
  const [msgFechas, setMsgFechas] = useState('')

  useEffect(() => {
    if (!esActual) return
    let vivo = true
    setErr('')
    kiApi<Periodo>(`${API}?ciclo=${ciclo}`)
      .then((p) => {
        if (!vivo) return
        setPeriodo(p)
        setBorrador(borradorDe(p.fechas ?? []))
        if (p.trimestre) onAbierto?.(p.trimestre)
      })
      .catch((e) => vivo && setErr(e instanceof Error ? e.message : 'No se pudo cargar la captura.'))
    return () => {
      vivo = false
    }
    // onAbierto solo se usa en la primera carga para preseleccionar el trimestre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciclo, esActual])

  async function fijar(t: number) {
    if (!periodo || t === periodo.trimestre) return
    const texto = t
      ? `¿Abrir el trimestre ${t} a la captura de maestros?${periodo.trimestre ? ` Se cierra el trimestre ${periodo.trimestre}.` : ''}`
      : '¿Cerrar la captura? Los maestros solo podrán consultar sus hojas.'
    if (!window.confirm(texto)) return
    setGuardando(true)
    setErr('')
    try {
      setPeriodo(await kiApi<Periodo>(API, { method: 'POST', body: JSON.stringify({ ciclo, trimestre: t }) }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cambiar.')
    } finally {
      setGuardando(false)
    }
  }

  async function guardarFechas() {
    setGuardando(true)
    setErr('')
    setMsgFechas('')
    try {
      const fechas = [1, 2, 3].map((t) => ({ trimestre: t, ...borrador[t] }))
      const p = await kiApi<Periodo>(API, { method: 'POST', body: JSON.stringify({ ciclo, accion: 'fechas', fechas }) })
      setPeriodo(p)
      setBorrador(borradorDe(p.fechas))
      setMsgFechas('Fechas guardadas.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudieron guardar las fechas.')
    } finally {
      setGuardando(false)
    }
  }

  const faltanFechas = periodo ? [1, 2, 3].filter((t) => !periodo.fechas?.some((f) => f.trimestre === t)) : []

  if (!esActual) {
    return (
      <p className="ki-hint sd-periodo-nota">
        La captura de maestros solo se abre en el ciclo actual; este ciclo es de consulta.
      </p>
    )
  }

  const abierto = periodo?.trimestre ?? 0
  return (
    <section className={`sd-periodo${abierto ? ' is-abierta' : ' is-cerrada'}`} aria-label="Captura de maestros">
      <div className="sd-periodo-texto">
        {abierto ? <LockOpen size={20} aria-hidden /> : <Lock size={20} aria-hidden />}
        <div>
          <strong>{!periodo ? 'Captura de maestros…' : abierto ? `Captura abierta: trimestre ${abierto}` : 'Captura de maestros cerrada'}</strong>
          <span>
            {periodo?.actualizadoPor
              ? `Último cambio: ${periodo.actualizadoPor}${fecha(periodo.actualizadoAt) ? `, ${fecha(periodo.actualizadoAt)}` : ''}.`
              : 'Los maestros solo capturan en el trimestre que abras aquí.'}
          </span>
        </div>
      </div>
      <div className="bc-trimestres" role="radiogroup" aria-label="Trimestre abierto a captura">
        {OPCIONES.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={abierto === o.valor}
            className={`ki-tab${abierto === o.valor ? ' is-on' : ''}`}
            disabled={!periodo || guardando}
            onClick={() => void fijar(o.valor)}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
      {err && (
        <p className="ki-msg is-error" role="alert">
          {err}
        </p>
      )}
      {periodo && (
        <details className="sd-fechas" open={faltanFechas.length > 0 || undefined}>
          <summary>
            Fechas de los trimestres (Classroom)
            {faltanFechas.length > 0 && <span className="sd-fechas-falta">Falta el {faltanFechas.join(', ')}</span>}
          </summary>
          <p className="ki-hint">
            Las calificaciones de Classroom solo cuentan las tareas con fecha de entrega (o de creación) dentro del trimestre.
          </p>
          <div className="sd-fechas-filas">
            {[1, 2, 3].map((t) => (
              <fieldset key={t} className="sd-fechas-fila">
                <legend>Trimestre {t}</legend>
                <label>
                  Inicio
                  <input
                    type="date"
                    value={borrador[t].inicio}
                    onChange={(e) => setBorrador((b) => ({ ...b, [t]: { ...b[t], inicio: e.target.value } }))}
                  />
                </label>
                <label>
                  Fin
                  <input
                    type="date"
                    value={borrador[t].fin}
                    min={borrador[t].inicio || undefined}
                    onChange={(e) => setBorrador((b) => ({ ...b, [t]: { ...b[t], fin: e.target.value } }))}
                  />
                </label>
              </fieldset>
            ))}
          </div>
          <div className="sd-fechas-acciones">
            <button type="button" className="ki-btn primary" disabled={guardando} onClick={() => void guardarFechas()}>
              Guardar fechas
            </button>
            {msgFechas && <span className="ki-hint" role="status">{msgFechas}</span>}
          </div>
        </details>
      )}
    </section>
  )
}
