'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Loader2,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  esStaffPreviewPanelPadres,
  PORTAL_AUTORIZADOS_PREVIEW_REFS,
  puedeVerModuloPortalAutorizados,
} from '@/lib/portalPadresPreview'
import {
  bloqueadoDespuesDeLaUna,
  DIAS_SEMANA_PIE,
  diasSemanaNormalizados,
  instanteMexico,
  type DiaSemanaPie,
} from '@/lib/diasSemanaPie'
import type { RegistroSalidaPie } from '@/lib/registroSalidaPieService'
import ThemeToggle from '@/components/ThemeToggle'
import { usePortalToast } from '@/components/PortalToast'

type AlumnoSalida = {
  alumnoId: number
  alumnoRef: number
  nombre: string
  nivel: string
  grado: string
  grupo: string
}

function fechaMostrar(iso: string): string {
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function etiquetaFechaCorta(iso: string): string {
  const raw = String(iso).slice(0, 10)
  try {
    return new Date(`${raw}T12:00:00`).toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return fechaMostrar(raw)
  }
}

function partesFechaBadge(iso: string): { dia: string; mes: string } {
  const raw = String(iso).slice(0, 10)
  try {
    const d = new Date(`${raw}T12:00:00`)
    return {
      dia: String(d.getDate()),
      mes: d.toLocaleDateString('es-MX', { month: 'short' }).replace(/\./g, ''),
    }
  } catch {
    return { dia: raw.slice(8, 10), mes: '' }
  }
}

function isoDeFecha(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function diasDelMes(ancla: Date): (Date | null)[] {
  const anio = ancla.getFullYear()
  const mes = ancla.getMonth()
  const primero = new Date(anio, mes, 1)
  const ultimo = new Date(anio, mes + 1, 0)
  const celdas: (Date | null)[] = []
  for (let i = 0; i < primero.getDay(); i++) celdas.push(null)
  for (let d = 1; d <= ultimo.getDate(); d++) celdas.push(new Date(anio, mes, d))
  return celdas
}

function fechaEventualValida(fecha: Date): boolean {
  const hoy = instanteMexico().iso
  const iso = isoDeFecha(fecha)
  if (iso < hoy) return false
  const limite = new Date(`${hoy}T12:00:00`)
  limite.setDate(limite.getDate() + 15)
  if (iso > isoDeFecha(limite)) return false
  const dow = fecha.getDay()
  return dow !== 0 && dow !== 6
}

export default function PortalSalidaPieView() {
  const router = useRouter()
  const { session } = useAuth()
  const esStaff = esStaffPreviewPanelPadres(session)
  const permitido = puedeVerModuloPortalAutorizados(session)
  const { toast, host } = usePortalToast()

  const [refBusqueda, setRefBusqueda] = useState(String(PORTAL_AUTORIZADOS_PREVIEW_REFS[0] ?? ''))
  const [alumno, setAlumno] = useState<AlumnoSalida | null>(null)
  const [registros, setRegistros] = useState<RegistroSalidaPie[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mostrarCalendario, setMostrarCalendario] = useState(false)
  const [mesActual, setMesActual] = useState(() => new Date())
  const [fechasSel, setFechasSel] = useState<string[]>([])

  const permanente = useMemo(
    () => registros.find((r) => r.tipo_registro === 'permanente') ?? null,
    [registros]
  )
  const diasActivos = useMemo(
    () => new Set(diasSemanaNormalizados(permanente?.dias_semana)),
    [permanente]
  )
  const eventuales = useMemo(() => {
    const items: { registroId: number; fecha: string }[] = []
    for (const r of registros) {
      if (r.tipo_registro !== 'eventual') continue
      for (const f of r.fechas_especificas ?? []) {
        items.push({ registroId: r.id, fecha: String(f).slice(0, 10) })
      }
    }
    return items.sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [registros])

  const aplicar = useCallback((data: { alumno?: AlumnoSalida; registros?: RegistroSalidaPie[] }) => {
    if (data.alumno) setAlumno(data.alumno)
    setRegistros(data.registros ?? [])
  }, [])

  const toastRef = useRef(toast)
  toastRef.current = toast

  const cargar = useCallback(
    async (opts?: { alumnoRef?: string; alumnoId?: number }) => {
      setCargando(true)
      try {
        const params = new URLSearchParams()
        if (opts?.alumnoRef) params.set('alumnoRef', opts.alumnoRef)
        if (opts?.alumnoId) params.set('alumnoId', String(opts.alumnoId))
        const res = await fetch(`/api/portal-salida-pie?${params.toString()}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar.')
        aplicar(data)
      } catch (e) {
        setAlumno(null)
        setRegistros([])
        toastRef.current(e instanceof Error ? e.message : 'No se pudo cargar.', 'error')
      } finally {
        setCargando(false)
      }
    },
    [aplicar]
  )

  useEffect(() => {
    if (!permitido) {
      router.replace('/dashboard')
      return
    }
    if (esStaff) {
      void cargar({ alumnoRef: String(PORTAL_AUTORIZADOS_PREVIEW_REFS[0]) })
      return
    }
    void cargar({ alumnoId: Number(session?.alumno_id) })
  }, [permitido, esStaff, session?.alumno_id, cargar, router])

  const cancelaciones = permanente?.cancelaciones_usadas ?? 0
  const sinCancelaciones = cancelaciones >= 5
  const cancelPct = Math.min(100, Math.round((cancelaciones / 5) * 100))

  const post = async (body: Record<string, unknown>, okMsg: string): Promise<boolean> => {
    setGuardando(true)
    try {
      const res = await fetch('/api/portal-salida-pie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          alumnoId: alumno?.alumnoId,
          alumnoRef: alumno?.alumnoRef ?? refBusqueda.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar.')
      aplicar(data)
      toast(okMsg)
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar.', 'error')
      return false
    } finally {
      setGuardando(false)
    }
  }

  const toggleDia = (dia: DiaSemanaPie, activo: boolean) => {
    if (bloqueadoDespuesDeLaUna({ dia })) {
      toast(`No se puede cambiar ${dia} después de la 1:00 p.m. del mismo día.`, 'error')
      return
    }
    if (activo && sinCancelaciones) {
      toast('Ya usó las 5 cancelaciones permitidas.', 'error')
      return
    }
    if (activo) {
      if (!window.confirm(`¿Desactivar ${dia}? Cuenta como 1 de 5 cancelaciones.`)) return
    }
    void post(
      { accion: activo ? 'desactivar-dia' : 'activar-dia', dia },
      activo ? `${dia} desactivado.` : `${dia} activado.`
    )
  }

  const guardarEventuales = async () => {
    if (fechasSel.length === 0) {
      toast('Selecciona al menos un día.', 'error')
      return
    }
    const ok = await post(
      { accion: 'agregar-eventuales', fechas: fechasSel },
      'Días eventuales guardados.'
    )
    if (!ok) return
    setFechasSel([])
    setMostrarCalendario(false)
  }

  const quitarFecha = (registroId: number, fecha: string) => {
    if (!window.confirm(`¿Quitar el ${fechaMostrar(fecha)}?`)) return
    void post({ accion: 'eliminar-fecha', registroId, fecha }, 'Día eventual eliminado.')
  }

  const nombreMes = mesActual.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  const volverDashboard = esStaff ? '/dashboard?vista=padres' : '/dashboard'

  return (
    <div className="dashboard-container dashboard-home portal-inscripciones-page portal-autorizados-page portal-salida-pie-page portal-padres-mod">
      <div className="dashboard-home-bg" aria-hidden />
      <div className="dashboard-main portal-inscripciones-main">
        <header className="portal-padres-encabezado">
          <div className="portal-autorizados-topbar">
            <button type="button" className="servicios-back-btn" onClick={() => router.push(volverDashboard)}>
              <ArrowLeft size={16} aria-hidden />
              Volver al inicio
            </button>
            <ThemeToggle />
          </div>
          <p className="portal-inscripciones-kicker">Salida del plantel</p>
          <h1 className="dashboard-title portal-inscripciones-titulo">Salida a pie</h1>
          <p className="portal-padres-lead">
            Marca los días en que el alumno sale caminando. Quién puede recogerlo se registra en{' '}
            <Link href="/portal-autorizados">Personas autorizadas</Link>.
          </p>
          <nav className="portal-padres-modulos" aria-label="Módulos de recogida">
            <span className="portal-padres-modulo is-on" aria-current="page">
              <Footprints size={16} aria-hidden />
              Salida a pie
            </span>
            <Link href="/portal-autorizados" className="portal-padres-modulo">
              <Users size={16} aria-hidden />
              Personas autorizadas
            </Link>
          </nav>
        </header>

        {esStaff ? (
          <form
            className="portal-padres-buscar"
            onSubmit={(e) => {
              e.preventDefault()
              if (!refBusqueda.trim()) return
              void cargar({ alumnoRef: refBusqueda.trim() })
            }}
          >
            <label htmlFor="portal_salida_ref" className="servicios-sr-only">
              Número de control
            </label>
            <input
              id="portal_salida_ref"
              className="alumno-form-input"
              inputMode="numeric"
              value={refBusqueda}
              onChange={(e) => setRefBusqueda(e.target.value)}
              placeholder="No. de control"
              autoComplete="off"
            />
            <button type="submit" className="portal-autorizados-btn-pri" disabled={cargando}>
              {cargando ? <Loader2 size={18} className="alumno-form-guardar-btn-icon" /> : null}
              Abrir
            </button>
          </form>
        ) : null}

        {cargando && !alumno ? (
          <div className="portal-padres-cargando" role="status">
            <Loader2 size={20} className="portal-inscripciones-spin" aria-hidden />
            Cargando…
          </div>
        ) : null}

        {alumno ? (
          <div className="portal-padres-cuerpo pa-stack pa-stack--row">
            <section className="pa-bloque" aria-labelledby="sp-perm-titulo">
              <div className="pa-bloque-head">
                <div>
                  <div className="pa-bloque-titulo-row">
                    <h2 id="sp-perm-titulo">Cada semana</h2>
                    <span className="pa-conteo">{diasActivos.size}</span>
                  </div>
                  <p>Activa los días fijos. Desactivar cuenta como cancelación.</p>
                </div>
              </div>

              <div
                className={`portal-salida-pie-meter${sinCancelaciones ? ' is-max' : ''}`}
                role="status"
                aria-label={`Cancelaciones usadas: ${cancelaciones} de 5`}
              >
                <div className="portal-salida-pie-meter-top">
                  <span>Cancelaciones</span>
                  <strong>
                    {cancelaciones}
                    <span aria-hidden>/5</span>
                  </strong>
                </div>
                <div className="portal-salida-pie-meter-track" aria-hidden>
                  <span style={{ width: `${cancelPct}%` }} />
                </div>
              </div>

              <div className="portal-salida-pie-dias" role="list">
                {DIAS_SEMANA_PIE.map(({ value, label }) => {
                  const activo = diasActivos.has(value)
                  const bloqueadoHoy = bloqueadoDespuesDeLaUna({ dia: value })
                  const noPuedeDesactivar = sinCancelaciones || bloqueadoHoy
                  const noPuedeActivar = bloqueadoHoy
                  const noPuede = activo ? noPuedeDesactivar : noPuedeActivar
                  const motivo = bloqueadoHoy
                    ? 'Después de la 1:00 p.m. no se puede cambiar el día de hoy.'
                    : activo && sinCancelaciones
                      ? 'Ya usó las 5 cancelaciones permitidas.'
                      : undefined
                  return (
                    <button
                      key={value}
                      type="button"
                      role="listitem"
                      className={`portal-salida-pie-dia${activo ? ' portal-salida-pie-dia--activo' : ''}`}
                      disabled={guardando || noPuede}
                      title={motivo}
                      aria-pressed={activo}
                      onClick={() => toggleDia(value, activo)}
                    >
                      <strong>{label}</strong>
                      <span className="portal-salida-pie-dia-estado">
                        {activo ? 'Sale a pie' : 'No sale'}
                      </span>
                      <span
                        className={`portal-salida-pie-switch${activo ? ' is-on' : ''}`}
                        aria-hidden
                      />
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="pa-bloque pa-bloque--especial" aria-labelledby="sp-evt-titulo">
              <div className="pa-bloque-head">
                <div>
                  <div className="pa-bloque-titulo-row">
                    <h2 id="sp-evt-titulo">Solo algunos días</h2>
                    {eventuales.length > 0 ? (
                      <span className="pa-conteo">{eventuales.length}</span>
                    ) : null}
                  </div>
                  <p>Fechas puntuales, lunes a viernes, hasta 15 días adelante.</p>
                </div>
                {!mostrarCalendario ? (
                  <button
                    type="button"
                    className="pa-btn-add"
                    onClick={() => setMostrarCalendario(true)}
                  >
                    <Plus size={18} aria-hidden />
                    Agregar
                  </button>
                ) : null}
              </div>

              {eventuales.length === 0 && !mostrarCalendario ? (
                <button
                  type="button"
                  className="pa-vacio"
                  onClick={() => setMostrarCalendario(true)}
                >
                  <span className="pa-vacio-icono" aria-hidden>
                    <CalendarDays size={22} />
                  </span>
                  <strong>Sin días eventuales</strong>
                  <span>Agrega una fecha suelta para salir a pie</span>
                </button>
              ) : null}

              {eventuales.length > 0 ? (
                <ul className="pa-lista">
                  {eventuales.map((item) => {
                    const badge = partesFechaBadge(item.fecha)
                    const bloqueado = bloqueadoDespuesDeLaUna({ fecha: item.fecha })
                    return (
                      <li key={`${item.registroId}-${item.fecha}`} className="pa-fila">
                        <span className="pa-fecha-badge">
                          <span className="pa-fecha-badge-dia">{badge.dia}</span>
                          <span className="pa-fecha-badge-mes">{badge.mes}</span>
                        </span>
                        <div className="pa-fila-texto">
                          <strong>{etiquetaFechaCorta(item.fecha)}</strong>
                          <div className="pa-meta">
                            <span>Salida eventual</span>
                          </div>
                        </div>
                        <div className="pa-fila-acciones">
                          <button
                            type="button"
                            className="pa-icon-btn pa-icon-btn--danger"
                            disabled={guardando || bloqueado}
                            onClick={() => quitarFecha(item.registroId, item.fecha)}
                            aria-label={`Eliminar ${fechaMostrar(item.fecha)}`}
                            title={
                              bloqueado
                                ? 'Después de la 1:00 p.m. no se puede quitar el día de hoy.'
                                : undefined
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : null}

              {mostrarCalendario ? (
                <div className="portal-salida-pie-cal">
                  <div className="portal-salida-pie-cal-nav">
                    <button
                      type="button"
                      className="portal-salida-pie-cal-nav-btn"
                      onClick={() =>
                        setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, 1))
                      }
                      aria-label="Mes anterior"
                    >
                      <ChevronLeft size={18} aria-hidden />
                    </button>
                    <strong className="portal-salida-pie-cal-mes">{nombreMes}</strong>
                    <button
                      type="button"
                      className="portal-salida-pie-cal-nav-btn"
                      onClick={() =>
                        setMesActual(new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1))
                      }
                      aria-label="Mes siguiente"
                    >
                      <ChevronRight size={18} aria-hidden />
                    </button>
                  </div>
                  <div className="portal-salida-pie-cal-grid" role="grid">
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                      <span key={`${d}-${i}`} className="portal-salida-pie-cal-head">
                        {d}
                      </span>
                    ))}
                    {diasDelMes(mesActual).map((fecha, i) => {
                      if (!fecha) return <span key={`e-${i}`} className="portal-salida-pie-cal-vacio" />
                      const iso = isoDeFecha(fecha)
                      const valida = fechaEventualValida(fecha)
                      const sel = fechasSel.includes(iso)
                      return (
                        <button
                          key={iso}
                          type="button"
                          className={`portal-salida-pie-cal-dia${sel ? ' is-sel' : ''}${
                            !valida ? ' is-off' : ''
                          }`}
                          disabled={!valida}
                          onClick={() =>
                            setFechasSel((prev) =>
                              prev.includes(iso) ? prev.filter((x) => x !== iso) : [...prev, iso]
                            )
                          }
                        >
                          {fecha.getDate()}
                        </button>
                      )
                    })}
                  </div>
                  <p className="portal-salida-pie-ayuda">
                    {fechasSel.length === 0
                      ? 'Toca los días que quieras agregar.'
                      : `${fechasSel.length} ${
                          fechasSel.length === 1 ? 'día seleccionado' : 'días seleccionados'
                        }`}
                  </p>
                  <div className="portal-autorizados-form-acciones">
                    <button
                      type="button"
                      className="portal-autorizados-btn-sec"
                      onClick={() => {
                        setMostrarCalendario(false)
                        setFechasSel([])
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="portal-autorizados-btn-pri"
                      disabled={guardando || fechasSel.length === 0}
                      onClick={() => void guardarEventuales()}
                    >
                      {guardando ? <Loader2 size={16} className="portal-inscripciones-spin" /> : null}
                      Guardar
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
      {host}
    </div>
  )
}
