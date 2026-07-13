'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Lock,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import type { EstadoPortalInscripciones, PasoEstadoInscripcion } from '@/lib/portalInscripcionesTypes'
import type { MatrizPortalPagos } from '@/lib/portalPagosMatrizService'
import {
  aplicarReglamentoVistoEnEstado,
  leerReglamentoVisto,
  marcarReglamentoVisto,
} from '@/lib/portalReglamentoVisto'
import PortalColegiaturasSecciones from '@/app/portal-pagos/components/PortalColegiaturasSecciones'

function nombreAlumno(estado: EstadoPortalInscripciones | null, fallback?: string): string {
  if (!estado) return fallback?.trim() || 'Alumno'
  const a = estado.alumno
  const n = `${a.alumno_nombre ?? ''} ${a.alumno_app ?? ''} ${a.alumno_apm ?? ''}`.trim()
  return n || fallback?.trim() || 'Alumno'
}

function iconoPaso(estado: PasoEstadoInscripcion) {
  switch (estado) {
    case 'completado':
      return <CheckCircle2 size={18} className="pi-paso-icon pi-paso-icon--ok" aria-hidden />
    case 'disponible':
      return <Circle size={18} className="pi-paso-icon pi-paso-icon--activo" aria-hidden />
    case 'atencion':
      return <AlertTriangle size={18} className="pi-paso-icon pi-paso-icon--warn" aria-hidden />
    default:
      return <Lock size={18} className="pi-paso-icon pi-paso-icon--lock" aria-hidden />
  }
}

function etiquetaEstado(estado: PasoEstadoInscripcion): string {
  switch (estado) {
    case 'completado':
      return 'Completado'
    case 'disponible':
      return 'Disponible'
    case 'atencion':
      return 'Pendiente'
    default:
      return 'Bloqueado'
  }
}

function ProgresoInscripcion({
  pct,
  completados,
  totales,
}: {
  pct: number
  completados: number
  totales: number
}) {
  return (
    <section className="portal-inscripciones-progreso" aria-label="Progreso general">
      <div
        className="portal-inscripciones-progreso-ring"
        style={{ '--pi-pct': pct } as CSSProperties}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="portal-inscripciones-progreso-ring-inner">
          <span className="portal-inscripciones-progreso-pct">{pct}%</span>
          <span className="portal-inscripciones-progreso-sublabel">Progreso</span>
        </div>
      </div>
      <div className="portal-inscripciones-progreso-meta">
        <div className="portal-inscripciones-progreso-bar" aria-hidden>
          <div className="portal-inscripciones-progreso-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="portal-inscripciones-progreso-hint">
          <strong>{completados}</strong> de <strong>{totales}</strong> pasos completados
        </p>
      </div>
    </section>
  )
}

