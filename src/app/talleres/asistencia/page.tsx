'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  User,
  X,
} from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { parsePortalSessionHeader, readPortalSessionForFetch } from '@/lib/insforgeDbProxyShared'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import {
  DIAS_TALLER,
  etiquetaNivel,
  hora12,
  type AsistenciaDia,
  type RegistroAsistencia,
  type SesionAsistencia,
} from '@/lib/talleres/talleresTypes'
import '../talleres.css'
import './asistencia.css'

const CLAVE_NOMBRE = 'talleres-asistencia-nombre'

type Borrador = {
  faltas: Set<number>
  total: number
  /** El conteo se editó a mano; ya no sigue a la lista. */
  totalManual: boolean
  sucio: boolean
}

function borradorDesde(s: SesionAsistencia): Borrador {
  const faltas = new Set(s.registro?.faltas ?? [])
  const presentes = s.alumnos.length - faltas.size
  const total = s.registro?.total_alumnos ?? presentes
  return { faltas, total, totalManual: total !== presentes, sucio: false }
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

  const cargar = useCallback(async (f: string | null) => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/talleres/asistencia${f ? `?fecha=${f}` : ''}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar la asistencia.')
      const d = json as AsistenciaDia
      setData(d)
      setFecha(d.fecha)
      setBorradores(Object.fromEntries(d.sesiones.map((s) => [s.asignacion_id, borradorDesde(s)])))
      setAbierta(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setCargando(false)
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
    if (!haySinGuardar) return
    const alSalir = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [haySinGuardar])

  const irA = (f: string) => {
    if (f === fecha) return
    if (haySinGuardar && !window.confirm('Hay listas sin guardar. ¿Cambiar de día y descartarlas?')) return
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
    for (const s of sesiones) {
      if (!s.registro) continue
      registrados++
      faltas += s.registro.faltas.length
      presentes += s.registro.total_alumnos ?? s.alumnos.length - s.registro.faltas.length
    }
    return { registrados, presentes, faltas }
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
      return { ...b, faltas, total: b.totalManual ? b.total : s.alumnos.length - faltas.size }
    })

  const todosPresentes = (id: number) =>
    actualizar(id, (b, s) => ({ ...b, faltas: new Set(), total: b.totalManual ? b.total : s.alumnos.length }))

  const cambiarTotal = (id: number, valor: number) =>
    actualizar(id, (b) => ({ ...b, total: Math.max(0, Math.min(500, Math.round(valor) || 0)), totalManual: true }))

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
    try {
      const res = await fetch('/api/talleres/asistencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...portalSessionFetchHeaders() },
        body: JSON.stringify({
          asignacion_id: s.asignacion_id,
          fecha,
          faltas: [...b.faltas],
          total_alumnos: b.total,
          registrado_por: quien,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar.')
      const registro = json.registro as RegistroAsistencia
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(null)
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
                onClick={() => (haySinGuardar && !window.confirm('Hay listas sin guardar. ¿Recargar y descartarlas?') ? null : void cargar(fecha))}
                aria-label="Recargar"
                disabled={cargando}
              >
                <RefreshCw size={16} aria-hidden className={cargando ? 'tl-spin' : undefined} />
              </button>
              <ThemeToggle />
            </div>
          </div>
          <p className="tl-kicker">Talleres{data ? ` · Ciclo ${data.ciclo.nombre}` : ''}</p>
          <h1 className="tl-title">Asistencia diaria</h1>
          <p className="tl-lead">
            Todos aparecen presentes: toca a quien falte y guarda. Registra también cuántos alumnos hay en el salón.
          </p>
        </header>

        <div className="tl-toasts" aria-live="polite">
          {error ? (
            <p className="tl-msg tl-msg-error" role="alert">
              <span>{error}</span>
              <button type="button" className="tl-msg-x" onClick={() => setError(null)} aria-label="Cerrar aviso">×</button>
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

        {fecha ? (
          <nav className="as-dias" aria-label="Día">
            <button type="button" className="as-flecha" onClick={() => irA(sumarDias(semana[0], -7))} aria-label="Semana anterior">
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
                  onClick={() => irA(f)}
                >
                  <span className="as-dia-nombre">{DIAS_TALLER[i].etiqueta.slice(0, 3)}</span>
                  <span className="as-dia-num">{Number(f.slice(8))}</span>
                </button>
              ))}
            </div>
            <button type="button" className="as-flecha" onClick={() => irA(sumarDias(semana[0], 7))} aria-label="Semana siguiente">
              <ChevronRight size={18} aria-hidden />
            </button>
            {hoy && fecha !== hoy ? (
              <button type="button" className="as-hoy-btn" onClick={() => irA(hoy)}>Hoy</button>
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

        {cargando && !data ? (
          <p className="tl-loading"><Loader2 size={18} className="tl-spin" aria-hidden /> Cargando…</p>
        ) : data && sesiones.length === 0 ? (
          <p className="tl-empty as-vacio">
            {data.dia === 0 ? 'Es domingo: no hay talleres.' : 'No hay talleres programados este día.'}
          </p>
        ) : data ? (
          grupos.map(([n, lista]) => (
            <section key={n} className="as-grupo" data-nivel={n} aria-label={etiquetaNivel(n)}>
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
                  />
                ))}
              </ul>
            </section>
          ))
        ) : null}
      </div>
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
}) {
  const inscritos = s.alumnos.length
  const faltas = b.faltas.size
  const presentes = inscritos - faltas
  const estado = b.sucio ? 'sucio' : s.registro ? 'ok' : 'pend'
  const etiquetaEstado = b.sucio ? 'Sin guardar' : s.registro ? 'Registrado' : 'Pendiente'
  const cuerpoId = `as-cuerpo-${s.asignacion_id}`
  const difiere = b.total !== presentes

  return (
    <li className="as-card" data-estado={estado} data-abierta={abierta || undefined} style={{ ['--as-color' as string]: s.color, ['--tl-color' as string]: s.color }}>
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
        </span>
        <span className="as-card-lado">
          <span className="as-estado" data-estado={estado}>{etiquetaEstado}</span>
          <span className="as-conteo" aria-label={`${b.total} en el salón de ${inscritos} inscritos`}>
            <strong>{b.total}</strong>/{inscritos}
          </span>
          {faltas ? <span className="as-faltas-chip">{faltas} {faltas === 1 ? 'falta' : 'faltas'}</span> : null}
          <ChevronDown size={18} aria-hidden className="as-chevron" />
        </span>
      </button>

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
              <span>Conteo físico al pasar por el taller</span>
            </label>
            <div className="as-stepper">
              <button type="button" onClick={() => onTotal(b.total - 1)} disabled={!editable || b.total <= 0} aria-label="Uno menos">
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
                onChange={(e) => onTotal(Number(e.target.value))}
              />
              <button type="button" onClick={() => onTotal(b.total + 1)} disabled={!editable} aria-label="Uno más">
                <Plus size={18} aria-hidden />
              </button>
            </div>
            {inscritos && difiere ? (
              <p className="as-difiere">
                El conteo ({b.total}) no coincide con la lista ({presentes} presentes).
              </p>
            ) : null}
          </div>

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
