'use client'

import { kiApi } from '@/app/boletas/kinder-ingles/components/kiApi'
import type { SecGrupo } from '@/lib/boletasSecundariaService'
import { FileText, Files, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

const API = '/api/boletas-secundaria'

type Alumno = { alumno_id: number; nombre: string }

type MateriaRevisada = {
  id: number
  nombre: string
  conCalif: number
  total: number
  classroom: 'leida' | 'congelada' | 'sin-clase' | 'error' | 'no-aplica'
  aviso: string | null
}

const ORIGEN: Record<MateriaRevisada['classroom'], string> = {
  leida: 'Classroom leído',
  congelada: 'enviada o publicada',
  'sin-clase': 'sin clase en Classroom',
  error: 'Classroom no respondió',
  'no-aplica': 'se captura a mano',
}

/** Boletas en PDF por grado y grupo: una por alumno o todo el grupo en un solo archivo. */
export default function SecBoletas({ ciclo, trimestre }: { ciclo: number; trimestre: number }) {
  const [grupos, setGrupos] = useState<SecGrupo[] | null>(null)
  const [sel, setSel] = useState<{ grado: number; grupo: string } | null>(null)
  const [alumnos, setAlumnos] = useState<Alumno[] | null>(null)
  const [err, setErr] = useState('')
  const [revision, setRevision] = useState<MateriaRevisada[] | null>(null)
  const [revisando, setRevisando] = useState(false)

  useEffect(() => {
    let vivo = true
    setErr('')
    setAlumnos(null)
    const qs = new URLSearchParams({ ciclo: String(ciclo) })
    if (sel) {
      qs.set('grado', String(sel.grado))
      qs.set('grupo', sel.grupo)
    }
    kiApi<{ grupos: SecGrupo[]; alumnos: Alumno[] }>(`${API}/alumnos?${qs}`)
      .then((d) => {
        if (!vivo) return
        setGrupos(d.grupos)
        if (!sel && d.grupos.length) setSel({ grado: d.grupos[0].grado, grupo: d.grupos[0].grupo })
        else setAlumnos(d.alumnos)
      })
      .catch((e) => vivo && setErr(e instanceof Error ? e.message : 'No se pudieron cargar los alumnos.'))
    return () => {
      vivo = false
    }
  }, [ciclo, sel])

  const revisar = useCallback(
    async (grado: number, grupo: string, vivo: () => boolean = () => true) => {
      setRevisando(true)
      setRevision(null)
      try {
        const d = await kiApi<{ materias: MateriaRevisada[] }>(`${API}/alumnos`, {
          method: 'POST',
          body: JSON.stringify({ ciclo, trimestre, grado, grupo }),
        })
        if (vivo()) setRevision(d.materias)
      } catch (e) {
        if (vivo()) setErr(e instanceof Error ? e.message : 'No se pudieron revisar las calificaciones.')
      } finally {
        if (vivo()) setRevisando(false)
      }
    },
    [ciclo, trimestre]
  )

  useEffect(() => {
    if (!sel) return
    let vivo = true
    void revisar(sel.grado, sel.grupo, () => vivo)
    return () => {
      vivo = false
    }
  }, [sel, revisar])

  const faltan = (revision ?? []).filter((m) => m.conCalif < m.total)
  const listo = !revisando && Boolean(alumnos?.length)

  const grados = [...new Set((grupos ?? []).map((g) => g.grado))].sort()
  const delGrado = (grupos ?? []).filter((g) => g.grado === sel?.grado)
  const actual = delGrado.find((g) => g.grupo === sel?.grupo)
  const pdf = (p: Record<string, string | number>) =>
    `${API}/pdf?${new URLSearchParams(Object.entries({ ciclo, periodo: trimestre, ...p }).map(([k, v]) => [k, String(v)]))}`

  return (
    <div className="ki-paper bm-panel sb-boletas">
      {err && (
        <p className="ki-msg is-error" role="alert">
          {err}
        </p>
      )}
      {!grupos && !err && <p className="ki-hint">Cargando grupos…</p>}
      {grupos && grupos.length === 0 && <p className="ki-hint">No hay grupos con alumnos en este ciclo.</p>}

      {grupos && grupos.length > 0 && sel && (
        <>
          <div className="sb-filtros">
            <div className="bc-trimestres" role="tablist" aria-label="Grado">
              {grados.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={sel.grado === g}
                  className={`ki-tab${sel.grado === g ? ' is-on' : ''}`}
                  onClick={() => {
                    if (sel.grado === g) return
                    const primero = (grupos ?? []).find((x) => x.grado === g)
                    setSel({ grado: g, grupo: primero?.grupo ?? 'A' })
                  }}
                >
                  {g + 6}°
                </button>
              ))}
            </div>
            <div className="bc-trimestres" role="tablist" aria-label="Grupo">
              {delGrado.map((g) => (
                <button
                  key={g.grupo}
                  type="button"
                  role="tab"
                  aria-selected={sel.grupo === g.grupo}
                  className={`ki-tab sc-g-${g.grupo}${sel.grupo === g.grupo ? ' is-on' : ''}`}
                  onClick={() => sel.grupo !== g.grupo && setSel({ grado: g.grado, grupo: g.grupo })}
                >
                  Grupo {g.grupo}
                </button>
              ))}
            </div>
          </div>

          <div className="sb-cabeza">
            <div>
              <h3>{actual?.etiqueta ?? `${sel.grado + 6}° ${sel.grupo}`}</h3>
              <p className="ki-hint">
                {alumnos ? `${alumnos.length} alumnos` : 'Cargando alumnos…'} · boletas hasta el trimestre {trimestre}
              </p>
            </div>
            <button
              type="button"
              className="ki-btn ghost"
              disabled={revisando}
              onClick={() => sel && void revisar(sel.grado, sel.grupo)}
            >
              <RefreshCw size={16} aria-hidden /> {revisando ? 'Trayendo de Classroom…' : 'Volver a traer'}
            </button>
            <a
              className="ki-btn primary"
              href={pdf({ grado: sel.grado, grupo: sel.grupo })}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!listo}
            >
              <Files size={16} aria-hidden /> Ver todo el grupo en PDF
            </a>
          </div>

          <div className="sb-revision" aria-live="polite">
            {revisando && (
              <p className="ki-hint">
                Trayendo de Classroom las calificaciones del trimestre {trimestre} de todas las materias del grupo; tarda
                unos segundos.
              </p>
            )}
            {revision && faltan.length === 0 && (
              <p className="ki-msg is-ok">Todas las materias tienen calificación del trimestre {trimestre}.</p>
            )}
            {revision && faltan.length > 0 && (
              <>
                <p className="ki-msg is-warn">
                  {faltan.length} de {revision.length} materias están incompletas: en la boleta saldrán en blanco y el
                  promedio todavía no es el final.
                </p>
                <ul className="sb-faltan">
                  {faltan.map((m) => (
                    <li key={m.id} title={m.aviso ?? undefined}>
                      <b>{m.nombre}</b>
                      <span>
                        {m.conCalif} de {m.total} ·{' '}
                        {m.classroom === 'leida' && m.conCalif === 0 ? 'aún sin calificar en Classroom' : ORIGEN[m.classroom]}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {alumnos && alumnos.length === 0 && <p className="ki-hint">Este grupo no tiene alumnos activos.</p>}
          {alumnos && alumnos.length > 0 && (
            <ol className="sb-lista">
              {alumnos.map((a, i) => (
                <li key={a.alumno_id}>
                  <span className="sb-n">{i + 1}</span>
                  <span className="sb-nombre">{a.nombre}</span>
                  <a
                    className="ki-btn ghost"
                    href={pdf({ alumnoId: a.alumno_id })}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!listo}
                  >
                    <FileText size={16} aria-hidden /> Ver boleta
                  </a>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}
