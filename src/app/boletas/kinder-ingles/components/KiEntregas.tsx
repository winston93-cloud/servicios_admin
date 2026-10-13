'use client'

import { Eye, EyeOff, PencilLine, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { BoletaEntrega } from '@/lib/boletasEntrega'
import type { BoletaPublicacion } from '@/lib/boletasPortal'
import { kiApi } from './kiApi'

type GrupoTablero = {
  grado: number
  grupo: string
  etiqueta: string
  alumnos: number
  completos: number
  teacher: string | null
  entrega: BoletaEntrega
  publicable: boolean
  publicacion: BoletaPublicacion | null
}

function fecha(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Monterrey',
  })
}

function EstadoEntrega({ g }: { g: GrupoTablero }) {
  if (g.publicacion) {
    return <span className="ki-estado is-publicada">Publicada a papás</span>
  }
  if (g.entrega.estado === 'enviada') {
    return <span className="ki-estado is-enviada">Enviada · {fecha(g.entrega.enviadaAt)}</span>
  }
  if (g.entrega.estado === 'devuelta') {
    return <span className="ki-estado is-devuelta">Regresada a la teacher</span>
  }
  return <span className="ki-estado">En captura</span>
}

/** Tablero por grupo: avance, entrega de la teacher, regresar con comentario y publicar a papás. */
export default function KiEntregas({
  ciclo,
  trimestre,
  onRevisar,
}: {
  ciclo: number
  trimestre: number
  onRevisar: (grado: number, grupo: string) => void
}) {
  const [grupos, setGrupos] = useState<GrupoTablero[]>([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState('')
  const [err, setErr] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setErr('')
    try {
      const data = await kiApi<{ grupos: GrupoTablero[] }>(
        `/api/boletas-kinder-ingles/entregas?ciclo=${ciclo}&trimestre=${trimestre}`
      )
      setGrupos(data.grupos)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cargar el tablero.')
    } finally {
      setCargando(false)
    }
  }, [ciclo, trimestre])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function accion(g: GrupoTablero, tipo: 'devolver' | 'publicar' | 'retirar') {
    let comentario = ''
    if (tipo === 'devolver') {
      const r = window.prompt(
        `¿Qué debe corregir la teacher de ${g.etiqueta}? (se le mostrará al entrar; puedes dejarlo vacío)`,
        ''
      )
      if (r == null) return
      comentario = r
    } else if (tipo === 'publicar') {
      const aviso =
        g.entrega.estado !== 'enviada'
          ? `\n\nOjo: la teacher todavía no la envía a dirección (${g.completos} de ${g.alumnos} completas).`
          : ''
      if (!window.confirm(`¿Publicar las boletas del trimestre ${trimestre} de ${g.etiqueta} a los papás?${aviso}`)) return
    } else if (!window.confirm(`¿Retirar del portal de papás las boletas del trimestre ${trimestre} de ${g.etiqueta}?`)) {
      return
    }
    setOcupado(`${g.grado}-${g.grupo}`)
    setErr('')
    try {
      const data = await kiApi<{ grupos: GrupoTablero[] }>('/api/boletas-kinder-ingles/entregas', {
        method: 'POST',
        body: JSON.stringify({ accion: tipo, ciclo, trimestre, grado: g.grado, grupo: g.grupo, comentario }),
      })
      setGrupos(data.grupos)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setOcupado('')
    }
  }

  const enviados = grupos.filter((g) => g.entrega.estado === 'enviada').length
  const publicados = grupos.filter((g) => g.publicacion).length

  return (
    <section className="ki-paper bm-panel ki-tablero">
      <header className="ki-tablero-head">
        <p className="ki-hint">
          {cargando
            ? 'Cargando grupos…'
            : `${grupos.length} grupos · ${enviados} enviados a dirección · ${publicados} publicados a papás`}
        </p>
        <button type="button" className="ki-btn ghost" onClick={() => void cargar()} disabled={cargando}>
          Actualizar
        </button>
      </header>
      {err && (
        <p className="ki-msg is-error" role="alert">
          {err}
        </p>
      )}
      <ul className="ki-grupos">
        {grupos.map((g) => {
          const clave = `${g.grado}-${g.grupo}`
          const ok = g.alumnos > 0 && g.completos >= g.alumnos
          const pubModulo = g.publicacion && g.publicacion.grado === 0
          return (
            <li key={clave} className={`ki-grupo${g.publicacion ? ' is-publicada' : ''}`}>
              <div className="ki-grupo-top">
                <h3>{g.etiqueta}</h3>
                <EstadoEntrega g={g} />
              </div>
              <p className="ki-grupo-teacher">{g.teacher ?? 'Sin teacher asignada'}</p>
              <div className="ki-barra" aria-label={`${g.completos} de ${g.alumnos} boletas completas`}>
                <span style={{ width: `${g.alumnos ? Math.round((g.completos / g.alumnos) * 100) : 0}%` }} />
              </div>
              <p className={`ki-grupo-avance${ok ? ' is-ok' : ''}`}>
                {g.completos} de {g.alumnos} boletas completas
              </p>
              {g.entrega.estado === 'devuelta' && g.entrega.comentario ? (
                <p className="ki-grupo-nota">«{g.entrega.comentario}»</p>
              ) : null}
              <div className="ki-grupo-acciones">
                <button type="button" className="ki-btn" onClick={() => onRevisar(g.grado, g.grupo)}>
                  <PencilLine size={15} aria-hidden />
                  Revisar
                </button>
                {g.entrega.estado === 'enviada' && !g.publicacion && (
                  <button
                    type="button"
                    className="ki-btn"
                    disabled={ocupado === clave}
                    onClick={() => void accion(g, 'devolver')}
                  >
                    <Undo2 size={15} aria-hidden />
                    Regresar
                  </button>
                )}
                {g.publicable ? (
                  g.publicacion ? (
                    pubModulo ? (
                      <span className="ki-hint">Publicado para todo el módulo</span>
                    ) : (
                      <button
                        type="button"
                        className="ki-btn"
                        disabled={ocupado === clave}
                        onClick={() => void accion(g, 'retirar')}
                      >
                        <EyeOff size={15} aria-hidden />
                        Retirar
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      className="ki-btn primary"
                      disabled={ocupado === clave || g.alumnos === 0}
                      onClick={() => void accion(g, 'publicar')}
                    >
                      <Eye size={15} aria-hidden />
                      {ocupado === clave ? 'Guardando…' : 'Publicar a papás'}
                    </button>
                  )
                ) : (
                  <span className="ki-hint">Maternal no tiene boleta en el portal de papás</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
