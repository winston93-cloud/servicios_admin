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
  CreditCard,
  FileSignature,
  Lock,
  PartyPopper,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import type { EstadoPortalInscripciones, PasoEstadoInscripcion } from '@/lib/portalInscripcionesTypes'
import type { MatrizPortalPagos } from '@/lib/portalPagosMatrizService'
import { formatearMontoPortal } from '@/lib/portalPagosService'
import PortalColegiaturasSecciones from '@/app/portal-pagos/components/PortalColegiaturasSecciones'

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** Convierte "YYYY-MM-DD" a "3 de julio de 2026" sin depender de la zona horaria. */
function formatearFechaLarga(iso: string | null | undefined): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const anio = Number(m[1])
  const mes = Number(m[2]) - 1
  const dia = Number(m[3])
  if (mes < 0 || mes > 11) return null
  return `${dia} de ${MESES_ES[mes]} de ${anio}`
}

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
        <div
          className="portal-inscripciones-progreso-bar"
          aria-hidden
        >
          <div className="portal-inscripciones-progreso-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="portal-inscripciones-progreso-hint">
          <strong>{completados}</strong> de <strong>{totales}</strong> pasos completados
        </p>
      </div>
    </section>
  )
}

type SiguientePasoTono = 'accion' | 'exito' | 'espera'
type SiguientePasoIcono = 'solicitud' | 'pago' | 'exito' | 'espera'

interface SiguientePasoInfo {
  tono: SiguientePasoTono
  icono: SiguientePasoIcono
  titulo: string
  descripcion: string
  monto?: number | null
  fechaLimite?: string | null
  cta?: { etiqueta: string; tipo: 'ruta' | 'scroll'; href?: string }
}

function iconoSiguientePaso(icono: SiguientePasoIcono) {
  switch (icono) {
    case 'solicitud':
      return <FileSignature size={26} aria-hidden />
    case 'pago':
      return <CreditCard size={26} aria-hidden />
    case 'exito':
      return <PartyPopper size={26} aria-hidden />
    default:
      return <Clock size={26} aria-hidden />
  }
}

