'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardCheck, FileSpreadsheet, GraduationCap, ListChecks, Loader2, Palette, RefreshCw, UserPlus } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ThemeToggle from '@/components/ThemeToggle'
import { fetchTalleres, mensajeDe } from './components/fetchTalleres'
import {
  nombreMaestroTaller,
  nombreTallerCompleto,
  type Taller,
  type TallerAsignacion,
  type TallerMaestro,
  type TalleresSnapshot,
} from '@/lib/talleres/talleresTypes'
import SemanaView from './components/SemanaView'
import ProgramadosView from './components/ProgramadosView'
import InscripcionesView from './components/inscripciones/InscripcionesView'
import TalleresCatalogo from './components/TalleresCatalogo'
import MaestrosCatalogo from './components/MaestrosCatalogo'
import ReportesView from './components/ReportesView'
import AsignacionModal from './components/AsignacionModal'
import './talleres.css'

type Tab = 'semana' | 'inscripciones' | 'programados' | 'talleres' | 'maestros' | 'reportes'

const TABS: { id: Tab; etiqueta: string; icon: typeof CalendarDays }[] = [
  { id: 'semana', etiqueta: 'Horario semanal', icon: CalendarDays },
  { id: 'inscripciones', etiqueta: 'Altas/Bajas', icon: UserPlus },
  { id: 'programados', etiqueta: 'Programados', icon: ListChecks },
  { id: 'talleres', etiqueta: 'Talleres', icon: Palette },
  { id: 'maestros', etiqueta: 'Maestros', icon: GraduationCap },
  { id: 'reportes', etiqueta: 'Reportes', icon: FileSpreadsheet },
]

export default function TalleresPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <TalleresView />
    </ProtectedRoute>
  )
}

