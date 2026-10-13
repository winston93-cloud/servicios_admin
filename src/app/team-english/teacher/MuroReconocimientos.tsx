'use client'

import { useEffect, useRef, useState } from 'react'
import type { PortalTeacherData } from '@/lib/teamEnglish/teService'
import { REACCIONES, lunesDe, sumarDias, textoSemana, type Reaccion, type TeReconocimiento } from '@/lib/teamEnglish/teTypes'
import Celebracion from '../components/Celebracion'

/** Máximo de celebraciones automáticas seguidas al entrar (el resto queda en el muro). */
const MAX_AUTO = 3
const claveSim = (maestro: number, id: number) => `te-rec-sim-${maestro}-${id}`

async function avisarServidor(id: number, reaccion?: Reaccion | null) {
  const res = await fetch('/api/team-english/teacher/reconocimiento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reaccion === undefined ? { id } : { id, reaccion }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error || 'No se pudo guardar tu reacción.')
  }
}

/** Al entrar salen los reconocimientos nuevos (5 s c/u) y abajo queda el muro para verlos otra vez y reaccionar. */
export default function MuroReconocimientos({ data, setData, onError }: {
  data: PortalTeacherData
  setData: (d: PortalTeacherData) => void
  onError: (t: string) => void
}) {
  const yo = data.teacher.maestro_id
  const simulado = !!data.simulado_por
  /** Cola al entrar: de esta semana y la anterior, que aún no haya visto. */
  const [cola, setCola] = useState<number[]>(() => {
    if (typeof window === 'undefined') return []
    const desde = sumarDias(lunesDe(data.hoy), -7)
    return data.reconocimientos
      .filter((r) => r.semana >= desde)
      .filter((r) => (simulado ? !sessionStorage.getItem(claveSim(yo, r.id)) : !r.vistos.some((v) => v.maestro_id === yo)))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-MAX_AUTO)
      .map((r) => r.id)
  })
  const [repetir, setRepetir] = useState<number | null>(null)
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])

  const actualizar = (id: number, cambio: (vistos: TeReconocimiento['vistos']) => TeReconocimiento['vistos']) => {
    const d = dataRef.current
    setData({ ...d, reconocimientos: d.reconocimientos.map((r) => (r.id === id ? { ...r, vistos: cambio(r.vistos) } : r)) })
  }

  const marcarVisto = (id: number) => {
    if (simulado) {
      sessionStorage.setItem(claveSim(yo, id), '1')
      return
    }
    actualizar(id, (v) => (v.some((x) => x.maestro_id === yo) ? v : [...v, { maestro_id: yo, reaccion: null }]))
    avisarServidor(id).catch(() => undefined)
  }

  const reaccionar = (id: number, reaccion: Reaccion | null) => {
    actualizar(id, (v) => [...v.filter((x) => x.maestro_id !== yo), { maestro_id: yo, reaccion }])
    if (simulado) return
    avisarServidor(id, reaccion).catch((e: Error) => onError(e.message))
  }

  const enCola = cola[0]
  const mostrando = repetir ?? enCola ?? null
  const rec = mostrando != null ? data.reconocimientos.find((r) => r.id === mostrando) : undefined
  const cerrar = () => {
    if (repetir != null) setRepetir(null)
    else if (enCola != null) {
      marcarVisto(enCola)
      setCola((c) => c.slice(1))
    }
  }

  if (!data.reconocimientos.length) return null
  const hoyLunes = lunesDe(data.hoy)

  return (
    <>
      <section className="te-muro" aria-labelledby="te-muro-titulo">
        <h2 id="te-muro-titulo" className="te-muro-titulo">🏆 Muro de reconocimientos</h2>
        <ul className="te-muro-lista">
          {data.reconocimientos.map((r, i) => {
            const mia = r.vistos.find((v) => v.maestro_id === yo)?.reaccion ?? null
            const paraMi = r.homenajeadas.some((h) => h.maestro_id === yo)
            return (
              <li key={r.id} className="te-muro-item" data-tema={r.tema} data-mio={paraMi || undefined} style={{ ['--i' as string]: i }}>
                <button type="button" className="te-muro-ver" onClick={() => setRepetir(r.id)} aria-label={`Ver otra vez: ${r.titulo}`}>
                  <span className="te-muro-emoji" aria-hidden>{r.emoji}</span>
                  <span className="te-min0">
                    <small className="te-muro-semana">{r.semana === hoyLunes ? '✨ Esta semana' : textoSemana(r.semana)}{paraMi ? ' · 💖 Para ti' : ''}</small>
                    <strong>{r.titulo}</strong>
                    <small>{r.homenajeadas.length ? r.homenajeadas.map((h) => `${h.emoji} ${h.nombre.split(' ')[0]}`).join(' · ') : '🌈 Todo el team'}</small>
                  </span>
                  <span className="te-muro-play" aria-hidden>▶</span>
                </button>
                <div className="te-muro-reacciones" role="group" aria-label="Reacciones">
                  {REACCIONES.map((x) => {
                    const n = r.vistos.filter((v) => v.reaccion === x.clave).length
                    return (
                      <button key={x.clave} type="button" aria-pressed={mia === x.clave} aria-label={`${x.emoji} ${n}`}
                        onClick={() => reaccionar(r.id, mia === x.clave ? null : x.clave)}>
                        {x.emoji}{n ? <b>{n}</b> : null}
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {rec ? (
        <Celebracion
          key={`${rec.id}-${repetir != null ? 'r' : 'c'}`}
          rec={rec}
          homenajeada={rec.homenajeadas.some((h) => h.maestro_id === yo)}
          miReaccion={rec.vistos.find((v) => v.maestro_id === yo)?.reaccion ?? null}
          onReaccion={(x) => reaccionar(rec.id, x)}
          onCerrar={cerrar}
        />
      ) : null}
    </>
  )
}
