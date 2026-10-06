'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import {
  ESTADOS_PLANEACION,
  etiquetaGrado,
  lunesDe,
  textoSemana,
  type EstadoPlaneacion,
  type TeClassroomPlanItem,
  type TeClassroomPlaneaciones,
  type TeClassroomPlanTeacher,
  type TePlaneacion,
  type TeTeacher,
} from '@/lib/teamEnglish/teTypes'
import type { SeccionProps } from '../seccionTipos'
import { teAbrirArchivo, teAccion, teClassroomPlaneaciones, teSubir } from '../teApi'
import { ACEPTAR_DOCS, Avatar, Campo, Hoja, Semana, SelectorArchivo, Vacio } from './ui'

type Filtro = 'todas' | EstadoPlaneacion | 'faltan'

type EstadoGclass = { datos: TeClassroomPlaneaciones | null; cargando: boolean; error: string | null }

const cacheGclass = new Map<string, TeClassroomPlaneaciones>()

const TIPO_GCLASS: Record<TeClassroomPlanItem['tipo'], string> = { tarea: '📝 Tarea', material: '📄 Material', aviso: '📣 Aviso' }

function itemsDelGrado(t: TeClassroomPlanTeacher | undefined, teacher: TeTeacher, grado: number): TeClassroomPlanItem[] {
  if (!t) return []
  if (teacher.grados.length <= 1) return t.items
  const re = new RegExp(`(^|\\D)${grado}(\\D|$)`)
  const suyos = t.items.filter((x) => re.test(x.curso))
  return suyos.length ? suyos : t.items
}