export default function PortalInscripcionesView() {
  const router = useRouter()
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [estado, setEstado] = useState<EstadoPortalInscripciones | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [matriz, setMatriz] = useState<MatrizPortalPagos | null>(null)
  const [cargandoMatriz, setCargandoMatriz] = useState(false)
  const [errorMatriz, setErrorMatriz] = useState<string | null>(null)

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
        setEstado(data.estado)
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

  const colegiaturasRef = useRef<HTMLElement>(null)

  const irAColegiaturas = useCallback(() => {
    colegiaturasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const colegiaturaPendiente = useMemo(() => {
    const seccion = matriz?.secciones.find((s) => s.id === 'colegiatura')
    return seccion?.filas.find((f) => !f.pagado) ?? null
  }, [matriz])

  const siguientePaso = useMemo<SiguientePasoInfo | null>(() => {
    if (!estado || estado.bloqueo) return null

    const paso = (id: string) => estado.pasos.find((p) => p.id === id) ?? null
    const solicitud = paso('solicitud')

    if (solicitud && solicitud.estado !== 'completado') {
      return {
        tono: 'accion',
        icono: 'solicitud',
        titulo: 'Completa la solicitud de inscripción',
        descripcion:
          'Captura los datos del alumno y de la familia. Al terminar se habilita el pago.',
        cta: {
          etiqueta: 'Completar solicitud',
          tipo: 'ruta',
          href: '/portal-inscripciones/solicitud',
        },
      }
    }

    if (!inscripcionPagada) {
      return {
        tono: 'accion',
        icono: 'pago',
        titulo: esReinscrito ? 'Realiza el pago de reinscripción' : 'Realiza el pago de inscripción',
        descripcion:
          'Paga en ventanilla (baucher), con tarjeta (comercio electrónico) o por transferencia SPEI.',
        monto: estado.montoInscripcion,
        fechaLimite: esReinscrito ? estado.reinscripcion?.fechaLimite ?? null : null,
        cta: {
          etiqueta: esReinscrito ? 'Pagar reinscripción' : 'Pagar inscripción',
          tipo: 'ruta',
          href: '/portal-inscripciones/pago',
        },
      }
    }

    if (cargandoMatriz && !matriz) {
      return {
        tono: 'espera',
        icono: 'espera',
        titulo: 'Preparando tus colegiaturas…',
        descripcion: 'Estamos cargando los conceptos del ciclo escolar.',
      }
    }

    if (colegiaturaPendiente) {
      const esInicio = colegiaturaPendiente.conceptoNo === '00'
      return {
        tono: 'accion',
        icono: 'pago',
        titulo: esInicio
          ? 'Paga la cuota de inicio de curso'
          : `Paga: ${colegiaturaPendiente.conceptoClase}`,
        descripcion: esInicio
          ? 'Con este pago se activa el ciclo y se habilitan las mensualidades.'
          : 'Mantén al día las colegiaturas de tu hijo(a).',
        monto: colegiaturaPendiente.importe,
        cta: { etiqueta: 'Ir a colegiaturas', tipo: 'scroll' },
      }
    }

    return {
      tono: 'exito',
      icono: 'exito',
      titulo: '¡Estás al corriente!',
      descripcion: 'No tienes pagos pendientes por ahora. Gracias por tu puntualidad.',
    }
  }, [estado, inscripcionPagada, esReinscrito, cargandoMatriz, matriz, colegiaturaPendiente])

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
                  : estado
                    ? 'Completa la inscripción de tu hijo(a) y continúa con el pago de sus colegiaturas.'
                    : 'Completa tu inscripción o reinscripción y continúa con el pago de colegiaturas.'}
              </p>
            </div>
            {estado?.ciclo && (
              <div className="portal-inscripciones-ciclo-badge" aria-label="Ciclo escolar vigente">
                <span className="portal-inscripciones-ciclo-label">Ciclo vigente</span>
                <span className="portal-inscripciones-ciclo-nombre">{estado.ciclo.nombre}</span>
              </div>
            )}
          </div>

          {estado && (
            <div className="portal-inscripciones-hero">
              <div className="portal-inscripciones-alumno-card">
                <div className="portal-inscripciones-alumno-info">
                  <span className="portal-inscripciones-alumno-nombre">
                    {nombreAlumno(estado, session?.displayName)}
                  </span>
                  <span className="portal-inscripciones-alumno-meta">
                    No. {refFmt} · {estado.gradoEtiqueta} · {estado.formaIngresoEtiqueta}
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
                pct={estado.progresoPct}
                completados={estado.pasosCompletados}
                totales={estado.pasosTotales}
              />
            </div>
          )}
        </header>

        {siguientePaso && (
          <section
            className={`portal-inscripciones-siguiente portal-inscripciones-siguiente--${siguientePaso.tono}`}
            aria-label="Tu siguiente paso"
          >
            <div className="portal-inscripciones-siguiente-icono">
              {iconoSiguientePaso(siguientePaso.icono)}
            </div>
            <div className="portal-inscripciones-siguiente-cuerpo">
              <p className="portal-inscripciones-siguiente-kicker">Tu siguiente paso</p>
              <h2 className="portal-inscripciones-siguiente-titulo">{siguientePaso.titulo}</h2>
              <p className="portal-inscripciones-siguiente-desc">{siguientePaso.descripcion}</p>
              {(siguientePaso.monto != null || siguientePaso.fechaLimite) && (
                <div className="portal-inscripciones-siguiente-meta">
                  {siguientePaso.monto != null && (
                    <span className="portal-inscripciones-siguiente-monto">
                      {formatearMontoPortal(siguientePaso.monto)}
                    </span>
                  )}
                  {siguientePaso.fechaLimite && formatearFechaLarga(siguientePaso.fechaLimite) && (
                    <span className="portal-inscripciones-siguiente-limite">
                      <Clock size={14} aria-hidden />
                      Fecha límite: {formatearFechaLarga(siguientePaso.fechaLimite)}
                    </span>
                  )}
                </div>
              )}
            </div>
            {siguientePaso.cta &&
              (siguientePaso.cta.tipo === 'ruta' && siguientePaso.cta.href ? (
                <Link href={siguientePaso.cta.href} className="portal-inscripciones-siguiente-cta">
                  {siguientePaso.cta.etiqueta}
                  <ArrowRight size={18} aria-hidden />
                </Link>
              ) : (
                <button
                  type="button"
                  className="portal-inscripciones-siguiente-cta"
                  onClick={irAColegiaturas}
                >
                  {siguientePaso.cta.etiqueta}
                  <ArrowRight size={18} aria-hidden />
                </button>
              ))}
          </section>
        )}

        {cargando && !estado && (
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

        {estado?.bloqueo && estado.mensajeBloqueo && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--bloqueo" role="alert">
            <AlertTriangle size={18} aria-hidden />
            {estado.mensajeBloqueo}
          </div>
        )}

        {estado?.aviso && !estado.bloqueo && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--aviso" role="status">
            <Clock size={18} aria-hidden />
            {estado.aviso}
          </div>
        )}

        {estado && (
          <>
            <ol className="portal-inscripciones-pasos">
              {estado.pasos.map((paso) => (
                <li
                  key={paso.id}
                  className={`portal-inscripciones-paso portal-inscripciones-paso--${paso.estado}`}
                >
                  <div className="portal-inscripciones-paso-indice" aria-hidden>
                    {String(paso.orden).padStart(2, '0')}
                  </div>
                  <div className="portal-inscripciones-paso-icono">{iconoPaso(paso.estado)}</div>
                  <div className="portal-inscripciones-paso-cuerpo">
                    <div className="portal-inscripciones-paso-cabecera">
                      <h2 className="portal-inscripciones-paso-titulo">{paso.titulo}</h2>
                      <span className={`portal-inscripciones-paso-badge portal-inscripciones-paso-badge--${paso.estado}`}>
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
                            <span className="portal-inscripciones-paso-proximo-tag">Próximamente</span>
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

            {!estado.bloqueo && (
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
                      Cuota de inicio de curso (concepto 00), mensualidades, Cambridge y Winston USA.
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
