'use client'

import { kiApi } from '@/app/boletas/kinder-ingles/components/kiApi'
import { SECUNDARIA_GRADOS } from '@/lib/boletasSecundariaCatalog'
import type { SecAlumno, SecTableroGrupo, SecTableroMateria } from '@/lib/boletasSecundariaService'
import { CheckCircle2, Eye, Send, Undo2, Upload, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const API = '/api/boletas-secundaria'

function Chip({ m, publicada }: { m: SecTableroMateria; publicada: boolean }) {
  if (publicada) {
    return (
      <span className="sd-chip is-publicada">
        <CheckCircle2 size={12} aria-hidden /> Publicada
      </span>
    )
  }
  if (m.entrega.estado === 'enviada') {
    return (
      <span className="sd-chip is-enviada" title={m.entrega.enviadaPor ? `Envió: ${m.entrega.enviadaPor}` : undefined}>
        <Send size={12} aria-hidden /> Enviada
      </span>
    )
  }
  if (m.entrega.estado === 'devuelta') {
    return (
      <span className="sd-chip is-devuelta" title={m.entrega.comentario || undefined}>
        <Undo2 size={12} aria-hidden /> Regresada
      </span>
    )
  }
  return <span className="sd-chip">En captura</span>
}

/** Tablero de dirección: por grupo, qué materias ya envió cada maestro; regresar con comentario y publicar a papás. */
export default function SecEntregas({
  ciclo,
  trimestre,
  onRevisar,
}: {
  ciclo: number
  trimestre: number
  onRevisar: (materiaId: number, grado: number, grupo: string) => void
}) {
  const [grupos, setGrupos] = useState<SecTableroGrupo[] | null>(null)
  const [sinGrupo, setSinGrupo] = useState<SecAlumno[]>([])
  const [grado, setGrado] = useState(0)
  const [ocupado, setOcupado] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const cargar = useCallback(async () => {
    setErr('')
    try {
      const [t, c] = await Promise.all([
        kiApi<{ grupos: SecTableroGrupo[] }>(`${API}/entregas?ciclo=${ciclo}&trimestre=${trimestre}`),
        kiApi<{ sinGrupo: SecAlumno[] }>(`${API}/clases?ciclo=${ciclo}`),
      ])
      setGrupos(t.grupos)
      setSinGrupo(c.sinGrupo)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cargar el tablero.')
    }
  }, [ciclo, trimestre])

  useEffect(() => {
    setGrupos(null)
    void cargar()
  }, [cargar])

  async function accion(g: SecTableroGrupo, cuerpo: Record<string, unknown>, ok: string) {
    setOcupado(`${g.grado}-${g.grupo}-${String(cuerpo.materiaId ?? cuerpo.accion)}`)
    setErr('')
    setMsg('')
    try {
      const r = await kiApi<{ grupos: SecTableroGrupo[] }>(`${API}/entregas`, {
        method: 'POST',
        body: JSON.stringify({ ciclo, trimestre, grado: g.grado, grupo: g.grupo, ...cuerpo }),
      })
      setGrupos(r.grupos)
      setMsg(ok)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo completar.')
    } finally {
      setOcupado('')
    }
  }

  function regresar(g: SecTableroGrupo, m: SecTableroMateria) {
    const comentario = window.prompt(`Regresar ${m.materia} de ${g.etiqueta} a ${m.maestros.join(', ') || 'el maestro'}.\n\nComentario (opcional):`, '')
    if (comentario == null) return
    void accion(g, { accion: 'devolver', materiaId: m.materiaId, comentario }, `${m.materia} de ${g.etiqueta} regresada para corregir.`)
  }

  function publicar(g: SecTableroGrupo) {
    const faltan = g.materias.filter((m) => m.entrega.estado !== 'enviada')
    const aviso = faltan.length
      ? `Faltan ${faltan.length} materia(s) por enviar en ${g.etiqueta}:\n· ${faltan.map((m) => m.materia).join('\n· ')}\n\n¿Publicar el trimestre ${trimestre} a papás de todos modos?`
      : `¿Publicar el trimestre ${trimestre} de ${g.etiqueta} a los papás? Ya no se podrá editar mientras esté publicado.`
    if (!window.confirm(aviso)) return
    void accion(g, { accion: 'publicar' }, `${g.etiqueta}: trimestre ${trimestre} publicado a papás.`)
  }

  function retirar(g: SecTableroGrupo) {
    if (!window.confirm(`¿Retirar la publicación del trimestre ${trimestre} de ${g.etiqueta}? Los papás dejarán de verla.`)) return
    void accion(g, { accion: 'retirar' }, `${g.etiqueta}: publicación retirada.`)
  }

  const visibles = (grupos ?? []).filter((g) => !grado || g.grado === grado)

  return (
    <div className="sd-tablero">
      <div className="bc-trimestres" role="tablist" aria-label="Grado">
        {[{ valor: 0, etiqueta: 'Todos' }, ...SECUNDARIA_GRADOS].map((g) => (
          <button
            key={g.valor}
            type="button"
            role="tab"
            aria-selected={grado === g.valor}
            className={`ki-tab${grado === g.valor ? ' is-on' : ''}`}
            onClick={() => setGrado(g.valor)}
          >
            {g.etiqueta}
          </button>
        ))}
      </div>

      {sinGrupo.length > 0 && (
        <p className="sd-aviso" role="note">
          <strong>{sinGrupo.length} alumno(s) sin grupo asignado</strong> no aparecen en ninguna hoja:{' '}
          {sinGrupo.map((a) => a.nombre).join(', ')}. Asígnales grupo en el expediente del alumno.
        </p>
      )}
      {(msg || err) && (
        <p className={`ki-msg${err ? ' is-error' : ''}`} role={err ? 'alert' : 'status'}>
          {err || msg}
        </p>
      )}
      {!grupos && !err && <p className="ki-hint">Cargando tablero…</p>}
      {grupos && visibles.length === 0 && <p className="ki-hint">No hay grupos con alumnos en este ciclo.</p>}

      {visibles.map((g) => (
        <section key={`${g.grado}-${g.grupo}`} className={`sd-grupo sc-g-${g.grupo}`}>
          <header className="sd-grupo-head">
            <div>
              <h3>{g.etiqueta}</h3>
              <p>
                {g.alumnos} alumnos · {g.enviadas} de {g.materias.length} materias enviadas
                {g.publicada ? ' · publicado a papás' : ''}
              </p>
            </div>
            {g.publicada ? (
              <button type="button" className="ki-btn" disabled={Boolean(ocupado)} onClick={() => retirar(g)}>
                <XCircle size={16} aria-hidden /> Retirar publicación
              </button>
            ) : (
              <button type="button" className="ki-btn primary" disabled={Boolean(ocupado)} onClick={() => publicar(g)}>
                <Upload size={16} aria-hidden /> Publicar a papás
              </button>
            )}
          </header>
          <div className="sd-tabla-wrap">
            <table className="sd-tabla">
              <thead>
                <tr>
                  <th scope="col">Materia</th>
                  <th scope="col">Maestro</th>
                  <th scope="col">Avance</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {g.materias.map((m) => {
                  const pct = m.total ? Math.round((m.completos / m.total) * 100) : 0
                  return (
                    <tr key={m.materiaId}>
                      <td>
                        {m.materia}
                        {m.seccion === 'winston' && <span className="sd-chip is-set"> Winston</span>}
                      </td>
                      <td>{m.maestros.length ? m.maestros.join(', ') : <span className="sd-faltan">Sin asignar</span>}</td>
                      <td>
                        <span className="sd-avance" title={`${m.completos} de ${m.total} alumnos con calificación y conducta`}>
                          <i aria-hidden>
                            <b style={{ width: `${pct}%` }} />
                          </i>
                          <span>
                            {m.completos}/{m.total}
                          </span>
                        </span>
                      </td>
                      <td>
                        <Chip m={m} publicada={g.publicada} />
                      </td>
                      <td>
                        <div className="sd-acciones">
                          <button type="button" className="ki-btn ghost" onClick={() => onRevisar(m.materiaId, g.grado, g.grupo)}>
                            <Eye size={15} aria-hidden /> Revisar
                          </button>
                          {m.entrega.estado === 'enviada' && !g.publicada && (
                            <button
                              type="button"
                              className="ki-btn ghost"
                              disabled={Boolean(ocupado)}
                              onClick={() => regresar(g, m)}
                            >
                              <Undo2 size={15} aria-hidden /> Regresar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