export default function PortalInscripcionesView() {
  const router = useRouter()
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [estado, setEstado] = useState<EstadoPortalInscripciones | null>(null)
  const [reglamentoVisto, setReglamentoVisto] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [matriz, setMatriz] = useState<MatrizPortalPagos | null>(null)
  const [cargandoMatriz, setCargandoMatriz] = useState(false)
  const [errorMatriz, setErrorMatriz] = useState<string | null>(null)
  const colegiaturasRef = useRef<HTMLElement>(null)

  const cargar = useCallback(async () => {
    if (alumnoId == null) {
      setError('Sesión de alumno no válida.')
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/portal-inscripciones/estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setEstado(null)
        setError(data.error ?? 'No se pudo cargar el portal de inscripciones.')
      } else {
        const siguiente = data.estado as EstadoPortalInscripciones
        setEstado(siguiente)
        const cicloValor = Number(siguiente.ciclo?.valor ?? 0)
        setReglamentoVisto(
          cicloValor > 0 ? leerReglamentoVisto(alumnoId, cicloValor) : false
        )
      }
    } catch {
      setEstado(null)
      setError('Error de conexión al cargar inscripciones.')
    }
    setCargando(false)
  }, [alumnoId])

  const cargarMatriz = useCallback(async () => {
    if (alumnoId == null) return
    setCargandoMatriz(true)
    setErrorMatriz(null)
    try {
      const res = await fetch('/api/portal-pagos/matriz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMatriz(null)
        setErrorMatriz(data.error ?? 'No se pudieron cargar las colegiaturas.')
      } else {
        setMatriz(data.matriz)
      }
    } catch {
      setMatriz(null)
      setErrorMatriz('Error de conexión al cargar colegiaturas.')
    }
    setCargandoMatriz(false)
  }, [alumnoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const pagoInscripcionPaso = estado?.pasos.find((p) => p.id === 'pago-inscripcion') ?? null
  const inscripcionPagada = pagoInscripcionPaso?.estado === 'completado'
  const esReinscrito = estado?.formaIngreso === 0
  // Reinscritos ya cursan el ciclo vigente: sus colegiaturas actuales no dependen de la
  // reinscripción del ciclo siguiente. El candado de "concepto 00" aplica a nuevo ingreso.
  const colegiaturasDesbloqueadas = Boolean(
    estado && !estado.bloqueo && (esReinscrito || inscripcionPagada)
  )

  useEffect(() => {
    if (colegiaturasDesbloqueadas) void cargarMatriz()
  }, [colegiaturasDesbloqueadas, cargarMatriz])

  const estadoVista = useMemo(() => {
    if (!estado) return null
    return aplicarReglamentoVistoEnEstado(estado, reglamentoVisto)
  }, [estado, reglamentoVisto])

  const marcarReglamentoConsultado = useCallback(() => {
    if (alumnoId == null || !estado?.ciclo?.valor) return
    marcarReglamentoVisto(alumnoId, Number(estado.ciclo.valor))
    setReglamentoVisto(true)
  }, [alumnoId, estado?.ciclo?.valor])

  const refFmt = String(session?.alumno_ref ?? '').padStart(5, '0')

  return (
    <div className="dashboard-container dashboard-home portal-inscripciones-page">
      <div className="dashboard-home-bg" aria-hidden />
      <div className="dashboard-main portal-inscripciones-main">
        <header className="portal-inscripciones-encabezado">
          <button
            type="button"
            className="servicios-back-btn"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft size={16} aria-hidden />
            Volver al inicio
          </button>

          <div className="portal-inscripciones-encabezado-grid">
            <div>
              <p className="portal-inscripciones-kicker">Proceso escolar</p>
              <h1 className="dashboard-title portal-inscripciones-titulo">
                Inscripciones y Colegiaturas
              </h1>
              <p className="dashboard-subtitle portal-inscripciones-lead">
                {esReinscrito
                  ? 'Reinscribe a tu hijo(a) y mantén al día el pago de sus colegiaturas.'
                  : estadoVista
                    ? 'Completa la inscripción de tu hijo(a) y continúa con el pago de sus colegiaturas.'
                    : 'Completa tu inscripción o reinscripción y continúa con el pago de colegiaturas.'}
              </p>
            </div>
            {estadoVista?.ciclo && (
              <div className="portal-inscripciones-ciclo-badge" aria-label="Ciclo escolar vigente">
                <span className="portal-inscripciones-ciclo-label">Ciclo vigente</span>
                <span className="portal-inscripciones-ciclo-nombre">{estadoVista.ciclo.nombre}</span>
              </div>
            )}
          </div>

          {estadoVista && (
            <div className="portal-inscripciones-hero">
              <div className="portal-inscripciones-alumno-card">
                <div className="portal-inscripciones-alumno-info">
                  <span className="portal-inscripciones-alumno-nombre">
                    {nombreAlumno(estadoVista, session?.displayName)}
                  </span>
                  <span className="portal-inscripciones-alumno-meta">
                    No. {refFmt} · {estadoVista.gradoEtiqueta} · {estadoVista.formaIngresoEtiqueta}
                  </span>
                </div>
                <button
                  type="button"
                  className="portal-inscripciones-btn-sec"
                  onClick={() => void cargar()}
                  disabled={cargando}
                  aria-label="Actualizar estado"
                >
                  <RefreshCw size={16} className={cargando ? 'portal-inscripciones-spin' : ''} />
                  Actualizar
                </button>
              </div>
              <ProgresoInscripcion
                pct={estadoVista.progresoPct}
                completados={estadoVista.pasosCompletados}
                totales={estadoVista.pasosTotales}
              />
            </div>
          )}
        </header>

        {cargando && !estadoVista && (
          <div className="portal-inscripciones-estado" role="status">
            <RefreshCw size={20} className="portal-inscripciones-spin" aria-hidden />
            Cargando tu proceso de inscripción…
          </div>
        )}

        {error && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--error" role="alert">
            {error}
          </div>
        )}

        {estadoVista?.bloqueo && estadoVista.mensajeBloqueo && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--bloqueo" role="alert">
            <AlertTriangle size={18} aria-hidden />
            {estadoVista.mensajeBloqueo}
          </div>
        )}

        {estadoVista?.aviso && !estadoVista.bloqueo && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--aviso" role="status">
            <Clock size={18} aria-hidden />
            {estadoVista.aviso}
          </div>
        )}

        {estadoVista && (
          <>
            <ol className="portal-inscripciones-pasos">
              {estadoVista.pasos.map((paso) => (
                <li
                  key={paso.id}
                  className={`portal-inscripciones-paso portal-inscripciones-paso--${paso.estado}`}
                >
                  <div
                    className="portal-inscripciones-paso-indice"
                    aria-hidden
                  >
                    <span className="portal-inscripciones-paso-numero">
                      {String(paso.orden).padStart(2, '0')}
                    </span>
                    <span className="portal-inscripciones-paso-indice-icono">
                      {iconoPaso(paso.estado)}
                    </span>
                  </div>
                  <div className="portal-inscripciones-paso-cuerpo">
                    <div className="portal-inscripciones-paso-cabecera">
                      <h2 className="portal-inscripciones-paso-titulo">{paso.titulo}</h2>
                      <span
                        className={`portal-inscripciones-paso-badge portal-inscripciones-paso-badge--${paso.estado}`}
                      >
                        {etiquetaEstado(paso.estado)}
                      </span>
                    </div>
                    <p className="portal-inscripciones-paso-desc">{paso.descripcion}</p>
                    {paso.detalle && (
                      <p className="portal-inscripciones-paso-detalle">{paso.detalle}</p>
                    )}
                    {paso.accion && (
                      <div className="portal-inscripciones-paso-accion">
                        {paso.accion.tipo === 'proximo' ? (
                          <button
                            type="button"
                            className="portal-inscripciones-paso-link portal-inscripciones-paso-link--proximo"
                            disabled
                            aria-disabled="true"
                            title="Disponible próximamente"
                          >
                            {paso.accion.etiqueta}
                            <span className="portal-inscripciones-paso-proximo-tag">
                              Próximamente
                            </span>
                          </button>
                        ) : paso.accion.tipo === 'ruta-interna' ? (
                          <Link href={paso.accion.href} className="portal-inscripciones-paso-link">
                            {paso.accion.etiqueta}
                            <ArrowRight size={16} aria-hidden />
                          </Link>
                        ) : (
                          <a
                            href={paso.accion.href}
                            className="portal-inscripciones-paso-link"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={
                              paso.id === 'reglamento'
                                ? () => marcarReglamentoConsultado()
                                : undefined
                            }
                          >
                            {paso.accion.etiqueta}
                            <ArrowRight size={16} aria-hidden />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {!estadoVista.bloqueo && (
              <section
                ref={colegiaturasRef}
                id="colegiaturas"
                className="portal-inscripciones-colegiaturas-seccion"
                aria-label="Colegiaturas del ciclo"
              >
                <div className="portal-inscripciones-colegiaturas-head">
                  <div>
                    <h2 className="portal-inscripciones-colegiaturas-titulo">
                      Colegiaturas del ciclo
                    </h2>
                    <p className="portal-inscripciones-colegiaturas-sub">
                      Cuota de inicio de curso (concepto 00), mensualidades, Cambridge y Winston
                      USA.
                    </p>
                  </div>
                  {colegiaturasDesbloqueadas && matriz?.planEtiqueta && (
                    <span className="portal-inscripciones-plan-badge">{matriz.planEtiqueta}</span>
                  )}
                </div>

                {!colegiaturasDesbloqueadas ? (
                  <div className="portal-inscripciones-colegiaturas-bloqueo" role="note">
                    <Lock size={20} aria-hidden />
                    <div>
                      <p className="portal-inscripciones-colegiaturas-bloqueo-titulo">
                        Colegiaturas bloqueadas
                      </p>
                      <p className="portal-inscripciones-colegiaturas-bloqueo-desc">
                        Completa tu {esReinscrito ? 'reinscripción' : 'inscripción'} y su pago para
                        desbloquear la <strong>cuota de inicio de curso (concepto 00)</strong> y las
                        mensualidades del ciclo.
                      </p>
                    </div>
                  </div>
                ) : cargandoMatriz && !matriz ? (
                  <div className="portal-inscripciones-estado" role="status">
                    <RefreshCw size={20} className="portal-inscripciones-spin" aria-hidden />
                    Cargando colegiaturas del ciclo…
                  </div>
                ) : errorMatriz ? (
                  <div
                    className="portal-inscripciones-alerta portal-inscripciones-alerta--error"
                    role="alert"
                  >
                    {errorMatriz}
                  </div>
                ) : matriz ? (
                  <PortalColegiaturasSecciones
                    alumnoId={matriz.alumno.alumno_id}
                    ciclo={matriz.ciclo}
                    alumno={matriz.alumno}
                    secciones={matriz.secciones}
                    displayName={session?.displayName}
                    cargando={cargandoMatriz}
                    onActualizar={() => void cargarMatriz()}
                  />
                ) : null}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
