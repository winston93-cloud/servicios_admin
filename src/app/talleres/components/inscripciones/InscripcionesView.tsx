'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Download,
  Loader2,
  MapPin,
  Printer,
  RotateCcw,
  StickyNote,
  Trash2,
  UserMinus,
  UserRound,
  Users,
} from 'lucide-react'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import {
  CATEGORIAS_TALLER,
  COLORES_TALLER,
  NIVELES_TALLER,
  estadoCupo,
  etiquetaGradoAlumno,
  etiquetaNivel,
  lugarDeHorario,
  nombreMaestroTaller,
  nombreTallerCompleto,
  textoCupo,
  type AlumnoBusquedaTaller,
  type AlumnoTaller,
  type Taller,
  type TallerAsignacion,
  type TallerInscripcion,
  type TallerMaestro,
  type TalleresSnapshot,
} from '@/lib/talleres/talleresTypes'
import { TlModal } from '../TalleresUi'
import { norm, Resaltar } from '../busqueda'
import AlumnoBuscador from './AlumnoBuscador'
import {
  descargarCsv,
  evaluarAlumnoEnGrupo,
  fechaCorta,
  horarioCorto,
  imprimirLista,
  nombreGrupo,
} from './inscripcionesUtil'

type Modo = 'taller' | 'alumno'

type Confirmacion = { avisos: string[]; ejecutar: () => Promise<void> }

type Ctx = {
  data: TalleresSnapshot
  tallerPorId: Map<number, Taller>
  maestroPorId: Map<number, TallerMaestro>
  rev: number
  enviar: (body: Record<string, unknown>, exito: string, alTerminar?: () => void) => Promise<boolean>
  quitar: (id: number, modo: 'baja' | 'eliminar', exito: string, motivo?: string) => Promise<boolean>
  pedirMover: (ins: TallerInscripcion) => void
  pedirBaja: (ins: TallerInscripcion) => void
  pedirNotas: (ins: TallerInscripcion) => void
}

function ordenCategoria(c: string | null): number {
  const i = CATEGORIAS_TALLER.findIndex((x) => norm(x) === norm(c ?? ''))
  return i === -1 ? CATEGORIAS_TALLER.length : i
}