function fechaHora(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export default function PlaneacionSeccion({ snap, recargar, avisar }: SeccionProps) {
  const hoyLunes = lunesDe(snap.hoy)
  const [lunes, setLunes] = useState(hoyLunes)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [subir, setSubir] = useState<{ teacher: TeTeacher; grado: number } | null>(null)

  const [gclass, setGclass] = useState<EstadoGclass>({ datos: null, cargando: false, error: null })
  const claveG = `${snap.nivel}|${lunes}`

  const cargarGclass = async (refrescar = false) => {
    const previo = cacheGclass.get(claveG)
    if (previo && !refrescar) {
      setGclass({ datos: previo, cargando: false, error: null })
      return
    }
    setGclass((g) => ({ datos: refrescar ? g.datos : null, cargando: true, error: null }))
    try {
      const r = await teClassroomPlaneaciones(snap.nivel, lunes, refrescar)
      cacheGclass.set(claveG, r)
      setGclass({ datos: r, cargando: false, error: null })
    } catch (e) {
      setGclass({ datos: null, cargando: false, error: e instanceof Error ? e.message : 'No se pudo leer Classroom.' })
    }
  }

  useEffect(() => {
    void cargarGclass()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveG])

  const activas = useMemo(() => snap.teachers.filter((t) => t.activo), [snap.teachers])
  const filas = useMemo(() => {
    const out: { teacher: TeTeacher; grado: number; plan: TePlaneacion | null }[] = []
    for (const t of activas) {
      for (const g of t.grados) {
        const plan = snap.planeaciones.find((p) => p.maestro_id === t.maestro_id && p.grado === g && p.semana === lunes) ?? null
        out.push({ teacher: t, grado: g, plan })
      }
    }
    return out
  }, [activas, snap.planeaciones, lunes])

  const conteo = {
    total: filas.length,
    entregadas: filas.filter((f) => f.plan).length,
    pendiente: filas.filter((f) => f.plan?.estado === 'pendiente').length,
    cambios: filas.filter((f) => f.plan?.estado === 'cambios').length,
    aprobada: filas.filter((f) => f.plan?.estado === 'aprobada').length,
  }
  const visibles = filas.filter((f) =>
    filtro === 'todas' ? true : filtro === 'faltan' ? !f.plan : f.plan?.estado === filtro
  )
  const otrasPendientes = snap.planeaciones.filter((p) => p.estado === 'pendiente' && p.semana !== lunes)
  const semanasPendientes = [...new Set(otrasPendientes.map((p) => p.semana))].sort()

  const chips: [Filtro, string, number][] = [
    ['todas', '🌈 Todas', conteo.total],
    ['pendiente', '⏳ Por revisar', conteo.pendiente],
    ['cambios', '✏️ Con cambios', conteo.cambios],
    ['aprobada', '✅ Aprobadas', conteo.aprobada],
    ['faltan', '😴 Faltan', conteo.total - conteo.entregadas],
  ]

  return (
    <>
      <div className="te-toolbar">
        <Semana lunes={lunes} onCambiar={setLunes} hoyLunes={hoyLunes} />
        <div className="te-progreso" aria-label={`${conteo.entregadas} de ${conteo.total} planeaciones entregadas`}>
          <span style={{ ['--p' as string]: conteo.total ? conteo.entregadas / conteo.total : 0 }} />
          <small>{conteo.entregadas}/{conteo.total} entregadas</small>
        </div>
      </div>

      <p className="te-nota te-gplan-estado">
        🏫 {gclass.cargando ? 'Buscando planeaciones en Google Classroom…' : gclass.error ? `Classroom: ${gclass.error}` : 'Se muestra lo que cada teacher subió a Classroom desde el lunes anterior hasta esta semana.'}
        <button type="button" className="te-btn te-btn-ghost te-btn-sm" disabled={gclass.cargando} onClick={() => void cargarGclass(true)}>
          {gclass.cargando ? <Loader2 size={14} className="te-spin" aria-hidden /> : '🔄'} Actualizar
        </button>
      </p>

      {semanasPendientes.length ? (
        <p className="te-alerta">
          <span aria-hidden>🔔</span>
          Hay {otrasPendientes.length} planeación{otrasPendientes.length === 1 ? '' : 'es'} por revisar en otras semanas:
          {semanasPendientes.map((s) => (
            <button key={s} type="button" className="te-chip te-chip-btn" onClick={() => setLunes(s)}>{textoSemana(s)}</button>
          ))}
        </p>
      ) : null}

      <div className="te-filtros" role="radiogroup" aria-label="Filtrar por estado">
        {chips.map(([id, txt, n]) => (
          <button key={id} type="button" role="radio" aria-checked={filtro === id} data-activo={filtro === id || undefined} onClick={() => setFiltro(id)}>
            {txt} <b>{n}</b>
          </button>
        ))}
      </div>

      {!activas.length ? (
        <Vacio emoji="👩‍🏫" titulo="Aún no hay teachers en el equipo" />
      ) : !visibles.length ? (
        <Vacio emoji={filtro === 'faltan' ? '🎉' : '🍃'} titulo={filtro === 'faltan' ? '¡Todas entregaron esta semana!' : 'Nada por aquí'} />
      ) : (
        <ul className="te-planes">
          {visibles.map(({ teacher, grado, plan }, i) => (
            <li key={`${teacher.maestro_id}-${grado}`} style={{ ['--i' as string]: i }}>
              <TarjetaPlan teacher={teacher} grado={grado} plan={plan} snap={snap} recargar={recargar} avisar={avisar}
                gclass={itemsDelGrado(gclass.datos?.teachers.find((x) => x.maestro_id === teacher.maestro_id), teacher, grado)}
                gclassError={gclass.datos?.teachers.find((x) => x.maestro_id === teacher.maestro_id)?.error ?? null}
                gclassCargando={gclass.cargando && !gclass.datos}
                onSubir={() => setSubir({ teacher, grado })} />
            </li>
          ))}
        </ul>
      )}

      <SubirPlaneacion destino={subir} lunes={lunes} snap={snap} onCerrar={() => setSubir(null)} recargar={recargar} avisar={avisar} />
    </>
  )
}

function TarjetaPlan({ teacher, grado, plan, snap, recargar, avisar, onSubir, gclass, gclassError, gclassCargando }: SeccionProps & {
  teacher: TeTeacher
  grado: number
  plan: TePlaneacion | null
  onSubir: () => void
  gclass: TeClassroomPlanItem[]
  gclassError: string | null
  gclassCargando: boolean
}) {
  const [comentando, setComentando] = useState(false)
  const [comentario, setComentario] = useState(plan?.comentario ?? '')
  const [guardando, setGuardando] = useState(false)

  const revisar = async (estado: EstadoPlaneacion, texto = '') => {
    if (!plan) return
    setGuardando(true)
    try {
      await teAccion(snap.nivel, 'revisar_planeacion', { id: plan.id, estado, comentario: texto })
      await recargar()
      setComentando(false)
      avisar(estado === 'aprobada' ? '¡Planeación aprobada! ✅' : estado === 'cambios' ? 'Se pidieron cambios a la teacher.' : 'Regresó a revisión.')
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!plan || !window.confirm('¿Eliminar esta planeación y su archivo?')) return
    try {
      await teAccion(snap.nivel, 'eliminar_planeacion', { id: plan.id })
      await recargar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    }
  }

  const estado = plan ? ESTADOS_PLANEACION[plan.estado] : null
  const enClassroom = gclass.some((x) => x.es_planeacion)
  return (
    <article className="te-plan" data-estado={plan?.estado ?? 'falta'}>
      <header className="te-plan-head">
        <Avatar emoji={teacher.emoji} fotoKey={teacher.foto_key} nombre={teacher.nombre} tam="sm" />
        <div className="te-min0">
          <strong>{teacher.nombre}</strong>
          <small>Grado {etiquetaGrado(snap.nivel, grado)}{teacher.grupos.length ? ` · ${teacher.grupos.filter((g) => Number(g[0]) === grado).join(', ')}` : ''}</small>
        </div>
        <span className="te-sello">{estado ? `${estado.emoji} ${estado.etiqueta}` : enClassroom ? '🏫 En Classroom' : '😴 Falta'}</span>
      </header>

      {plan ? (
        <>
          {plan.titulo ? <p className="te-plan-titulo">{plan.titulo}</p> : null}
          {plan.notas ? <p className="te-plan-notas">💬 {plan.notas}</p> : null}
          <p className="te-plan-meta">
            {plan.subido_rol === 'directora' ? '📥 Subida por dirección' : '📤 Subida por la teacher'} · {fechaHora(plan.updated_at)}
            {plan.version > 1 ? ` · versión ${plan.version}` : ''}
          </p>
          {plan.comentario && !comentando ? <p className="te-plan-comentario">✏️ {plan.comentario}</p> : null}

          {comentando ? (
            <div className="te-plan-form">
              <textarea className="te-input" rows={3} value={comentario} autoFocus placeholder="¿Qué le cambiarías? Ej. agregar warm-up y la rúbrica del speaking…"
                onChange={(e) => setComentario(e.target.value)} />
              <div className="te-fila-botones te-fila-fin">
                <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => setComentando(false)}>Cancelar</button>
                <button type="button" className="te-btn te-btn-cambios te-btn-sm" disabled={guardando || !comentario.trim()} onClick={() => void revisar('cambios', comentario)}>
                  {guardando ? <Loader2 size={14} className="te-spin" aria-hidden /> : '✏️'} Enviar cambios
                </button>
              </div>
            </div>
          ) : (
            <div className="te-fila-botones">
              {plan.archivo_key ? (
                <button type="button" className="te-btn te-btn-sm" onClick={() => teAbrirArchivo(plan.archivo_key!).catch((e) => avisar(e.message, 'error'))}>
                  📎 Ver plan
                </button>
              ) : null}
              {plan.estado !== 'aprobada' ? (
                <button type="button" className="te-btn te-btn-ok te-btn-sm" disabled={guardando} onClick={() => void revisar('aprobada', plan.comentario)}>✅ Aprobar</button>
              ) : (
                <button type="button" className="te-btn te-btn-ghost te-btn-sm" disabled={guardando} onClick={() => void revisar('pendiente', plan.comentario)}>↩️ Regresar a revisión</button>
              )}
              {plan.estado !== 'aprobada' ? (
                <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={() => { setComentario(plan.comentario); setComentando(true) }}>✏️ Pedir cambios</button>
              ) : null}
              <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={onSubir}>🔁 Reemplazar</button>
              <button type="button" className="te-btn te-btn-ghost te-btn-sm te-peligro" onClick={() => void eliminar()}>🗑️</button>
            </div>
          )}
        </>
      ) : (
        <div className="te-fila-botones">
          <button type="button" className="te-btn te-btn-ghost te-btn-sm" onClick={onSubir}>
            <Upload size={14} aria-hidden /> Subir por ella
          </button>
        </div>
      )}
      <BloqueClassroom items={gclass} error={gclassError} cargando={gclassCargando} />
    </article>
  )
}

