'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Loader2,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Timer,
  User,
  X,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { TlModal } from '../components/TalleresUi'
import { parsePortalSessionHeader, readPortalSessionForFetch } from '@/lib/insforgeDbProxyShared'
import { esCancelacion, fetchTalleres, mensajeDe } from '../components/fetchTalleres'
import {
  DIAS_TALLER,
  MOTIVOS_INCIDENCIA,
  etiquetaNivel,
  hora12,
  horaMasMinutos,
  minutosDeHora,
  minutosIncidencia,
  textoDuracion,
  textoIncidencia,
  type AsistenciaDia,
  type IncidenciaMaestro,
  type RegistroAsistencia,
  type SesionAsistencia,
} from '@/lib/talleres/talleresTypes'
import '../talleres.css'
import './asistencia.css'

const CLAVE_NOMBRE = 'talleres-asistencia-nombre'
const CLAVE_BORRADORES = 'talleres-asistencia-borradores'

type BorradoresGuardados = { fecha: string; items: Record<number, { faltas: number[]; total: number }> }

function leerBorradoresLocales(fecha: string): BorradoresGuardados['items'] {
  try {
    const raw = JSON.parse(localStorage.getItem(CLAVE_BORRADORES) ?? 'null') as BorradoresGuardados | null
    return raw && raw.fecha === fecha && raw.items ? raw.items : {}
  } catch {
    return {}
  }
}

function guardarBorradoresLocales(fecha: string, borradores: Record<number, Borrador>) {
  try {
    const items = Object.fromEntries(
      Object.entries(borradores)
        .filter(([, b]) => b.sucio)
        .map(([id, b]) => [id, { faltas: [...b.faltas], total: b.total }])
    )
    if (Object.keys(items).length) localStorage.setItem(CLAVE_BORRADORES, JSON.stringify({ fecha, items }))
    else localStorage.removeItem(CLAVE_BORRADORES)
  } catch {
    /* sin almacenamiento */
  }
}

type DatosIncidencia = { falto: boolean; llegada: string | null; salida: string | null; motivo: string; nota: string }

type Borrador = {
  faltas: Set<number>
  /** Sin faltas: conteo físico editable. Con faltas: inscritos − faltas (bloqueado). */
  total: number
  sucio: boolean
}

function descartarBorradoresLocales() {
  try {
    localStorage.removeItem(CLAVE_BORRADORES)
  } catch {
    /* sin almacenamiento */
  }
}

function borradorDesde(s: SesionAsistencia): Borrador {
  const enLista = new Set(s.alumnos.map((a) => a.alumno_id))
  const faltas = new Set((s.registro?.faltas ?? []).filter((id) => enLista.has(id)))
  const total = faltas.size
    ? s.alumnos.length - faltas.size
    : (s.registro?.total_alumnos ?? s.alumnos.length)
  return { faltas, total, sucio: false }
}

