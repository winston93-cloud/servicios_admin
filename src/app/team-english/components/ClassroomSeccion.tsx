'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  etiquetaGrado,
  lunesDe,
  type TeClassroom,
  type TeClassroomCurso,
  type TeClassroomDetalle,
  type TeClassroomResumen,
  type TeNivel,
  type TeTeacher,
} from '@/lib/teamEnglish/teTypes'
import type { SeccionProps } from '../seccionTipos'
import { teAccion, teClassroomDetalle, teClassroomGoogle } from '../teApi'
import { Avatar, Hoja, Semana, Vacio } from './ui'

const cacheGoogle = new Map<string, TeClassroomResumen>()

function haceCuanto(iso: string | null): string {
  if (!iso) return 'Sin actividad'
  const dias = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} días`
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}

function PanelGoogle({ nivel, teacher }: { nivel: TeNivel; teacher: TeTeacher }) {
  const clave = `${nivel}-${teacher.maestro_id}`
  const [datos, setDatos] = useState<TeClassroomResumen | null>(cacheGoogle.get(clave) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [curso, setCurso] = useState<TeClassroomCurso | null>(null)
  const cerrarCurso = useCallback(() => setCurso(null), [])

  const cargar = async (forzar = false) => {
    if (!forzar && cacheGoogle.has(clave)) return
    setCargando(true)
    setError(null)
    try {
      const r = await teClassroomGoogle(nivel, teacher.maestro_id)
      cacheGoogle.set(clave, r)
      setDatos(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer Classroom.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    setDatos(cacheGoogle.get(clave) ?? null)
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  return (
    <section className="te-gclass" aria-busy={cargando}>
      <header>
        <Avatar emoji={teacher.emoji} fotoKey={teacher.foto_key} nombre={teacher.nombre} tam="sm" />
        <div className="te-min0">
          <strong>Google Classroom de {teacher.nombre}</strong>
          <small>{teacher.email ?? 'Sin correo registrado'}</small>
        </div>
        <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => void cargar(true)} disabled={cargando}>
          {cargando ? 'Leyendo…' : '🔄 Actualizar'}
        </button>
      </header>
      {error ? (
        <p className="te-gclass-error" role="alert">😿 {error}</p>
      ) : cargando && !datos ? (
        <p className="te-cargando">Leyendo sus clases de Classroom…</p>
      ) : datos && !datos.cursos.length ? (
        <p className="te-nota">No tiene clases activas como maestra en Classroom.</p>
      ) : datos ? (
        <ul className="te-gclass-cursos">
          {datos.cursos.map((c) => (
            <li key={c.id}>
              <article className="te-gclass-curso">
                <div className="te-min0">
                  <strong>{c.nombre}</strong>
                  {c.seccion ? <small>{c.seccion}</small> : null}
                </div>
                <dl>
                  <div><dt>Alumnos</dt><dd>{c.alumnos}</dd></div>
                  <div><dt>Tareas (30 días)</dt><dd>{c.tareas_30d}</dd></div>
                  <div><dt>Avisos (30 días)</dt><dd>{c.avisos_30d}</dd></div>
                  <div><dt>Tareas totales</dt><dd>{c.tareas >= 100 ? '100+' : c.tareas}</dd></div>
                </dl>
                <footer>
                  <span className="te-chip te-chip-suave">🕒 {haceCuanto(c.ultima_actividad)}</span>
                  <button type="button" className="te-btn te-btn-primary te-btn-sm" onClick={() => setCurso(c)}>Ver detalle</button>
                </footer>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
      <DetalleCurso nivel={nivel} teacher={teacher} curso={curso} onCerrar={cerrarCurso} />
    </section>
  )
}

const fmtFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Monterrey' })
const fecha = (iso: string | null) => (iso ? fmtFecha.format(new Date(iso)) : '—')
const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0)
const cacheDetalle = new Map<string, TeClassroomDetalle>()

const TIPOS_TAREA: Record<string, string> = {
  ASSIGNMENT: '📝 Tarea',
  SHORT_ANSWER_QUESTION: '❓ Pregunta',
  MULTIPLE_CHOICE_QUESTION: '🔘 Opción múltiple',
}

function DetalleCurso({ nivel, teacher, curso, onCerrar }: { nivel: TeNivel; teacher: TeTeacher; curso: TeClassroomCurso | null; onCerrar: () => void }) {
  const clave = curso ? `${teacher.maestro_id}-${curso.id}` : ''
  const [datos, setDatos] = useState<TeClassroomDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!curso) return
    const previo = cacheDetalle.get(clave) ?? null
    setDatos(previo)
    setError(null)
    if (previo) return
    let vivo = true
    setCargando(true)
    teClassroomDetalle(nivel, teacher.maestro_id, curso.id)
      .then((r) => {
        cacheDetalle.set(clave, r)
        if (vivo) setDatos(r)
      })
      .catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : 'No se pudo leer la clase.'))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [clave, curso, nivel, teacher.maestro_id])

  const ahora = new Date().toISOString()
  const t = datos?.tareas ?? []
  const asignados = t.reduce((s, x) => s + x.asignados, 0)
  const entregadas = t.reduce((s, x) => s + x.entregadas, 0)
  const calificadas = t.reduce((s, x) => s + x.calificadas, 0)
  const vencidasSinCalificar = t.filter((x) => x.entrega && x.entrega < ahora && x.entregadas > x.calificadas).length

  return (
    <Hoja abierta={!!curso} titulo={curso?.nombre ?? ''} emoji="💻" onCerrar={onCerrar}
      pie={curso?.enlace ? (
        <a className="te-btn te-btn-ghost" href={curso.enlace} target="_blank" rel="noopener noreferrer">Abrir en Classroom ↗</a>
      ) : undefined}>
      {error ? (
        <p className="te-gclass-error" role="alert">😿 {error}</p>
      ) : cargando && !datos ? (
        <p className="te-cargando">Leyendo tareas y entregas…</p>
      ) : datos ? (
        <>
          <dl className="te-gdet-resumen">
            <div><dt>Alumnos</dt><dd>{datos.alumnos}</dd></div>
            <div><dt>Tareas</dt><dd>{t.length}</dd></div>
            <div><dt>Entregadas</dt><dd>{pct(entregadas, asignados)}%</dd></div>
            <div><dt>Calificadas</dt><dd>{pct(calificadas, entregadas)}%</dd></div>
            <div data-alerta={vencidasSinCalificar > 0 || undefined}><dt>Vencidas sin calificar</dt><dd>{vencidasSinCalificar}</dd></div>
          </dl>

          <section className="te-gdet-bloque">
            <h3>📝 Tareas</h3>
            {!t.length ? <p className="te-nota">Aún no hay tareas publicadas.</p> : (
              <ul className="te-gdet-tareas">
                {t.map((x) => {
                  const pendientes = Math.max(x.entregadas - x.calificadas, 0)
                  return (
                    <li key={x.id}>
                      <div className="te-gdet-tarea-top">
                        <strong>{x.titulo}</strong>
                        <span className="te-chip te-chip-suave">{TIPOS_TAREA[x.tipo] ?? x.tipo}</span>
                      </div>
                      <small>
                        Publicada {fecha(x.publicada)} · Entrega {fecha(x.entrega)}
                        {x.puntos ? ` · ${x.puntos} pts` : ''}
                      </small>
                      <div className="te-gdet-barras">
                        <span>Entregadas <b>{x.entregadas}/{x.asignados}</b></span>
                        <span>Calificadas <b>{x.calificadas}/{x.entregadas}</b></span>
                        {x.tarde ? <span>Tarde <b>{x.tarde}</b></span> : null}
                        {pendientes ? <span data-alerta>Por calificar <b>{pendientes}</b></span> : null}
                      </div>
                      <div className="te-gdet-barra" aria-hidden>
                        <span style={{ width: `${pct(x.calificadas, x.asignados)}%` }} data-tipo="calificadas" />
                        <span style={{ width: `${pct(pendientes, x.asignados)}%` }} data-tipo="pendientes" />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="te-gdet-bloque">
            <h3>📣 Avisos recientes</h3>
            {!datos.avisos.length ? <p className="te-nota">Sin avisos.</p> : (
              <ul className="te-gdet-pubs">
                {datos.avisos.map((a) => <li key={a.id}><small>{fecha(a.fecha)}</small><p>{a.texto || '(sin texto)'}</p></li>)}
              </ul>
            )}
          </section>

          <section className="te-gdet-bloque">
            <h3>📚 Materiales</h3>
            {!datos.materiales.length ? <p className="te-nota">Sin materiales.</p> : (
              <ul className="te-gdet-pubs">
                {datos.materiales.map((m) => <li key={m.id}><small>{fecha(m.fecha)}</small><p>{m.texto || '(sin título)'}</p></li>)}
              </ul>
            )}
          </section>
          <p className="te-nota">Se muestran las {t.length >= 60 ? '60 tareas más recientes' : 'tareas publicadas'}, con avisos y materiales recientes. Solo lectura.</p>
        </>
      ) : null}
    </Hoja>
  )
}

type Campo = 'actualizado' | 'actividades_calificadas' | 'trabajos_revisados'

const CRITERIOS: { campo: Campo; etiqueta: string; emoji: string }[] = [
  { campo: 'actualizado', etiqueta: 'Classroom actualizado', emoji: '🔄' },
  { campo: 'actividades_calificadas', etiqueta: 'Actividades calificadas', emoji: '📝' },
  { campo: 'trabajos_revisados', etiqueta: 'Trabajos revisados', emoji: '📂' },
]

type Fila = { teacher: TeTeacher; grupo: string; reg: TeClassroom | null }

function semaforo(n: number) {
  if (n === 3) return { emoji: '🌟', texto: 'Al día', tono: 'ok' }
  if (n === 2) return { emoji: '🙂', texto: 'Casi', tono: 'warn' }
  if (n === 1) return { emoji: '😬', texto: 'Atrasado', tono: 'bad' }
  return { emoji: '⚪', texto: 'Sin revisar', tono: 'none' }
}

export default function ClassroomSeccion({ snap, recargar, avisar }: SeccionProps) {
  const hoyLunes = lunesDe(snap.hoy)
  const [lunes, setLunes] = useState(hoyLunes)
  const [locales, setLocales] = useState<Record<string, Partial<TeClassroom>>>({})
  const [notaAbierta, setNotaAbierta] = useState<string | null>(null)
  const [seleccion, setSeleccion] = useState<number | null>(null)
  const activas = useMemo(() => snap.teachers.filter((x) => x.activo), [snap.teachers])
  const teacherSel = activas.find((t) => t.maestro_id === seleccion) ?? null

  const filas = useMemo(() => {
    const out: Fila[] = []
    for (const t of activas.filter((x) => seleccion == null || x.maestro_id === seleccion)) {
      const grupos = t.grupos.length ? t.grupos : ['GEN']
      for (const g of grupos) {
        out.push({ teacher: t, grupo: g, reg: snap.classroom.find((c) => c.maestro_id === t.maestro_id && c.semana === lunes && c.grupo === g) ?? null })
      }
    }
    return out
  }, [activas, seleccion, snap.classroom, lunes])

  const clave = (f: Fila) => `${f.teacher.maestro_id}-${f.grupo}-${lunes}`
  const valor = (f: Fila) => ({
    actualizado: false,
    actividades_calificadas: false,
    trabajos_revisados: false,
    notas: '',
    ...(f.reg ?? {}),
    ...(locales[clave(f)] ?? {}),
  })

  const guardar = async (f: Fila, cambios: Partial<TeClassroom>) => {
    const k = clave(f)
    const nuevo = { ...valor(f), ...cambios }
    setLocales((p) => ({ ...p, [k]: nuevo }))
    try {
      await teAccion(snap.nivel, 'classroom', {
        maestro_id: f.teacher.maestro_id,
        semana: lunes,
        grupo: f.grupo,
        actualizado: nuevo.actualizado,
        actividades_calificadas: nuevo.actividades_calificadas,
        trabajos_revisados: nuevo.trabajos_revisados,
        notas: nuevo.notas,
      })
      await recargar()
      setLocales((p) => {
        const c = { ...p }
        delete c[k]
        return c
      })
    } catch (e) {
      setLocales((p) => {
        const c = { ...p }
        delete c[k]
        return c
      })
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  const puntos = filas.reduce((s, f) => {
    const v = valor(f)
    return s + CRITERIOS.filter((c) => v[c.campo]).length
  }, 0)
  const pct = filas.length ? (100 * puntos) / (filas.length * 3) : 0
  const alDia = filas.filter((f) => CRITERIOS.every((c) => valor(f)[c.campo])).length

  const etiquetaGrupo = (g: string) => (g === 'GEN' ? 'General' : `${etiquetaGrado(snap.nivel, Number(g[0]))}${g.slice(1)}`)

  return (
    <>
      <div className="te-toolbar">
        <Semana lunes={lunes} onCambiar={setLunes} hoyLunes={hoyLunes} />
        <div className="te-progreso" aria-label={`${pct.toFixed(0)}% revisado`}>
          <span style={{ ['--p' as string]: pct / 100 }} />
          <small>{pct.toFixed(0)}% · {alDia}/{filas.length} grupos al día</small>
        </div>
      </div>
      {activas.length ? (
        <div className="te-filtros" role="group" aria-label="Teacher">
          <button type="button" data-activo={seleccion == null || undefined} aria-pressed={seleccion == null} onClick={() => setSeleccion(null)}>
            Todas
          </button>
          {activas.map((t) => (
            <button key={t.maestro_id} type="button" data-activo={seleccion === t.maestro_id || undefined} aria-pressed={seleccion === t.maestro_id}
              onClick={() => setSeleccion(t.maestro_id)}>
              <span aria-hidden>{t.emoji}</span> {t.nombre.split(' ')[0]}
            </button>
          ))}
        </div>
      ) : null}
      {teacherSel ? (
        <PanelGoogle nivel={snap.nivel} teacher={teacherSel} />
      ) : activas.length ? (
        <p className="te-nota te-leyenda">💡 Elige una teacher para ver sus clases de Google Classroom.</p>
      ) : null}
      <p className="te-nota te-leyenda">
        Toca cada sticker al revisar el Classroom del grupo: {CRITERIOS.map((c) => `${c.emoji} ${c.etiqueta}`).join(' · ')}. Se guarda solo.
      </p>

      {!filas.length ? (
        <Vacio emoji="💻" titulo="Aún no hay teachers en el equipo" />
      ) : (
        <ul className="te-classrooms">
          {filas.map((f, i) => {
            const v = valor(f)
            const n = CRITERIOS.filter((c) => v[c.campo]).length
            const s = semaforo(n)
            const k = clave(f)
            return (
              <li key={k} style={{ ['--i' as string]: i }}>
                <article className="te-classroom" data-tono={s.tono}>
                  <header>
                    <Avatar emoji={f.teacher.emoji} fotoKey={f.teacher.foto_key} nombre={f.teacher.nombre} tam="sm" />
                    <div className="te-min0">
                      <strong>{f.teacher.nombre}</strong>
                      <small>Grupo {etiquetaGrupo(f.grupo)}</small>
                    </div>
                    <span className="te-semaforo" title={s.texto}><span aria-hidden>{s.emoji}</span> {s.texto}</span>
                  </header>
                  <div className="te-criterios">
                    {CRITERIOS.map((c) => (
                      <button key={c.campo} type="button" aria-pressed={v[c.campo]} data-activo={v[c.campo] || undefined}
                        onClick={() => void guardar(f, { [c.campo]: !v[c.campo] })}>
                        <span aria-hidden>{v[c.campo] ? '✅' : c.emoji}</span>
                        {c.etiqueta}
                      </button>
                    ))}
                  </div>
                  {notaAbierta === k ? (
                    <form className="te-classroom-nota" onSubmit={(e) => {
                      e.preventDefault()
                      const notas = String(new FormData(e.currentTarget).get('notas') ?? '')
                      setNotaAbierta(null)
                      void guardar(f, { notas })
                    }}>
                      <input name="notas" className="te-input" defaultValue={v.notas} maxLength={1000} autoFocus placeholder="Ej. faltan calificar 2 tareas de la unidad 4" />
                      <button type="submit" className="te-btn te-btn-primary te-btn-sm">Guardar</button>
                    </form>
                  ) : (
                    <button type="button" className="te-nota-btn" onClick={() => setNotaAbierta(k)}>
                      💬 {v.notas || 'Agregar nota'}
                    </button>
                  )}
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