function TalleresView() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('semana')
  const [data, setData] = useState<TalleresSnapshot | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [modalAsig, setModalAsig] = useState<{ abierto: boolean; asignacion: TallerAsignacion | null }>({
    abierto: false,
    asignacion: null,
  })

  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    setErrorCarga(null)
    try {
      setData(await fetchTalleres<TalleresSnapshot>('/api/talleres'))
    } catch (e) {
      setErrorCarga(mensajeDe(e, 'No se pudo cargar la información.'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), 4000)
    return () => window.clearTimeout(t)
  }, [aviso])

  const guardar = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    setGuardando(true)
    setError(null)
    try {
      setData(await fetchTalleres<TalleresSnapshot>('/api/talleres', { method: 'POST', json: body }))
      setAviso(body.id ? 'Cambios guardados.' : 'Registro creado.')
      return true
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo guardar.'))
      return false
    } finally {
      setGuardando(false)
    }
  }, [])

  const eliminar = useCallback(async (recurso: 'taller' | 'maestro' | 'asignacion', id: number, nombre: string) => {
    const pregunta =
      recurso === 'asignacion'
        ? `¿Eliminar el horario de «${nombre}»? Si ya tiene asistencia registrada, se quita del horario pero sus horas se conservan en los reportes.`
        : `¿Eliminar «${nombre}»? Si ya tiene horarios asignados solo se marcará como inactivo.`
    if (!window.confirm(pregunta)) return
    setGuardando(true)
    setError(null)
    try {
      const json = await fetchTalleres<TalleresSnapshot & { modo?: string }>(
        `/api/talleres?recurso=${recurso}&id=${id}`,
        { method: 'DELETE' }
      )
      setData(json)
      setAviso(
        json.modo !== 'desactivado'
          ? `«${nombre}» eliminado.`
          : recurso === 'asignacion'
            ? `«${nombre}» se quitó del horario; su asistencia y horas se conservan en los reportes.`
            : `«${nombre}» tiene horarios; quedó como inactivo.`
      )
    } catch (e) {
      setError(mensajeDe(e, 'No se pudo eliminar.'))
    } finally {
      setGuardando(false)
    }
  }, [])

  const aplicarConteos = useCallback((conteos: Record<number, number>) => {
    setData((prev) =>
      prev
        ? { ...prev, asignaciones: prev.asignaciones.map((a) => ({ ...a, inscritos: conteos[a.id] ?? a.inscritos })) }
        : prev
    )
  }, [])

  const usoPorTaller = useMemo(() => {
    const m = new Map<number, number>()
    for (const a of data?.asignaciones ?? []) m.set(a.taller_id, (m.get(a.taller_id) ?? 0) + 1)
    return m
  }, [data])

  const usoPorMaestro = useMemo(() => {
    const m = new Map<number, number>()
    for (const a of data?.asignaciones ?? []) m.set(a.maestro_id, (m.get(a.maestro_id) ?? 0) + 1)
    return m
  }, [data])

  const nombreAsignacion = (a: TallerAsignacion) => {
    const t = data?.talleres.find((x) => x.id === a.taller_id)
    return t ? nombreTallerCompleto(t) : 'taller'
  }

  const stats = data
    ? [
        { etiqueta: 'Talleres activos', valor: data.talleres.filter((t) => t.activo).length },
        { etiqueta: 'Maestros activos', valor: data.maestros.filter((m) => m.activo).length },
        { etiqueta: 'Sesiones por semana', valor: data.asignaciones.reduce((s, a) => s + a.horarios.length, 0) },
        { etiqueta: 'Inscripciones activas', valor: data.asignaciones.reduce((s, a) => s + a.inscritos, 0) },
      ]
    : []

  return (
    <div className="tl-page">
      <div className="tl-bg" aria-hidden />
      <div className="tl-shell">
        <header className="tl-header">
          <div className="tl-topbar">
            <button type="button" className="tl-back" onClick={() => router.push('/dashboard')}>
              <ArrowLeft size={16} aria-hidden /> Dashboard
            </button>
            <div className="tl-topbar-der">
              <Link href="/talleres/asistencia" className="tl-btn-asistencia">
                <ClipboardCheck size={16} aria-hidden /> Asistencia<span className="tl-ocultar-movil"> diaria</span>
              </Link>
              <button type="button" className="tl-icon-btn" onClick={() => void cargar()} aria-label="Recargar" disabled={cargando}>
                <RefreshCw size={16} aria-hidden className={cargando ? 'tl-spin' : undefined} />
              </button>
              <ThemeToggle />
            </div>
          </div>
          <div className="tl-hero">
          <div className="tl-min0">
            <p className="tl-kicker">Extracurricular{data ? ` · Ciclo ${data.ciclo.nombre}` : ''}</p>
            <h1 className="tl-title">Talleres y Clases Especiales</h1>
            <p className="tl-lead">Catálogo de talleres y maestros, y el horario semanal de lunes a sábado.</p>
          </div>
          {stats.length ? (
            <dl className="tl-stats">
              {stats.map((s) => (
                <div key={s.etiqueta} className="tl-stat">
                  <dt>{s.etiqueta}</dt>
                  <dd>{s.valor}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          </div>
        </header>

        <nav className="tl-tabs" role="tablist" aria-label="Secciones">
          {TABS.map(({ id, etiqueta, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className="tl-tab"
              data-activo={tab === id || undefined} onClick={() => setTab(id)}>
              <Icon size={16} aria-hidden /> {etiqueta}
            </button>
          ))}
        </nav>

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
              <CheckCircle2 size={16} aria-hidden /> {aviso}
            </p>
          ) : null}
        </div>

        {cargando && !data ? (
          <p className="tl-loading"><Loader2 size={18} className="tl-spin" aria-hidden /> Cargando…</p>
        ) : errorCarga && !data ? (
          <div className="tl-error-carga" role="alert">
            <p>{errorCarga}</p>
            <button type="button" className="tl-btn tl-btn-primary" onClick={() => void cargar()} disabled={cargando}>
              <RefreshCw size={16} aria-hidden className={cargando ? 'tl-spin' : undefined} /> Reintentar
            </button>
          </div>
        ) : data ? (
          <>
            {tab === 'semana' ? (
              <SemanaView
                talleres={data.talleres}
                maestros={data.maestros}
                asignaciones={data.asignaciones}
                onNueva={() => setModalAsig({ abierto: true, asignacion: null })}
                onEditar={(a) => setModalAsig({ abierto: true, asignacion: a })}
                onEliminar={(a) => void eliminar('asignacion', a.id, nombreAsignacion(a))}
              />
            ) : null}
            {tab === 'inscripciones' ? (
              <InscripcionesView
                data={data}
                onConteos={aplicarConteos}
                onAviso={setAviso}
                onError={setError}
              />
            ) : null}
            {tab === 'programados' ? (
              <ProgramadosView
                talleres={data.talleres}
                maestros={data.maestros}
                asignaciones={data.asignaciones}
                onNueva={() => setModalAsig({ abierto: true, asignacion: null })}
                onEditar={(a) => setModalAsig({ abierto: true, asignacion: a })}
                onEliminar={(a) => void eliminar('asignacion', a.id, nombreAsignacion(a))}
                onCupo={(a, cupoMin, cupo) => guardar({ recurso: 'cupo', id: a.id, cupo_min: cupoMin, cupo })}
              />
            ) : null}
            {tab === 'talleres' ? (
              <TalleresCatalogo
                talleres={data.talleres}
                usoPorTaller={usoPorTaller}
                guardando={guardando}
                onGuardar={guardar}
                onEliminar={(t: Taller) => void eliminar('taller', t.id, nombreTallerCompleto(t))}
              />
            ) : null}
            {tab === 'maestros' ? (
              <MaestrosCatalogo
                maestros={data.maestros}
                usoPorMaestro={usoPorMaestro}
                guardando={guardando}
                onGuardar={guardar}
                onEliminar={(m: TallerMaestro) => void eliminar('maestro', m.id, nombreMaestroTaller(m))}
              />
            ) : null}
            {tab === 'reportes' ? <ReportesView asignaciones={data.asignaciones} onError={setError} /> : null}

            <AsignacionModal
              abierto={modalAsig.abierto}
              asignacion={modalAsig.asignacion}
              talleres={data.talleres}
              maestros={data.maestros}
              asignaciones={data.asignaciones}
              guardando={guardando}
              onCerrar={() => setModalAsig({ abierto: false, asignacion: null })}
              onGuardar={guardar}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}