/** Conteo guardado que no cuadra con la lista: faltan por registrar las faltas. */
function faltasPendientes(s: SesionAsistencia): number {
  const r = s.registro
  if (!r || r.faltas.length || r.total_alumnos == null) return 0
  return s.alumnos.length - r.total_alumnos
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

function diaDe(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay()
}

/** Lunes a sábado de la semana de `fecha` (domingo cuenta como la semana siguiente). */
function semanaDe(fecha: string): string[] {
  const d = diaDe(fecha)
  const lunes = sumarDias(fecha, d === 0 ? 1 : 1 - d)
  return DIAS_TALLER.map((_, i) => sumarDias(lunes, i))
}

function fechaLarga(fecha: string): string {
  const txt = new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

function horaCorta(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function AsistenciaTalleresPage() {
  const [fecha, setFecha] = useState<string | null>(null)
  const [data, setData] = useState<AsistenciaDia | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [nivel, setNivel] = useState(0)
  const [borradores, setBorradores] = useState<Record<number, Borrador>>({})
  const [abierta, setAbierta] = useState<number | null>(null)
  const [guardando, setGuardando] = useState<number | null>(null)
  const [modalInc, setModalInc] = useState<number | null>(null)
  const [nombre, setNombre] = useState('')
  const [empleado, setEmpleado] = useState<string | null>(null)

  useEffect(() => {
    const s = parsePortalSessionHeader(readPortalSessionForFetch())
    if (s?.role === 'usuario') setEmpleado(s.displayName || 'Personal')
    try {
      setNombre(localStorage.getItem(CLAVE_NOMBRE) ?? '')
    } catch {
      /* sin almacenamiento */
    }
  }, [])

  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  /** Fecha que se muestra: una respuesta que llega tarde de otro día no debe pintarse encima. */
  const fechaRef = useRef<string | null>(null)
  const cargaRef = useRef<AbortController | null>(null)

  const cargar = useCallback(async (f: string | null) => {
    cargaRef.current?.abort()
    const ctrl = new AbortController()
    cargaRef.current = ctrl
    setCargando(true)
    setError(null)
    setErrorCarga(null)
    try {
      const d = await fetchTalleres<AsistenciaDia>(`/api/talleres/asistencia${f ? `?fecha=${f}` : ''}`, {}, ctrl.signal)
      if (ctrl.signal.aborted) return
      const locales = leerBorradoresLocales(d.fecha)
      fechaRef.current = d.fecha
      setData(d)
      setFecha(d.fecha)
      setBorradores(
        Object.fromEntries(
          d.sesiones.map((s) => {
            const local = d.editable ? locales[s.asignacion_id] : undefined
            if (!local) return [s.asignacion_id, borradorDesde(s)]
            const enLista = new Set(s.alumnos.map((a) => a.alumno_id))
            const faltas = new Set(local.faltas.filter((id) => enLista.has(id)))
            return [s.asignacion_id, { faltas, total: faltas.size ? s.alumnos.length - faltas.size : local.total, sucio: true }]
          })
        )
      )
      setAbierta(null)
    } catch (e) {
      if (esCancelacion(e) || ctrl.signal.aborted) return
      setErrorCarga(mensajeDe(e, 'No se pudo cargar la asistencia.'))
    } finally {
      if (cargaRef.current === ctrl) setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar(null)
  }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), 3500)
    return () => window.clearTimeout(t)
  }, [aviso])

  const haySinGuardar = Object.values(borradores).some((b) => b.sucio)

  useEffect(() => {
    if (fecha && data?.editable) guardarBorradoresLocales(fecha, borradores)
  }, [fecha, data?.editable, borradores])

  useEffect(() => {
    if (!haySinGuardar) return
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [haySinGuardar])

  const irA = (f: string) => {
    if (f === fecha || guardando != null) return
    if (haySinGuardar) {
      if (!window.confirm('Hay listas sin guardar. ¿Cambiar de día y descartarlas?')) return
      descartarBorradoresLocales()
    }
    void cargar(f)
  }

  const sesiones = useMemo(() => data?.sesiones ?? [], [data])

  const nivelesDelDia = useMemo(() => {
    const m = new Map<number, number>()
    for (const s of sesiones) for (const n of s.niveles) m.set(n, (m.get(n) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [sesiones])

  useEffect(() => {
    if (nivel && !nivelesDelDia.some(([n]) => n === nivel)) setNivel(0)
  }, [nivel, nivelesDelDia])

  const grupos = useMemo(() => {
    const visibles = nivel ? sesiones.filter((s) => s.niveles.includes(nivel)) : sesiones
    const m = new Map<number, SesionAsistencia[]>()
    for (const s of visibles) {
      const clave = nivel || s.niveles[0] || 0
      m.set(clave, [...(m.get(clave) ?? []), s])
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [sesiones, nivel])

  const resumen = useMemo(() => {
    let registrados = 0
    let presentes = 0
    let faltas = 0
    let porCompletar = 0
    for (const s of sesiones) {
      if (!s.registro) continue
      registrados++
      if (faltasPendientes(s) !== 0) porCompletar++
      faltas += s.registro.faltas.length
      presentes += s.registro.total_alumnos ?? s.alumnos.length - s.registro.faltas.length
    }
    return { registrados, presentes, faltas, porCompletar }
  }, [sesiones])

  const actualizar = (id: number, cambio: (b: Borrador, s: SesionAsistencia) => Borrador) => {
    const s = sesiones.find((x) => x.asignacion_id === id)
    if (!s) return
    setBorradores((prev) => ({ ...prev, [id]: { ...cambio(prev[id] ?? borradorDesde(s), s), sucio: true } }))
  }

  const alternarAlumno = (id: number, alumnoId: number) =>
    actualizar(id, (b, s) => {
      const faltas = new Set(b.faltas)
      if (faltas.has(alumnoId)) faltas.delete(alumnoId)
      else faltas.add(alumnoId)
      return { ...b, faltas, total: s.alumnos.length - faltas.size }
    })

  const todosPresentes = (id: number) =>
    actualizar(id, (b, s) => ({ ...b, faltas: new Set(), total: s.alumnos.length }))

  const cambiarTotal = (id: number, valor: number) =>
    actualizar(id, (b) =>
      b.faltas.size ? b : { ...b, total: Math.max(0, Math.min(500, Math.round(valor) || 0)) }
    )

  const guardar = async (s: SesionAsistencia) => {
    const b = borradores[s.asignacion_id]
    if (!b || !fecha) return
    const quien = empleado ?? nombre.trim()
    if (!quien) {
      setError('Escribe tu nombre arriba (¿Quién pasa lista?) antes de guardar.')
      document.getElementById('as-nombre')?.focus()
      return
    }
    setGuardando(s.asignacion_id)
    setError(null)
    const fechaGuardada = fecha
    try {
      const json = await fetchTalleres<{ registro: RegistroAsistencia }>('/api/talleres/asistencia', {
        method: 'POST',
        json: {
          asignacion_id: s.asignacion_id,
          fecha: fechaGuardada,
          faltas: [...b.faltas],
          total_alumnos: b.total,
          registrado_por: quien,
        },
      })
      const registro = json.registro
      if (fechaRef.current !== fechaGuardada) {
        setAviso(`Asistencia de ${s.taller} guardada (${fechaLarga(fechaGuardada)}).`)
        return
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              sesiones: prev.sesiones.map((x) => (x.asignacion_id === s.asignacion_id ? { ...x, registro } : x)),
            }
          : prev
      )
      setBorradores((prev) => ({ ...prev, [s.asignacion_id]: { ...b, sucio: false } }))
      setAviso(`Asistencia de ${s.taller} guardada.`)
      setAbierta(null)
      setModalInc(s.asignacion_id)
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo guardar.'))
    } finally {
      setGuardando(null)
    }
  }

  const guardarIncidencia = async (
    s: SesionAsistencia,
    datos: DatosIncidencia
  ): Promise<boolean> => {
    if (!fecha) return false
    const quien = empleado ?? nombre.trim()
    if (!quien) {
      setError('Escribe tu nombre arriba (¿Quién pasa lista?) antes de guardar.')
      document.getElementById('as-nombre')?.focus()
      return false
    }
    setError(null)
    const fechaGuardada = fecha
    try {
      const json = await fetchTalleres<{ incidencia?: IncidenciaMaestro | null }>('/api/talleres/asistencia', {
        method: 'POST',
        json: { accion: 'incidencia', asignacion_id: s.asignacion_id, fecha: fechaGuardada, ...datos, registrado_por: quien },
      })
      const incidencia = json.incidencia ?? null
      if (fechaRef.current !== fechaGuardada) return true
      setData((prev) =>
        prev
          ? {
              ...prev,
              sesiones: prev.sesiones.map((x) => (x.asignacion_id === s.asignacion_id ? { ...x, incidencia } : x)),
            }
          : prev
      )
      setAviso(
        incidencia
          ? `${s.taller}: ${textoIncidencia(s.hora_inicio, s.hora_fin, incidencia)}.`
          : `${s.taller}: el maestro llegó a tiempo.`
      )
      return true
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo guardar.'))
      return false
    }
  }

  const guardarNombre = (v: string) => {
    setNombre(v)
    try {
      localStorage.setItem(CLAVE_NOMBRE, v)
    } catch {
      /* sin almacenamiento */
    }
  }

  const semana = fecha ? semanaDe(fecha) : []
  const hoy = data?.hoy ?? null
  const pct = sesiones.length ? Math.round((resumen.registrados / sesiones.length) * 100) : 0

  return (
    <div className="tl-page as-page">
      <div className="tl-bg" aria-hidden />
      <div className="tl-shell as-shell">
        <header className="tl-header">
          <div className="tl-topbar">
            {empleado ? (
              <Link href="/talleres" className="tl-back">
                <ArrowLeft size={16} aria-hidden /> Talleres
              </Link>
            ) : (
              <span className="as-marca">
                <ClipboardCheck size={18} aria-hidden /> Winston · Estancia
              </span>
            )}
            <div className="tl-topbar-der">
              <button
                type="button"
                className="tl-icon-btn"
                onClick={() => {
                  if (haySinGuardar) {
                    if (!window.confirm('Hay listas sin guardar. ¿Recargar y descartarlas?')) return
                    descartarBorradoresLocales()
                  }
                  void cargar(fecha)
                }}
                aria-label="Recargar"
                disabled={cargando || guardando != null}
              >
                <RefreshCw size={16} aria-hidden className={cargando ? 'tl-spin' : undefined} />
              </button>
              <ThemeToggle />
            </div>
          </div>
          <p className="tl-kicker">Talleres{data ? ` · Ciclo ${data.ciclo.nombre}` : ''}</p>
          <h1 className="tl-title">Asistencia diaria</h1>
          <p className="tl-lead">
            Todos aparecen presentes: toca a quien falte y guarda. Con el botón «Maestro» anota si llegó tarde, salió antes o no asistió.
          </p>
        </header>

        <div className="tl-toasts" aria-live="polite">
          {error || (data && errorCarga) ? (
            <p className="tl-msg tl-msg-error" role="alert">
              <span>{error || errorCarga}</span>
              <button
                type="button"
                className="tl-msg-x"
                onClick={() => {
                  setError(null)
                  setErrorCarga(null)
                }}
                aria-label="Cerrar aviso"
              >
                ×
              </button>
            </p>
          ) : null}
          {aviso ? (
            <p className="tl-msg tl-msg-ok" role="status">
              <Check size={16} aria-hidden /> {aviso}
            </p>
          ) : null}
        </div>

        {!empleado ? (
          <label className="as-quien" htmlFor="as-nombre">
            <User size={18} aria-hidden />
            <span className="as-quien-txt">¿Quién pasa lista?</span>
            <input
              id="as-nombre"
              value={nombre}
              onChange={(e) => guardarNombre(e.target.value)}
              placeholder="Tu nombre"
              autoComplete="name"
              maxLength={80}
            />
          </label>
        ) : null}

        {fecha && data?.historial ? (
          <nav className="as-dias" aria-label="Día" aria-busy={cargando || undefined}>
            <button type="button" className="as-flecha" onClick={() => irA(sumarDias(semana[0], -7))} aria-label="Semana anterior" disabled={guardando != null}>
              <ChevronLeft size={18} aria-hidden />
            </button>
            <div className="as-dias-lista">
              {semana.map((f, i) => (
                <button
                  key={f}
                  type="button"
                  className="as-dia"
                  data-activo={f === fecha || undefined}
                  data-hoy={f === hoy || undefined}
                  aria-pressed={f === fecha}
                  disabled={guardando != null}
                  onClick={() => irA(f)}
                >
                  <span className="as-dia-nombre">{DIAS_TALLER[i].etiqueta.slice(0, 3)}</span>
                  <span className="as-dia-num">{Number(f.slice(8))}</span>
                </button>
              ))}
            </div>
            <button type="button" className="as-flecha" onClick={() => irA(sumarDias(semana[0], 7))} aria-label="Semana siguiente" disabled={guardando != null}>
              <ChevronRight size={18} aria-hidden />
            </button>
            {hoy && fecha !== hoy ? (
              <button type="button" className="as-hoy-btn" onClick={() => irA(hoy)} disabled={guardando != null}>Hoy</button>
            ) : null}
          </nav>
        ) : null}

        {data ? (
          <section className="as-resumen" aria-label="Resumen del día">
            <div className="as-resumen-fecha">
              <strong>{fechaLarga(data.fecha)}</strong>
              <span>{data.fecha === data.hoy ? 'Hoy' : data.editable ? 'Día pasado · editable' : 'Solo consulta'}</span>
            </div>
            <div className="as-progreso" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Talleres registrados">
              <div className="as-progreso-barra"><span style={{ width: `${pct}%` }} /></div>
              <span className="as-progreso-txt">
                <strong>{resumen.registrados}</strong> de {sesiones.length} talleres registrados
              </span>
              {resumen.porCompletar ? (
                <span className="as-por-completar">
                  <span className="as-pulso" aria-hidden />
                  {resumen.porCompletar} {resumen.porCompletar === 1 ? 'taller' : 'talleres'} con faltas por registrar
                </span>
              ) : null}
            </div>
            <dl className="as-kpis">
              <div data-tono="ok"><dt>Presentes</dt><dd>{resumen.presentes}</dd></div>
              <div data-tono="falta"><dt>Faltas</dt><dd>{resumen.faltas}</dd></div>
              <div data-tono="pend"><dt>Pendientes</dt><dd>{sesiones.length - resumen.registrados}</dd></div>
            </dl>
          </section>
        ) : null}

        {nivelesDelDia.length > 1 ? (
          <div className="as-niveles" role="group" aria-label="Nivel">
            <button type="button" className="as-nivel" data-activo={nivel === 0 || undefined} aria-pressed={nivel === 0} onClick={() => setNivel(0)}>
              Todos <span>{sesiones.length}</span>
            </button>
            {nivelesDelDia.map(([n, c]) => (
              <button key={n} type="button" className="as-nivel" data-nivel={n} data-activo={nivel === n || undefined} aria-pressed={nivel === n} onClick={() => setNivel(n)}>
                {etiquetaNivel(n)} <span>{c}</span>
              </button>
            ))}
          </div>
        ) : null}

        {cargando && data ? (
          <p className="tl-loading as-cargando-dia" role="status">
            <Loader2 size={18} className="tl-spin" aria-hidden /> Cargando el día…
          </p>
        ) : null}

        {cargando && !data ? (
          <p className="tl-loading"><Loader2 size={18} className="tl-spin" aria-hidden /> Cargando…</p>
        ) : errorCarga && !data ? (
          <div className="tl-error-carga" role="alert">
            <p>{errorCarga}</p>
            <button type="button" className="tl-btn tl-btn-primary" onClick={() => void cargar(fecha)}>
              <RefreshCw size={16} aria-hidden /> Reintentar
            </button>
          </div>
        ) : data && sesiones.length === 0 ? (
          <p className="tl-empty as-vacio">
            {data.dia === 0 ? 'Es domingo: no hay talleres.' : 'No hay talleres programados este día.'}
          </p>
        ) : data ? (
          grupos.map(([n, lista]) => (
            <section key={n} data-cargando={cargando || undefined} className="as-grupo" data-nivel={n} aria-label={etiquetaNivel(n)}>
              <h2 className="as-grupo-titulo">
                <span className="as-grupo-punto" aria-hidden /> {etiquetaNivel(n)}
                <span className="as-grupo-cuenta">
                  {lista.filter((s) => s.registro).length}/{lista.length} registrados
                </span>
              </h2>
              <ul className="as-lista">
                {lista.map((s) => (
                  <TarjetaSesion
                    key={`${s.asignacion_id}-${s.hora_inicio}`}
                    s={s}
                    b={borradores[s.asignacion_id] ?? borradorDesde(s)}
                    abierta={abierta === s.asignacion_id}
                    editable={data.editable}
                    guardando={guardando === s.asignacion_id}
                    onAbrir={() => setAbierta((a) => (a === s.asignacion_id ? null : s.asignacion_id))}
                    onAlumno={(id) => alternarAlumno(s.asignacion_id, id)}
                    onTodos={() => todosPresentes(s.asignacion_id)}
                    onTotal={(v) => cambiarTotal(s.asignacion_id, v)}
                    onGuardar={() => void guardar(s)}
                    onIncidencia={() => setModalInc(s.asignacion_id)}
                  />
                ))}
              </ul>
            </section>
          ))
        ) : null}
      </div>
      {(() => {
        const s = modalInc != null ? sesiones.find((x) => x.asignacion_id === modalInc) : undefined
        return s && data?.editable ? (
          <ModalIncidencia
            key={`${s.asignacion_id}-${s.incidencia?.updated_at ?? ''}`}
            s={s}
            onCerrar={() => setModalInc(null)}
            onGuardar={async (d) => {
              const ok = await guardarIncidencia(s, d)
              if (ok) setModalInc(null)
            }}
          />
        ) : null
      })()}
    </div>
  )
}

function TarjetaSesion({
  s,
  b,
  abierta,
  editable,
  guardando,
  onAbrir,
  onAlumno,
  onTodos,
  onTotal,
  onGuardar,
  onIncidencia,
}: {
  s: SesionAsistencia
  b: Borrador
  abierta: boolean
  editable: boolean
  guardando: boolean
  onAbrir: () => void
  onAlumno: (alumnoId: number) => void
  onTodos: () => void
  onTotal: (v: number) => void
  onGuardar: () => void
  onIncidencia: () => void
}) {
  const incidencia = s.incidencia
  const txtIncidencia = textoIncidencia(s.hora_inicio, s.hora_fin, incidencia)
  const inscritos = s.alumnos.length
  const faltas = b.faltas.size
  const presentes = inscritos - faltas
  const estado = b.sucio ? 'sucio' : s.registro ? 'ok' : 'pend'
  const etiquetaEstado = b.sucio ? 'Sin guardar' : s.registro ? 'Registrado' : 'Pendiente'
  const cuerpoId = `as-cuerpo-${s.asignacion_id}`
  const bloqueado = faltas > 0
  const diferencia = inscritos - b.total
  const pendientes = b.sucio ? 0 : faltasPendientes(s)
  const avisoPendiente =
    pendientes > 0
      ? `Faltan registrar ${pendientes} ${pendientes === 1 ? 'falta' : 'faltas'}`
      : pendientes < 0
        ? `Hay ${-pendientes} ${pendientes === -1 ? 'alumno' : 'alumnos'} más que en la lista`
        : null

  return (
    <li className="as-card" data-estado={estado} data-abierta={abierta || undefined} style={{ ['--as-color' as string]: s.color, ['--tl-color' as string]: s.color }}>
      <div className="as-card-fila">
      <button type="button" className="as-card-head" onClick={onAbrir} aria-expanded={abierta} aria-controls={cuerpoId}>
        <span className="as-card-info">
          <span className="as-card-top">
            <strong className="as-card-nombre">{s.taller}</strong>
            {s.grados ? <span className="tl-grados">{s.grados}</span> : null}
          </span>
          <span className="as-card-meta">
            <span><Clock size={13} aria-hidden /> {hora12(s.hora_inicio)} – {hora12(s.hora_fin)}</span>
            {s.lugar ? <span><MapPin size={13} aria-hidden /> {s.lugar}</span> : null}
            <span><User size={13} aria-hidden /> {s.maestro}</span>
            {s.niveles.length > 1 ? <span className="tl-mixto">{s.niveles.map(etiquetaNivel).join(' + ')}</span> : null}
          </span>
          {txtIncidencia ? (
            <span className="as-inc-chip">
              <Timer size={13} aria-hidden /> {txtIncidencia}
            </span>
          ) : null}
        </span>
        <span className="as-card-lado">
          <span className="as-estado" data-estado={estado}>{etiquetaEstado}</span>
          {avisoPendiente ? (
            <span className="as-pulso" role="img" aria-label={avisoPendiente} title={avisoPendiente} />
          ) : null}
          <span className="as-conteo" aria-label={`${b.total} en el salón de ${inscritos} inscritos`}>
            <strong>{b.total}</strong>/{inscritos}
          </span>
          {faltas ? <span className="as-faltas-chip">{faltas} {faltas === 1 ? 'falta' : 'faltas'}</span> : null}
          <ChevronDown size={18} aria-hidden className="as-chevron" />
        </span>
      </button>
      {editable ? (
        <button
          type="button"
          className="as-inc-btn"
          data-con={incidencia ? (incidencia.falto ? 'falta' : 'inc') : undefined}
          onClick={onIncidencia}
          aria-label={`Horario del maestro de ${s.taller}${txtIncidencia ? `: ${txtIncidencia}` : ''}`}
          title="¿Llegó tarde, salió antes o no asistió?"
        >
          <Timer size={20} aria-hidden />
          <span>Maestro</span>
        </button>
      ) : null}
      </div>

      {abierta ? (
        <div className="as-card-cuerpo" id={cuerpoId}>
          {inscritos ? (
            <>
              <div className="as-lista-head">
                <span>
                  <strong className="as-txt-ok">{presentes}</strong> presentes ·{' '}
                  <strong className="as-txt-falta">{faltas}</strong> faltas
                </span>
                {editable && faltas ? (
                  <button type="button" className="as-btn-sec" onClick={onTodos}>
                    <CheckCheck size={16} aria-hidden /> Todos presentes
                  </button>
                ) : null}
              </div>
              <ul className="as-alumnos">
                {s.alumnos.map((a) => {
                  const falta = b.faltas.has(a.alumno_id)
                  return (
                    <li key={a.alumno_id}>
                      <button
                        type="button"
                        className="as-alumno"
                        data-falta={falta || undefined}
                        aria-pressed={!falta}
                        disabled={!editable}
                        onClick={() => onAlumno(a.alumno_id)}
                      >
                        <span className="as-check" aria-hidden>
                          {falta ? <X size={18} strokeWidth={3} /> : <Check size={18} strokeWidth={3} />}
                        </span>
                        <span className="as-alumno-nombre">{a.nombre}</span>
                        <span className="as-alumno-grado">{falta ? 'Falta' : a.grado}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="as-sin-lista">Este taller aún no tiene alumnos en lista. Registra solo el total del salón.</p>
          )}

          <div className="as-total">
            <label htmlFor={`as-total-${s.asignacion_id}`}>
              <strong>Alumnos en el salón</strong>
              <span>
                {bloqueado
                  ? `Automático: ${inscritos} inscritos − ${faltas} ${faltas === 1 ? 'falta' : 'faltas'}`
                  : 'Conteo físico al pasar por el taller'}
              </span>
            </label>
            <div className="as-stepper" data-bloqueado={bloqueado || undefined}>
              <button type="button" onClick={() => onTotal(b.total - 1)} disabled={!editable || bloqueado || b.total <= 0} aria-label="Uno menos">
                <Minus size={18} aria-hidden />
              </button>
              <input
                id={`as-total-${s.asignacion_id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={500}
                value={b.total}
                disabled={!editable}
                readOnly={bloqueado}
                aria-readonly={bloqueado}
                onChange={(e) => onTotal(Number(e.target.value))}
              />
              <button type="button" onClick={() => onTotal(b.total + 1)} disabled={!editable || bloqueado} aria-label="Uno más">
                <Plus size={18} aria-hidden />
              </button>
            </div>
            {inscritos && !bloqueado && diferencia !== 0 ? (
              <p className="as-difiere">
                {diferencia > 0
                  ? `Contaste ${b.total} de ${inscritos}: marca en la lista ${diferencia === 1 ? 'la falta' : `las ${diferencia} faltas`}.`
                  : `Contaste ${b.total}: hay ${-diferencia} más que los ${inscritos} de la lista.`}
              </p>
            ) : null}
          </div>

          {incidencia ? (
            <ResumenIncidencia s={s} incidencia={incidencia} editable={editable} onEditar={onIncidencia} />
          ) : null}

          <div className="as-pie">
            {s.registro && !b.sucio ? (
              <span className="as-guardado">
                <Check size={14} aria-hidden /> Guardado {horaCorta(s.registro.updated_at)}
                {s.registro.registrado_por ? ` · ${s.registro.registrado_por}` : ''}
              </span>
            ) : (
              <span />
            )}
            {editable ? (
              <button type="button" className="as-btn-guardar" onClick={onGuardar} disabled={guardando}>
                {guardando ? <Loader2 size={18} className="tl-spin" aria-hidden /> : <Save size={18} aria-hidden />}
                {s.registro ? 'Actualizar asistencia' : 'Guardar asistencia'}
              </button>
            ) : (
              <span className="as-solo-consulta">Solo consulta</span>
            )}
          </div>
        </div>
      ) : null}
    </li>
  )
}

const RAPIDOS_TARDE = [5, 10, 15, 30]
const RAPIDOS_ANTES = [15, 30, 45, 60]

function ResumenIncidencia({
  s,
  incidencia,
  editable,
  onEditar,
}: {
  s: SesionAsistencia
  incidencia: IncidenciaMaestro
  editable: boolean
  onEditar: () => void
}) {
  const duracion = minutosDeHora(s.hora_fin) - minutosDeHora(s.hora_inicio)
  const perdidos = minutosIncidencia(s.hora_inicio, s.hora_fin, incidencia)
  return (
    <div className="as-inc-resumen" data-falta={incidencia.falto || undefined}>
      <Timer size={18} aria-hidden className="as-inc-icono" />
      <div className="as-inc-resumen-txt">
        <strong>{textoIncidencia(s.hora_inicio, s.hora_fin, incidencia)}</strong>
        <span>
          {incidencia.falto
            ? 'Esta clase no suma horas al maestro'
            : `Impartió ${textoDuracion(Math.max(0, duracion - perdidos.tarde - perdidos.antes))} de ${textoDuracion(duracion)}`}
          {incidencia.motivo ? ` · ${incidencia.motivo}` : ''}
          {incidencia.nota ? ` · ${incidencia.nota}` : ''}
        </span>
        {incidencia.registrado_por ? <small>Anotó: {incidencia.registrado_por}</small> : null}
      </div>
      {editable ? (
        <button type="button" className="as-btn-sec as-inc-editar" onClick={onEditar}>
          Editar
        </button>
      ) : null}
    </div>
  )
}

function ModalIncidencia({
  s,
  onCerrar,
  onGuardar,
}: {
  s: SesionAsistencia
  onCerrar: () => void
  onGuardar: (d: DatosIncidencia) => Promise<void>
}) {
  const inc = s.incidencia
  const [falto, setFalto] = useState(Boolean(inc?.falto))
  const [tarde, setTarde] = useState(Boolean(inc?.llegada))
  const [antes, setAntes] = useState(Boolean(inc?.salida))
  const [llegada, setLlegada] = useState(inc?.llegada ?? '')
  const [salida, setSalida] = useState(inc?.salida ?? '')
  const [motivo, setMotivo] = useState(inc?.motivo ?? '')
  const [nota, setNota] = useState(inc?.nota ?? '')
  const [guardando, setGuardando] = useState(false)

  const ini = minutosDeHora(s.hora_inicio)
  const fin = minutosDeHora(s.hora_fin)
  const duracion = fin - ini
  const usaTarde = tarde && !falto
  const usaAntes = antes && !falto
  const mLlegada = usaTarde && llegada ? minutosDeHora(llegada) : null
  const mSalida = usaAntes && salida ? minutosDeHora(salida) : null
  const minTarde = mLlegada != null ? mLlegada - ini : 0
  const minAntes = mSalida != null ? fin - mSalida : 0
  const rango = `${hora12(s.hora_inicio)} – ${hora12(s.hora_fin)}`
  const hayAlgo = falto || usaTarde || usaAntes

  let problema: string | null = null
  if (usaTarde && !llegada) problema = 'Indica a qué hora llegó.'
  else if (usaAntes && !salida) problema = 'Indica a qué hora se fue.'
  else if (mLlegada != null && (mLlegada <= ini || mLlegada >= fin)) problema = `La llegada debe quedar dentro de la clase (${rango}).`
  else if (mSalida != null && (mSalida <= ini || mSalida >= fin)) problema = `La salida debe quedar dentro de la clase (${rango}).`
  else if (mLlegada != null && mSalida != null && mSalida <= mLlegada) problema = 'La salida debe ser después de la llegada.'

  const enviar = async () => {
    if (!hayAlgo && !inc) {
      onCerrar()
      return
    }
    setGuardando(true)
    await onGuardar({
      falto,
      llegada: usaTarde ? llegada : null,
      salida: usaAntes ? salida : null,
      motivo: hayAlgo ? motivo : '',
      nota: hayAlgo ? nota : '',
    })
    setGuardando(false)
  }

  const opcion = (
    activo: boolean,
    setActivo: (v: boolean) => void,
    titulo: string,
    valor: string,
    setValor: (v: string) => void,
    rapidos: number[],
    desdeInicio: boolean,
    id: string
  ) => (
    <div className="as-inc-opcion" data-activo={(activo && !falto) || undefined} data-deshabilitado={falto || undefined}
      role="group" aria-label={titulo}>
      <button type="button" className="as-inc-toggle" aria-pressed={activo && !falto} disabled={falto}
        onClick={() => setActivo(!activo)}>
        <span className="as-inc-caja" aria-hidden>{activo && !falto ? <Check size={16} strokeWidth={3} /> : null}</span>
        {titulo}
      </button>
      {activo && !falto ? (
        <div className="as-inc-campos">
          <div className="as-inc-rapidos" role="group" aria-label={`${titulo}: minutos`}>
            {rapidos
              .filter((m) => m < duracion)
              .map((m) => {
                const h = horaMasMinutos(desdeInicio ? s.hora_inicio : s.hora_fin, desdeInicio ? m : -m)
                return (
                  <button key={m} type="button" className="as-inc-rapido" data-activo={valor === h || undefined}
                    aria-pressed={valor === h} onClick={() => setValor(h)}>
                    {desdeInicio ? '+' : '−'}{m} min
                  </button>
                )
              })}
          </div>
          <label className="as-inc-hora" htmlFor={id}>
            <span>Hora exacta</span>
            <input id={id} type="time" step={60} value={valor}
              min={horaMasMinutos(s.hora_inicio, 1)} max={horaMasMinutos(s.hora_fin, -1)}
              onChange={(e) => setValor(e.target.value)} />
          </label>
        </div>
      ) : null}
    </div>
  )

  return (
    <TlModal
      abierto
      titulo="¿Cómo estuvo el maestro hoy?"
      subtitulo={`${s.taller}${s.grados ? ` ${s.grados}` : ''} · ${s.maestro} · ${rango}`}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="tl-btn" onClick={onCerrar} disabled={guardando}>
            Cerrar
          </button>
          <button
            type="button"
            className="tl-btn tl-btn-primary"
            data-a-tiempo={!hayAlgo || undefined}
            disabled={guardando || Boolean(problema)}
            onClick={() => void enviar()}
          >
            {guardando ? <Loader2 size={16} className="tl-spin" aria-hidden /> : hayAlgo ? <Save size={16} aria-hidden /> : <CheckCheck size={16} aria-hidden />}
            {hayAlgo ? 'Guardar' : 'Llegó a tiempo'}
          </button>
        </>
      }
    >
      <div className="as-inc-modal">
        <p className="as-inc-ayuda">
          Si el maestro dio su clase completa, solo pulsa <strong>«Llegó a tiempo»</strong>.
        </p>
        <div className="as-inc-opcion as-inc-falto" data-activo={falto || undefined} role="group" aria-label="No asistió">
          <button type="button" className="as-inc-toggle" aria-pressed={falto} onClick={() => setFalto(!falto)}>
            <span className="as-inc-caja" aria-hidden>{falto ? <Check size={16} strokeWidth={3} /> : null}</span>
            El maestro no asistió
          </button>
          {falto ? <p className="as-inc-nota-falto">Esta clase no sumará horas en el reporte del maestro.</p> : null}
        </div>
        {opcion(tarde, setTarde, 'Llegó tarde', llegada, setLlegada, RAPIDOS_TARDE, true, `as-inc-lleg-${s.asignacion_id}`)}
        {opcion(antes, setAntes, 'Salió antes', salida, setSalida, RAPIDOS_ANTES, false, `as-inc-sal-${s.asignacion_id}`)}

        {problema ? (
          <p className="as-difiere">{problema}</p>
        ) : usaTarde || usaAntes ? (
          <p className="as-inc-calculo">
            Impartió <strong>{textoDuracion(Math.max(0, duracion - minTarde - minAntes))}</strong> de {textoDuracion(duracion)} ·{' '}
            <strong>{minTarde + minAntes} min menos</strong>
          </p>
        ) : null}

        {hayAlgo ? (
          <div className="as-inc-motivos" role="group" aria-label="Motivo (opcional)">
            <span className="as-inc-label">Motivo <small>(opcional)</small></span>
            <div className="as-inc-rapidos">
              {MOTIVOS_INCIDENCIA.map((m) => (
                <button key={m} type="button" className="as-inc-rapido" data-activo={motivo === m || undefined}
                  aria-pressed={motivo === m} onClick={() => setMotivo(motivo === m ? '' : m)}>
                  {m}
                </button>
              ))}
            </div>
            <input className="as-inc-nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={300}
              placeholder="Nota (opcional)" aria-label="Nota" />
          </div>
        ) : null}
      </div>
    </TlModal>
  )
}
