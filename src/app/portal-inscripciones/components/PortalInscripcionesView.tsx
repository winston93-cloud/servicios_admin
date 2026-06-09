'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
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

function nombreAlumno(estado: EstadoPortalInscripciones | null, fallback?: string): string {
  if (!estado) return fallback?.trim() || 'Alumno'
  const a = estado.alumno
  const n = `${a.alumno_nombre ?? ''} ${a.alumno_app ?? ''} ${a.alumno_apm ?? ''}`.trim()
  return n || fallback?.trim() || 'Alumno'
}

function iconoPaso(estado: PasoEstadoInscripcion) {
  switch (estado) {
    case 'completado':
      return <CheckCircle2 size={22} className="pi-paso-icon pi-paso-icon--ok" aria-hidden />
    case 'disponible':
      return <Circle size={22} className="pi-paso-icon pi-paso-icon--activo" aria-hidden />
    case 'atencion':
      return <AlertTriangle size={22} className="pi-paso-icon pi-paso-icon--warn" aria-hidden />
    default:
      return <Lock size={20} className="pi-paso-icon pi-paso-icon--lock" aria-hidden />
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

export default function PortalInscripcionesView() {
  const router = useRouter()
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [estado, setEstado] = useState<EstadoPortalInscripciones | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    void cargar()
  }, [cargar])

  const refFmt = String(session?.alumno_ref ?? '').padStart(5, '0')

  return (
    <div className="dashboard-container portal-inscripciones-page">
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
                Portal de inscripciones
              </h1>
              <p className="dashboard-subtitle portal-inscripciones-lead">
                Sigue tu trámite de inscripción o reinscripción paso a paso.
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
              {estado.pasos.map((paso, idx) => (
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
                        {paso.accion.tipo === 'ruta-interna' ? (
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
                  {idx < estado.pasos.length - 1 && (
                    <div className="portal-inscripciones-paso-conector" aria-hidden />
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  )
}