export default function InscripcionesView({
  data,
  onConteos,
  onAviso,
  onError,
}: {
  data: TalleresSnapshot
  onConteos: (conteos: Record<number, number>) => void
  onAviso: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [modo, setModo] = useState<Modo>('taller')
  const [rev, setRev] = useState(0)
  const [confirmar, setConfirmar] = useState<Confirmacion | null>(null)
  const [mover, setMover] = useState<TallerInscripcion | null>(null)
  const [baja, setBaja] = useState<TallerInscripcion | null>(null)
  const [notas, setNotas] = useState<TallerInscripcion | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const tallerPorId = useMemo(() => new Map(data.talleres.map((t) => [t.id, t])), [data.talleres])
  const maestroPorId = useMemo(() => new Map(data.maestros.map((m) => [m.id, m])), [data.maestros])

  const enviar = useCallback(
    async (body: Record<string, unknown>, exito: string, alTerminar?: () => void): Promise<boolean> => {
      setOcupado(true)
      try {
        const res = await fetch('/api/talleres/inscripciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...portalSessionFetchHeaders() },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (res.status === 422 && Array.isArray(json.advertencias)) {
          setConfirmar({
            avisos: json.advertencias as string[],
            ejecutar: async () => {
              await enviar({ ...body, forzar: true }, exito, alTerminar)
            },
          })
          return false
        }
        if (!res.ok) throw new Error(json.error || 'No se pudo guardar.')
        onConteos(json.conteos ?? {})
        setRev((r) => r + 1)
        onAviso(exito)
        alTerminar?.()
        return true
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Error al guardar')
        return false
      } finally {
        setOcupado(false)
      }
    },
    [onAviso, onConteos, onError]
  )

  const quitar = useCallback(
    async (id: number, modoQuitar: 'baja' | 'eliminar', exito: string, motivo?: string): Promise<boolean> => {
      setOcupado(true)
      try {
        const qs = new URLSearchParams({ id: String(id), modo: modoQuitar })
        if (motivo) qs.set('motivo', motivo)
        const res = await fetch(`/api/talleres/inscripciones?${qs}`, {
          method: 'DELETE',
          headers: portalSessionFetchHeaders(),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'No se pudo completar.')
        onConteos(json.conteos ?? {})
        setRev((r) => r + 1)
        onAviso(exito)
        return true
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Error')
        return false
      } finally {
        setOcupado(false)
      }
    },
    [onAviso, onConteos, onError]
  )

  const ctx: Ctx = {
    data,
    tallerPorId,
    maestroPorId,
    rev,
    enviar,
    quitar,
    pedirMover: setMover,
    pedirBaja: setBaja,
    pedirNotas: setNotas,
  }

  return (
    <section className="tl-panel tl-ins" aria-label="Inscripciones a talleres">
      <div className="tl-ins-top">
        <div className="tl-seg" role="group" aria-label="Consultar por">
          <button type="button" data-activo={modo === 'taller' || undefined} aria-pressed={modo === 'taller'} onClick={() => setModo('taller')}>
            <Users size={16} aria-hidden /> Por taller
          </button>
          <button type="button" data-activo={modo === 'alumno' || undefined} aria-pressed={modo === 'alumno'} onClick={() => setModo('alumno')}>
            <UserRound size={16} aria-hidden /> Por alumno
          </button>
        </div>
        <p className="tl-muted tl-ins-ayuda">
          {modo === 'taller'
            ? 'Elige un grupo, escribe el nombre o No. de control del alumno y presiona Enter para inscribirlo.'
            : 'Busca a un alumno para ver sus talleres, inscribirlo en otro, cambiarlo de grupo o darlo de baja.'}
        </p>
        {ocupado ? <Loader2 size={18} className="tl-spin tl-ins-ocupado" aria-label="Guardando" /> : null}
      </div>

      {modo === 'taller' ? <PorTaller ctx={ctx} /> : <PorAlumno ctx={ctx} />}

      <TlModal
        abierto={Boolean(confirmar)}
        titulo="Revisa antes de continuar"
        onCerrar={() => setConfirmar(null)}
        pie={
          <>
            <button type="button" className="tl-btn" onClick={() => setConfirmar(null)}>Cancelar</button>
            <button
              type="button"
              className="tl-btn tl-btn-primary"
              onClick={async () => {
                const c = confirmar
                setConfirmar(null)
                await c?.ejecutar()
              }}
            >
              Continuar de todos modos
            </button>
          </>
        }
      >
        <ul className="tl-avisos">
          {confirmar?.avisos.map((a) => (
            <li key={a}><AlertTriangle size={16} aria-hidden /> {a}</li>
          ))}
        </ul>
      </TlModal>

      {mover ? <MoverModal ctx={ctx} inscripcion={mover} onCerrar={() => setMover(null)} /> : null}
      {baja ? <BajaModal ctx={ctx} inscripcion={baja} onCerrar={() => setBaja(null)} /> : null}
      {notas ? <NotasModal ctx={ctx} inscripcion={notas} onCerrar={() => setNotas(null)} /> : null}
    </section>
  )
}

/* ───────────── Por taller ───────────── */

function PorTaller({ ctx }: { ctx: Ctx }) {
  const { data, tallerPorId, maestroPorId } = ctx
  const conteoNivel = useMemo(() => {
    const m = new Map<number, number>()
    for (const n of NIVELES_TALLER) m.set(n.valor, data.asignaciones.filter((a) => a.niveles.includes(n.valor)).length)
    return m
  }, [data.asignaciones])
  const [nivel, setNivel] = useState(0)
  const [filtro, setFiltro] = useState('')
  const [grupoId, setGrupoId] = useState(0)

  const grupos = useMemo(() => {
    const palabras = norm(filtro).split(/\s+/).filter(Boolean)
    return data.asignaciones
      .filter((a) => !nivel || a.niveles.includes(nivel))
      .map((a) => {
        const t = tallerPorId.get(a.taller_id)
        const m = maestroPorId.get(a.maestro_id)
        const texto = norm([t ? nombreTallerCompleto(t) : '', m ? nombreMaestroTaller(m) : '', t?.categoria ?? ''].join(' '))
        return { a, t, m, texto }
      })
      .filter((g) => palabras.every((p) => g.texto.includes(p)))
      .sort(
        (x, y) =>
          ordenCategoria(x.t?.categoria ?? null) - ordenCategoria(y.t?.categoria ?? null) ||
          (x.t ? nombreTallerCompleto(x.t) : '').localeCompare(y.t ? nombreTallerCompleto(y.t) : '', 'es', { numeric: true })
      )
  }, [data.asignaciones, nivel, filtro, tallerPorId, maestroPorId])

  const seleccionado = data.asignaciones.find((a) => a.id === grupoId) ?? null
  const totalInscritos = data.asignaciones
    .filter((a) => !nivel || a.niveles.includes(nivel))
    .reduce((s, a) => s + a.inscritos, 0)

  let categoriaPrev = ''

  return (
    <div className="tl-ins-layout" data-sel={seleccionado ? true : undefined}>
      <aside className="tl-ins-grupos" aria-label="Grupos">
        <div className="tl-chips tl-ins-niveles" role="group" aria-label="Filtrar por nivel">
          <button type="button" className="tl-chip" data-activo={!nivel || undefined} aria-pressed={!nivel} onClick={() => setNivel(0)}>
            Todos
          </button>
          {NIVELES_TALLER.map((n) => {
            const total = conteoNivel.get(n.valor) ?? 0
            return (
              <button key={n.valor} type="button" className="tl-chip" data-activo={nivel === n.valor || undefined}
                aria-pressed={nivel === n.valor} disabled={!total} onClick={() => setNivel(n.valor)}>
                {n.etiqueta} <span className="tl-chip-num">{total}</span>
              </button>
            )
          })}
        </div>
        <input
          className="tl-input tl-ins-filtro"
          placeholder="Filtrar taller o maestro…"
          aria-label="Filtrar grupos"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          onClick={() => filtro && setFiltro('')}
        />
        <p className="tl-muted tl-ins-total">
          {grupos.length} {grupos.length === 1 ? 'grupo' : 'grupos'} · {totalInscritos} {totalInscritos === 1 ? 'alumno inscrito' : 'alumnos inscritos'}
        </p>
        <ul className="tl-ins-lista">
          {grupos.length === 0 ? <li className="tl-muted tl-ins-vacio">Ningún grupo coincide.</li> : null}
          {grupos.map(({ a, t, m }) => {
            const cat = t?.categoria?.trim() || 'Sin categoría'
            const encabezado = cat !== categoriaPrev
            categoriaPrev = cat
            const estado = estadoCupo(a)
            return (
              <li key={a.id}>
                {encabezado ? <p className="tl-ins-cat">{cat}</p> : null}
                <button
                  type="button"
                  className="tl-ins-grupo"
                  data-activo={grupoId === a.id || undefined}
                  aria-pressed={grupoId === a.id}
                  style={{ ['--tl-color' as string]: t?.color ?? COLORES_TALLER[0] }}
                  onClick={() => setGrupoId(a.id)}
                >
                  <span className="tl-min0">
                    <span className="tl-ins-grupo-nombre">
                      <Resaltar texto={t?.nombre ?? 'Taller'} q={filtro} />
                      {t?.grados ? <span className="tl-grados">{t.grados}</span> : null}
                    </span>
                    <span className="tl-ins-grupo-meta"><Resaltar texto={m ? nombreMaestroTaller(m) : ''} q={filtro} /></span>
                    <span className="tl-ins-grupo-meta">{horarioCorto(a.horarios)}</span>
                  </span>
                  <span className="tl-cupo-pill" data-estado={estado} title={textoCupo(a)}>
                    {a.inscritos}{a.cupo ? `/${a.cupo}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="tl-ins-detalle">
        {seleccionado ? (
          <GrupoDetalle ctx={ctx} grupo={seleccionado} onVolver={() => setGrupoId(0)} />
        ) : (
          <div className="tl-ins-placeholder">
            <Users size={36} aria-hidden />
            <p><strong>Elige un grupo</strong> de la lista para ver a sus alumnos e inscribir nuevos.</p>
            <p className="tl-muted">El número de cada grupo son sus inscritos; se pone en rojo cuando se llena el cupo.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CupoMedidor({ grupo }: { grupo: TallerAsignacion }) {
  const estado = estadoCupo(grupo)
  const max = grupo.cupo ?? Math.max(grupo.cupo_min ?? 0, grupo.inscritos, 1)
  const pct = Math.min(100, Math.round((grupo.inscritos / max) * 100))
  const pctMin = grupo.cupo_min && grupo.cupo ? Math.min(100, (grupo.cupo_min / grupo.cupo) * 100) : null
  return (
    <div className="tl-cupo" data-estado={estado}>
      <div className="tl-cupo-nums">
        <strong>{grupo.inscritos}</strong>
        <span>{grupo.cupo ? `de ${grupo.cupo} lugares` : grupo.inscritos === 1 ? 'inscrito' : 'inscritos'}</span>
        <em>{textoCupo(grupo)}</em>
      </div>
      {grupo.cupo || grupo.cupo_min ? (
        <div className="tl-cupo-barra" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={grupo.inscritos} aria-label="Ocupación del grupo">
          <span style={{ width: `${pct}%` }} />
          {pctMin != null ? <i style={{ left: `${pctMin}%` }} title={`Mínimo ${grupo.cupo_min}`} /> : null}
        </div>
      ) : null}
      {grupo.cupo_min ? <span className="tl-cupo-min">Mínimo para abrir: {grupo.cupo_min}</span> : null}
    </div>
  )
}

function GrupoDetalle({ ctx, grupo, onVolver }: { ctx: Ctx; grupo: TallerAsignacion; onVolver: () => void }) {
  const { data, tallerPorId, maestroPorId, rev, enviar, quitar, pedirMover, pedirBaja, pedirNotas } = ctx
  const t = tallerPorId.get(grupo.taller_id)
  const m = maestroPorId.get(grupo.maestro_id)
  const [lista, setLista] = useState<TallerInscripcion[] | null>(null)
  const [verBajas, setVerBajas] = useState(false)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    let vivo = true
    setLista((prev) => (prev && prev[0]?.asignacion_id === grupo.id ? prev : null))
    fetch(`/api/talleres/inscripciones?asignacion_id=${grupo.id}`, { headers: portalSessionFetchHeaders(), cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => vivo && setLista((j.inscripciones ?? []) as TallerInscripcion[]))
      .catch(() => vivo && setLista([]))
    return () => {
      vivo = false
    }
  }, [grupo.id, rev])

  const activos = (lista ?? []).filter((i) => i.estado === 'inscrito')
  const bajas = (lista ?? []).filter((i) => i.estado === 'baja')
  const palabras = norm(filtro).split(/\s+/).filter(Boolean)
  const visibles = (verBajas ? [...activos, ...bajas] : activos).filter((i) =>
    palabras.every((p) => norm(`${i.alumno.nombre} ${i.alumno.alumno_ref ?? ''} ${etiquetaGradoAlumno(i.alumno)}`).includes(p))
  )
  const lugares = [...new Set(grupo.horarios.map((h) => lugarDeHorario(grupo, h)).filter(Boolean))].join(' / ')
  const nombre = t ? nombreTallerCompleto(t) : 'Taller'

  const evaluar = (a: AlumnoBusquedaTaller) => {
    const ev = evaluarAlumnoEnGrupo({ alumno: a, grupo, asignaciones: data.asignaciones, tallerPorId })
    const otros = a.asignaciones.filter((id) => id !== grupo.id)
    return {
      ...ev,
      info: otros.length ? (
        <>Ya en: {otros.map((id) => {
          const g = data.asignaciones.find((x) => x.id === id)
          return g ? nombreGrupo(g, tallerPorId) : ''
        }).filter(Boolean).join(', ')}</>
      ) : undefined,
    }
  }

  return (
    <div className="tl-grupo-det" style={{ ['--tl-color' as string]: t?.color ?? COLORES_TALLER[0] }}>
      <button type="button" className="tl-btn tl-ins-volver" onClick={onVolver}>
        <ArrowLeft size={16} aria-hidden /> Cambiar grupo
      </button>
      <header className="tl-grupo-head">
        <div className="tl-min0">
          <p className="tl-grupo-cat">{t?.categoria ?? 'Taller'} · {grupo.niveles.map(etiquetaNivel).join(' + ')}</p>
          <h3 className="tl-grupo-titulo">
            {t?.nombre ?? 'Taller'} {t?.grados ? <span className="tl-grados">{t.grados}</span> : null}
          </h3>
          <p className="tl-grupo-meta">
            <span><UserRound size={14} aria-hidden /> {m ? nombreMaestroTaller(m) : 'Sin maestro'}</span>
            <span>{horarioCorto(grupo.horarios)}</span>
            {lugares ? <span><MapPin size={14} aria-hidden /> {lugares}</span> : null}
          </p>
        </div>
        <div className="tl-grupo-acciones">
          <button type="button" className="tl-btn" disabled={!activos.length}
            onClick={() => imprimirLista({ grupo, taller: t, maestro: m, inscripciones: activos, ciclo: data.ciclo.nombre })}>
            <Printer size={16} aria-hidden /> Imprimir lista
          </button>
          <button type="button" className="tl-btn" disabled={!activos.length}
            onClick={() => descargarCsv({ grupo, taller: t, maestro: m, inscripciones: activos })}>
            <Download size={16} aria-hidden /> Excel (CSV)
          </button>
        </div>
      </header>

      <CupoMedidor grupo={grupo} />

      <div className="tl-ins-alta">
        <p className="tl-ins-alta-label">Inscribir alumno en {nombre}</p>
        <AlumnoBuscador
          key={grupo.id}
          niveles={grupo.niveles}
          placeholder="Nombre, apellidos o No. de control…"
          evaluar={evaluar}
          onElegir={(a) => void enviar({ accion: 'inscribir', asignacion_id: grupo.id, alumno_id: a.alumno_id }, `${a.nombre} inscrito en ${nombre}.`)}
        />
      </div>

      <div className="tl-ins-lista-head">
        <h4>Alumnos inscritos <span>{activos.length}</span></h4>
        <div className="tl-ins-lista-tools">
          {activos.length > 5 ? (
            <input className="tl-input tl-select-sm" placeholder="Buscar en la lista…" aria-label="Buscar en la lista"
              value={filtro} onChange={(e) => setFiltro(e.target.value)} onClick={() => filtro && setFiltro('')} />
          ) : null}
          {bajas.length ? (
            <label className="tl-check">
              <input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} />
              Ver bajas ({bajas.length})
            </label>
          ) : null}
        </div>
      </div>

      {lista == null ? (
        <p className="tl-loading"><Loader2 size={18} className="tl-spin" aria-hidden /> Cargando alumnos…</p>
      ) : visibles.length === 0 ? (
        <p className="tl-empty tl-empty-sm">
          {activos.length ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay alumnos inscritos. Usa el buscador de arriba para inscribir al primero.'}
        </p>
      ) : (
        <div className="tl-table-wrap">
          <table className="tl-table tl-ins-tabla">
            <thead>
              <tr>
                <th className="tl-num">#</th>
                <th>Alumno</th>
                <th>Grado</th>
                <th>Alta</th>
                <th>Notas</th>
                <th className="tl-acciones"><span className="tl-sr">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((i, k) => (
                <tr key={i.id} data-baja={i.estado === 'baja' || undefined}>
                  <td className="tl-num">{i.estado === 'inscrito' ? k + 1 : '—'}</td>
                  <td>
                    <strong><Resaltar texto={i.alumno.nombre} q={filtro} /></strong>
                    <span className="tl-desc">
                      {i.alumno.alumno_ref ? `No. ${i.alumno.alumno_ref}` : ''}
                      {i.estado === 'baja' ? ` · Baja ${fechaCorta(i.fecha_baja)}${i.motivo_baja ? ` — ${i.motivo_baja}` : ''}` : ''}
                    </span>
                  </td>
                  <td>{etiquetaGradoAlumno(i.alumno)}</td>
                  <td>
                    {fechaCorta(i.fecha_alta)}
                    {i.registrado_por ? <span className="tl-desc">{i.registrado_por}</span> : null}
                  </td>
                  <td className="tl-ins-notas">{i.notas ?? <span className="tl-muted">—</span>}</td>
                  <td className="tl-acciones">
                    <AccionesInscripcion ins={i} quitar={quitar} enviar={enviar} pedirMover={pedirMover} pedirBaja={pedirBaja} pedirNotas={pedirNotas} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AccionesInscripcion({
  ins,
  quitar,
  enviar,
  pedirMover,
  pedirBaja,
  pedirNotas,
}: {
  ins: TallerInscripcion
  quitar: Ctx['quitar']
  enviar: Ctx['enviar']
  pedirMover: Ctx['pedirMover']
  pedirBaja: Ctx['pedirBaja']
  pedirNotas: Ctx['pedirNotas']
}) {
  if (ins.estado === 'baja') {
    return (
      <div className="tl-acciones">
        <button type="button" className="tl-icon-btn" aria-label={`Reinscribir a ${ins.alumno.nombre}`} title="Reinscribir"
          onClick={() => void enviar({ accion: 'reactivar', id: ins.id }, `${ins.alumno.nombre} reinscrito.`)}>
          <RotateCcw size={16} aria-hidden />
        </button>
        <button type="button" className="tl-icon-btn tl-danger" aria-label={`Eliminar registro de ${ins.alumno.nombre}`} title="Eliminar del historial"
          onClick={() => {
            if (window.confirm(`¿Eliminar definitivamente el registro de ${ins.alumno.nombre}? No quedará en el historial.`)) {
              void quitar(ins.id, 'eliminar', 'Registro eliminado.')
            }
          }}>
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    )
  }
  return (
    <div className="tl-acciones">
      <button type="button" className="tl-icon-btn" aria-label={`Notas de ${ins.alumno.nombre}`} title="Notas" onClick={() => pedirNotas(ins)}>
        <StickyNote size={16} aria-hidden />
      </button>
      <button type="button" className="tl-icon-btn" aria-label={`Cambiar de grupo a ${ins.alumno.nombre}`} title="Cambiar de grupo" onClick={() => pedirMover(ins)}>
        <ArrowRightLeft size={16} aria-hidden />
      </button>
      <button type="button" className="tl-icon-btn tl-danger" aria-label={`Dar de baja a ${ins.alumno.nombre}`} title="Dar de baja" onClick={() => pedirBaja(ins)}>
        <UserMinus size={16} aria-hidden />
      </button>
    </div>
  )
}

/* ───────────── Por alumno ───────────── */

function PorAlumno({ ctx }: { ctx: Ctx }) {
  const { data, tallerPorId, maestroPorId, rev, enviar, quitar, pedirMover, pedirBaja, pedirNotas } = ctx
  const [alumnoSel, setAlumnoSel] = useState<AlumnoTaller | null>(null)
  const [inscripciones, setInscripciones] = useState<TallerInscripcion[] | null>(null)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    if (!alumnoSel) return
    let vivo = true
    fetch(`/api/talleres/inscripciones?alumno_id=${alumnoSel.alumno_id}`, { headers: portalSessionFetchHeaders(), cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => vivo && setInscripciones((j.inscripciones ?? []) as TallerInscripcion[]))
      .catch(() => vivo && setInscripciones([]))
    return () => {
      vivo = false
    }
  }, [alumnoSel, rev])

  const vigentes = (inscripciones ?? []).filter((i) => i.estado === 'inscrito')
  const bajas = (inscripciones ?? []).filter((i) => i.estado === 'baja')

  const disponibles = useMemo(() => {
    if (!alumnoSel || !inscripciones) return []
    const alumnoEval = {
      ...alumnoSel,
      asignaciones: inscripciones.filter((i) => i.estado === 'inscrito').map((i) => i.asignacion_id),
    }
    const palabras = norm(filtro).split(/\s+/).filter(Boolean)
    return data.asignaciones
      .filter((a) => a.niveles.includes(alumnoEval.nivel) && !alumnoEval.asignaciones.includes(a.id))
      .map((a) => {
        const t = tallerPorId.get(a.taller_id)
        const m = maestroPorId.get(a.maestro_id)
        return { a, t, m, ev: evaluarAlumnoEnGrupo({ alumno: alumnoEval, grupo: a, asignaciones: data.asignaciones, tallerPorId }) }
      })
      .filter(({ t, m }) => palabras.every((p) => norm(`${t ? nombreTallerCompleto(t) : ''} ${m ? nombreMaestroTaller(m) : ''}`).includes(p)))
      .sort(
        (x, y) =>
          Number(Boolean(x.ev.bloqueado)) - Number(Boolean(y.ev.bloqueado)) ||
          x.ev.avisos.length - y.ev.avisos.length ||
          (x.t ? nombreTallerCompleto(x.t) : '').localeCompare(y.t ? nombreTallerCompleto(y.t) : '', 'es', { numeric: true })
      )
  }, [alumnoSel, inscripciones, filtro, data.asignaciones, tallerPorId, maestroPorId])

  return (
    <div className="tl-alumno-modo">
      <AlumnoBuscador
        niveles={[]}
        placeholder="Busca al alumno por nombre, apellidos o No. de control…"
        etiquetaAccion="Ver"
        evaluar={(a) => ({
          info: a.asignaciones.length ? (
            <>{a.asignaciones.length} {a.asignaciones.length === 1 ? 'taller' : 'talleres'}: {a.asignaciones.map((id) => {
              const g = data.asignaciones.find((x) => x.id === id)
              return g ? nombreGrupo(g, tallerPorId) : ''
            }).filter(Boolean).join(', ')}</>
          ) : <>Sin talleres</>,
        })}
        onElegir={(a) => {
          setInscripciones(null)
          setFiltro('')
          setAlumnoSel(a)
        }}
      />

      {!alumnoSel ? (
        <div className="tl-ins-placeholder">
          <UserRound size={36} aria-hidden />
          <p><strong>Busca a un alumno</strong> para ver en qué talleres está.</p>
          <p className="tl-muted">Desde aquí lo puedes inscribir en otro taller, cambiarlo de grupo o darlo de baja.</p>
        </div>
      ) : (
        <div className="tl-alumno-ficha">
          <header className="tl-alumno-head">
            <div className="tl-alumno-avatar" aria-hidden>{alumnoSel.nombre.slice(0, 1)}</div>
            <div className="tl-min0">
              <h3>{alumnoSel.nombre}</h3>
              <p className="tl-muted">
                {alumnoSel.alumno_ref ? `No. ${alumnoSel.alumno_ref} · ` : ''}
                {etiquetaGradoAlumno(alumnoSel)} · {etiquetaNivel(alumnoSel.nivel)}
              </p>
            </div>
          </header>

          <h4 className="tl-ins-sub">Talleres inscritos <span>{vigentes.length}</span></h4>
          {inscripciones == null ? (
            <p className="tl-loading"><Loader2 size={18} className="tl-spin" aria-hidden /> Cargando…</p>
          ) : vigentes.length === 0 ? (
            <p className="tl-empty tl-empty-sm">No está inscrito en ningún taller todavía.</p>
          ) : (
            <ul className="tl-asig-lista">
              {vigentes.map((i) => {
                const g = data.asignaciones.find((x) => x.id === i.asignacion_id)
                const t = g ? tallerPorId.get(g.taller_id) : undefined
                const m = g ? maestroPorId.get(g.maestro_id) : undefined
                return (
                  <li key={i.id} className="tl-asig-card" style={{ ['--tl-color' as string]: t?.color ?? COLORES_TALLER[0] }}>
                    <div className="tl-min0">
                      <p className="tl-asig-titulo">{t ? nombreTallerCompleto(t) : 'Taller'}</p>
                      <p className="tl-asig-horario">{g ? horarioCorto(g.horarios) : ''}</p>
                      <p className="tl-asig-meta">
                        <span>{m ? nombreMaestroTaller(m) : ''}</span>
                        <span>Alta {fechaCorta(i.fecha_alta)}</span>
                      </p>
                      {i.notas ? <p className="tl-horario-nota">{i.notas}</p> : null}
                    </div>
                    <AccionesInscripcion ins={i} quitar={quitar} enviar={enviar} pedirMover={pedirMover} pedirBaja={pedirBaja} pedirNotas={pedirNotas} />
                  </li>
                )
              })}
            </ul>
          )}

          {bajas.length ? (
            <details className="tl-ins-bajas">
              <summary>Bajas del ciclo ({bajas.length})</summary>
              <ul>
                {bajas.map((i) => {
                  const g = data.asignaciones.find((x) => x.id === i.asignacion_id)
                  return (
                    <li key={i.id}>
                      <span className="tl-min0">
                        <strong>{g ? nombreGrupo(g, tallerPorId) : 'Taller'}</strong>
                        <span className="tl-desc">Baja {fechaCorta(i.fecha_baja)}{i.motivo_baja ? ` — ${i.motivo_baja}` : ''}</span>
                      </span>
                      <AccionesInscripcion ins={i} quitar={quitar} enviar={enviar} pedirMover={pedirMover} pedirBaja={pedirBaja} pedirNotas={pedirNotas} />
                    </li>
                  )
                })}
              </ul>
            </details>
          ) : null}

          <div className="tl-ins-lista-head">
            <h4>Inscribir en otro taller</h4>
            <input className="tl-input tl-select-sm" placeholder="Filtrar taller o maestro…" aria-label="Filtrar talleres disponibles"
              value={filtro} onChange={(e) => setFiltro(e.target.value)} onClick={() => filtro && setFiltro('')} />
          </div>
          {disponibles.length === 0 ? (
            <p className="tl-empty tl-empty-sm">No hay más grupos de {etiquetaNivel(alumnoSel.nivel)} disponibles.</p>
          ) : (
            <ul className="tl-disp-lista">
              {disponibles.map(({ a, t, m, ev }) => (
                <li key={a.id} className="tl-disp" data-bloqueado={ev.bloqueado ? true : undefined}
                  style={{ ['--tl-color' as string]: t?.color ?? COLORES_TALLER[0] }}>
                  <span className="tl-min0">
                    <span className="tl-ins-grupo-nombre">
                      {t?.nombre ?? 'Taller'} {t?.grados ? <span className="tl-grados">{t.grados}</span> : null}
                    </span>
                    <span className="tl-ins-grupo-meta">{m ? nombreMaestroTaller(m) : ''} · {horarioCorto(a.horarios)}</span>
                    {ev.bloqueado ? <span className="tl-alumno-sug-bloq">{ev.bloqueado}</span> : null}
                    {ev.avisos.map((x) => <span key={x} className="tl-alumno-sug-aviso">{x}</span>)}
                  </span>
                  <span className="tl-cupo-pill" data-estado={estadoCupo(a)} title={textoCupo(a)}>
                    {a.inscritos}{a.cupo ? `/${a.cupo}` : ''}
                  </span>
                  <button type="button" className="tl-btn tl-btn-primary" disabled={Boolean(ev.bloqueado)}
                    onClick={() => void enviar(
                      { accion: 'inscribir', asignacion_id: a.id, alumno_id: alumnoSel.alumno_id },
                      `${alumnoSel.nombre} inscrito en ${t ? nombreTallerCompleto(t) : 'el taller'}.`
                    )}>
                    Inscribir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/* ───────────── Modales ───────────── */

function MoverModal({ ctx, inscripcion, onCerrar }: { ctx: Ctx; inscripcion: TallerInscripcion; onCerrar: () => void }) {
  const { data, tallerPorId, maestroPorId, enviar } = ctx
  const [vigentes, setVigentes] = useState<number[] | null>(null)
  const [destino, setDestino] = useState(0)

  useEffect(() => {
    let vivo = true
    fetch(`/api/talleres/inscripciones?alumno_id=${inscripcion.alumno.alumno_id}`, { headers: portalSessionFetchHeaders(), cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return
        const lista = (j.inscripciones ?? []) as TallerInscripcion[]
        setVigentes(lista.filter((i) => i.estado === 'inscrito').map((i) => i.asignacion_id))
      })
      .catch(() => vivo && setVigentes([]))
    return () => {
      vivo = false
    }
  }, [inscripcion.alumno.alumno_id])

  const origen = data.asignaciones.find((a) => a.id === inscripcion.asignacion_id)
  const tOrigen = origen ? tallerPorId.get(origen.taller_id) : undefined
  const opciones = useMemo(() => {
    if (!vigentes) return []
    const alumno = { ...inscripcion.alumno, asignaciones: vigentes }
    return data.asignaciones
      .filter((a) => a.id !== inscripcion.asignacion_id && a.niveles.includes(inscripcion.alumno.nivel))
      .map((a) => ({
        a,
        t: tallerPorId.get(a.taller_id),
        m: maestroPorId.get(a.maestro_id),
        ev: evaluarAlumnoEnGrupo({ alumno, grupo: a, asignaciones: data.asignaciones, tallerPorId, ignorarAsignacionId: inscripcion.asignacion_id }),
      }))
      .sort(
        (x, y) =>
          Number(x.t?.nombre !== tOrigen?.nombre) - Number(y.t?.nombre !== tOrigen?.nombre) ||
          Number(Boolean(x.ev.bloqueado)) - Number(Boolean(y.ev.bloqueado)) ||
          (x.t ? nombreTallerCompleto(x.t) : '').localeCompare(y.t ? nombreTallerCompleto(y.t) : '', 'es', { numeric: true })
      )
  }, [vigentes, data.asignaciones, inscripcion, tallerPorId, maestroPorId, tOrigen?.nombre])

  const elegido = opciones.find((o) => o.a.id === destino)

  return (
    <TlModal
      abierto
      titulo={`Cambiar de grupo a ${inscripcion.alumno.nombre}`}
      subtitulo={`Ahora en ${origen ? nombreGrupo(origen, tallerPorId) : 'otro grupo'} · ${etiquetaGradoAlumno(inscripcion.alumno)}`}
      onCerrar={onCerrar}
      ancho="amplio"
      pie={
        <>
          <button type="button" className="tl-btn" onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className="tl-btn tl-btn-primary"
            disabled={!elegido || Boolean(elegido.ev.bloqueado)}
            onClick={() =>
              void enviar(
                { accion: 'mover', id: inscripcion.id, asignacion_id: destino },
                `${inscripcion.alumno.nombre} ahora está en ${elegido?.t ? nombreTallerCompleto(elegido.t) : 'el nuevo grupo'}.`,
                onCerrar
              )
            }
          >
            <ArrowRightLeft size={16} aria-hidden /> Cambiar de grupo
          </button>
        </>
      }
    >
      {vigentes == null ? (
        <p className="tl-loading"><Loader2 size={18} className="tl-spin" aria-hidden /> Revisando horarios…</p>
      ) : opciones.length === 0 ? (
        <p className="tl-empty tl-empty-sm">No hay otros grupos de {etiquetaNivel(inscripcion.alumno.nivel)}.</p>
      ) : (
        <ul className="tl-disp-lista" role="radiogroup" aria-label="Grupo destino">
          {opciones.map(({ a, t, m, ev }) => (
            <li key={a.id}>
              <label className="tl-disp tl-disp-radio" data-bloqueado={ev.bloqueado ? true : undefined}
                data-activo={destino === a.id || undefined} style={{ ['--tl-color' as string]: t?.color ?? COLORES_TALLER[0] }}>
                <input type="radio" name="destino" value={a.id} checked={destino === a.id} disabled={Boolean(ev.bloqueado)}
                  onChange={() => setDestino(a.id)} />
                <span className="tl-min0">
                  <span className="tl-ins-grupo-nombre">
                    {t?.nombre ?? 'Taller'} {t?.grados ? <span className="tl-grados">{t.grados}</span> : null}
                  </span>
                  <span className="tl-ins-grupo-meta">{m ? nombreMaestroTaller(m) : ''} · {horarioCorto(a.horarios)}</span>
                  {ev.bloqueado ? <span className="tl-alumno-sug-bloq">{ev.bloqueado}</span> : null}
                  {ev.avisos.map((x) => <span key={x} className="tl-alumno-sug-aviso">{x}</span>)}
                </span>
                <span className="tl-cupo-pill" data-estado={estadoCupo(a)} title={textoCupo(a)}>
                  {a.inscritos}{a.cupo ? `/${a.cupo}` : ''}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </TlModal>
  )
}

const MOTIVOS_BAJA = ['Decisión de los papás', 'Cambio de taller', 'Choque de horario', 'Baja de la escuela', 'Faltas']

function BajaModal({ ctx, inscripcion, onCerrar }: { ctx: Ctx; inscripcion: TallerInscripcion; onCerrar: () => void }) {
  const { data, tallerPorId, quitar } = ctx
  const [motivo, setMotivo] = useState('')
  const g = data.asignaciones.find((a) => a.id === inscripcion.asignacion_id)
  return (
    <TlModal
      abierto
      titulo={`Dar de baja a ${inscripcion.alumno.nombre}`}
      subtitulo={g ? `de ${nombreGrupo(g, tallerPorId)}` : undefined}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="tl-btn" onClick={onCerrar}>Cancelar</button>
          <button
            type="button"
            className="tl-btn tl-btn-danger"
            onClick={async () => {
              if (await quitar(inscripcion.id, 'baja', `${inscripcion.alumno.nombre} dado de baja.`, motivo.trim() || undefined)) onCerrar()
            }}
          >
            <UserMinus size={16} aria-hidden /> Dar de baja
          </button>
        </>
      }
    >
      <p className="tl-muted tl-modal-texto">Queda en el historial y se puede reinscribir después. El lugar se libera de inmediato.</p>
      <p className="tl-field-label">Motivo (opcional)</p>
      <div className="tl-chips">
        {MOTIVOS_BAJA.map((mv) => (
          <button key={mv} type="button" className="tl-chip" data-activo={motivo === mv || undefined} onClick={() => setMotivo(motivo === mv ? '' : mv)}>
            {mv}
          </button>
        ))}
      </div>
      <input className="tl-input tl-modal-input" placeholder="Otro motivo…" value={motivo} maxLength={200}
        onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo de baja" />
    </TlModal>
  )
}

function NotasModal({ ctx, inscripcion, onCerrar }: { ctx: Ctx; inscripcion: TallerInscripcion; onCerrar: () => void }) {
  const { enviar } = ctx
  const [notas, setNotas] = useState(inscripcion.notas ?? '')
  return (
    <TlModal
      abierto
      titulo={`Notas de ${inscripcion.alumno.nombre}`}
      subtitulo="Por ejemplo: alergias, quién lo recoge, uniforme pendiente…"
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="tl-btn" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="tl-btn tl-btn-primary"
            onClick={() => void enviar({ accion: 'notas', id: inscripcion.id, notas }, 'Notas guardadas.', onCerrar)}>
            Guardar
          </button>
        </>
      }
    >
      <textarea className="tl-input tl-textarea" rows={4} maxLength={1000} value={notas} autoFocus
        onChange={(e) => setNotas(e.target.value)} aria-label="Notas" />
    </TlModal>
  )
}