function fechaCorta(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short' })
}

function BloqueClassroom({ items, error, cargando }: { items: TeClassroomPlanItem[]; error: string | null; cargando: boolean }) {
  const [verTodo, setVerTodo] = useState(false)
  if (cargando) return <p className="te-gplan-vacio"><Loader2 size={13} className="te-spin" aria-hidden /> Revisando Classroom…</p>
  if (error) return <p className="te-gplan-vacio">⚠️ Classroom: {error}</p>
  const planes = items.filter((x) => x.es_planeacion)
  const otros = items.filter((x) => !x.es_planeacion)
  const lista = verTodo ? [...planes, ...otros] : planes
  return (
    <div className="te-gplan">
      {lista.length ? (
        <ul className="te-gplan-lista">
          {lista.map((x) => (
            <li key={`${x.tipo}-${x.id}`} data-plan={x.es_planeacion || undefined}>
              <div className="te-min0">
                {x.enlace ? <a href={x.enlace} target="_blank" rel="noopener noreferrer"><b>{x.titulo}</b> ↗</a> : <b>{x.titulo}</b>}
                <small>
                  {TIPO_GCLASS[x.tipo]} · {x.curso}{x.tema ? ` · 🏷️ ${x.tema}` : ''} · {fechaCorta(x.fecha)}{x.borrador ? ' · 📝 Borrador' : ''}
                </small>
                {x.adjuntos.length ? (
                  <span className="te-gplan-adjuntos">
                    {x.adjuntos.map((a, i) => (
                      <a key={i} href={a.enlace} target="_blank" rel="noopener noreferrer">📎 {a.titulo}</a>
                    ))}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="te-gplan-vacio">🏫 Sin planeación en Classroom para esta semana.</p>
      )}
      {otros.length ? (
        <button type="button" className="te-btn te-btn-ghost te-btn-sm" aria-expanded={verTodo} onClick={() => setVerTodo((v) => !v)}>
          {verTodo ? 'Ver solo planeaciones' : `Ver todo lo publicado en Classroom (${otros.length})`}
        </button>
      ) : null}
    </div>
  )
}

function SubirPlaneacion({ destino, lunes, snap, onCerrar, recargar, avisar }: SeccionProps & {
  destino: { teacher: TeTeacher; grado: number } | null
  lunes: string
  onCerrar: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [notas, setNotas] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const previo = destino
    ? snap.planeaciones.find((p) => p.maestro_id === destino.teacher.maestro_id && p.grado === destino.grado && p.semana === lunes)
    : null

  const cerrar = () => {
    setTitulo('')
    setNotas('')
    setArchivo(null)
    onCerrar()
  }

  const guardar = async () => {
    if (!destino) return
    setGuardando(true)
    try {
      await teSubir(snap.nivel, {
        tipo: 'planeacion',
        maestro_id: destino.teacher.maestro_id,
        grado: destino.grado,
        semana: lunes,
        titulo: titulo || previo?.titulo || '',
        notas: notas || previo?.notas || '',
        archivo,
      })
      await recargar()
      avisar('Planeación guardada.')
      cerrar()
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Hoja abierta={!!destino} titulo="Subir planeación" emoji="📚" onCerrar={cerrar}
      pie={
        <>
          <button type="button" className="te-btn te-btn-ghost" onClick={cerrar}>Cancelar</button>
          <button type="button" className="te-btn te-btn-primary" disabled={guardando || (!archivo && !previo)} onClick={() => void guardar()}>
            {guardando ? <Loader2 size={16} className="te-spin" aria-hidden /> : <Upload size={16} aria-hidden />} Guardar
          </button>
        </>
      }>
      {destino ? (
        <div className="te-form">
          <p className="te-nota" data-completo>
            {destino.teacher.emoji} <b>{destino.teacher.nombre}</b> · Grado {etiquetaGrado(snap.nivel, destino.grado)} · semana del {textoSemana(lunes)}
          </p>
          <Campo etiqueta="Título (opcional)" completo>
            <input className="te-input" value={titulo} maxLength={200} placeholder={previo?.titulo || 'Unit 3 · Animals'} onChange={(e) => setTitulo(e.target.value)} />
          </Campo>
          <Campo etiqueta="Notas (opcional)" completo>
            <textarea className="te-input" rows={3} value={notas} placeholder={previo?.notas || ''} onChange={(e) => setNotas(e.target.value)} />
          </Campo>
          <div className="te-campo" data-completo>
            <SelectorArchivo etiqueta={previo ? 'Reemplazar archivo (opcional)' : 'Archivo de la planeación'} archivo={archivo} onArchivo={setArchivo} aceptar={ACEPTAR_DOCS} />
            <span className="te-campo-ayuda">PDF, Word, PowerPoint, Excel o imagen · máximo 15 MB. Queda «Por revisar».</span>
          </div>
        </div>
      ) : null}
    </Hoja>
  )
}
