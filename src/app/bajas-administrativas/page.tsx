'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, UserX } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { CicloEscolarProvider } from '@/contexts/CicloEscolarContext'
import { useAuth } from '@/contexts/AuthContext'
import AlumnoAutocomplete from '@/app/servicios/components/AlumnoAutocomplete'
import type { AlumnoBusquedaResultado } from '@/lib/alumnoBusquedaServicios'
import {
  etiquetaEstatusAlumno,
  parseEstatusAlumno,
} from '@/lib/alumnoStatus'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { grupoALetra } from '@/lib/alumnoBusquedaServicios'

export default function BajasAdministrativasPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <CicloEscolarProvider>
        <BajasAdministrativasView />
      </CicloEscolarProvider>
    </ProtectedRoute>
  )
}

function BajasAdministrativasView() {
  const router = useRouter()
  const { user, session } = useAuth()
  const usuarioNombre =
    user?.usuario_nombre_completo?.trim() ||
    user?.usuario_username?.trim() ||
    session?.usuario_username?.trim() ||
    ''

  const [alumno, setAlumno] = useState<AlumnoBusquedaResultado | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{
    tipo: 'ok' | 'warn' | 'err'
    texto: string
  } | null>(null)

  const status = parseEstatusAlumno(alumno?.alumno_status)
  const puedeBajar = !!alumno && status !== 0 && !procesando

  const onSeleccionar = useCallback((a: AlumnoBusquedaResultado | null) => {
    setAlumno(a)
    setMensaje(null)
  }, [])

  async function procesarBaja() {
    if (!alumno || !puedeBajar) return
    if (!usuarioNombre) {
      setMensaje({
        tipo: 'err',
        texto: 'No se pudo identificar al usuario de sesión. Vuelve a entrar desde el dashboard.',
      })
      return
    }

    const nombre = alumno.nombre_completo || alumno.alumno_ref
    if (
      !window.confirm(
        `¿Está seguro de dar de baja general a «${nombre}» (ref. ${alumno.alumno_ref})?`
      )
    ) {
      return
    }

    setProcesando(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/bajas-administrativas/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoRef: alumno.alumno_ref,
          realizadoPor: usuarioNombre,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        correoEnviado?: boolean
      }

      if (!data.ok) {
        setMensaje({
          tipo: 'err',
          texto: data.message ?? 'No se pudo procesar la baja',
        })
        return
      }

      if (data.correoEnviado) {
        setMensaje({
          tipo: 'ok',
          texto:
            data.message ??
            'Baja procesada correctamente y correo de notificación enviado.',
        })
      } else {
        setMensaje({
          tipo: 'warn',
          texto:
            data.message ??
            'Baja procesada, pero hubo un problema al enviar el correo.',
        })
      }
      setAlumno(null)
    } catch (e) {
      setMensaje({
        tipo: 'err',
        texto: e instanceof Error ? e.message : 'Error de conexión',
      })
    } finally {
      setProcesando(false)
    }
  }

  const detalleAlumno = alumno
    ? {
        ref: String(alumno.alumno_ref),
        nivel: etiquetaNivelEscolar(alumno.alumno_nivel) || '—',
        grado:
          etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado) || '—',
        grupo: grupoALetra(alumno.alumno_grupo) ?? '—',
        estatus: etiquetaEstatusAlumno(alumno.alumno_status),
      }
    : null

  return (
    <div className="dashboard-container">
      <div className="dashboard-main">
        <div className="dashboard-heading">
          <button
            type="button"
            className="servicios-back-btn"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft size={16} aria-hidden />
            Volver al inicio
          </button>
          <h1 className="dashboard-title">Bajas administrativas</h1>
          <p className="dashboard-subtitle">
            Baja general de alumnos y aviso por correo al equipo institucional.
          </p>
        </div>

        <div className="servicios-panel-card bajas-admin-card">
          <div className="bajas-admin-usuario-bar">
            <span className="bajas-admin-usuario-label">Usuario</span>
            <span className="bajas-admin-usuario-name">
              {usuarioNombre || '—'}
            </span>
          </div>

          <div className="bajas-admin-search">
            <AlumnoAutocomplete
              etiqueta="Buscar alumno"
              alumnoSeleccionado={alumno}
              onSeleccionar={onSeleccionar}
              autoFocus
            />
          </div>

          {detalleAlumno && (
            <div className="bajas-admin-detalle">
              <div>
                <span className="bajas-admin-detalle-label">Referencia</span>
                <strong>{detalleAlumno.ref}</strong>
              </div>
              <div>
                <span className="bajas-admin-detalle-label">Nivel / grado</span>
                <strong>
                  {detalleAlumno.nivel} · {detalleAlumno.grado} · Grupo{' '}
                  {detalleAlumno.grupo}
                </strong>
              </div>
              <div>
                <span className="bajas-admin-detalle-label">Estatus</span>
                <strong>{detalleAlumno.estatus}</strong>
              </div>
            </div>
          )}

          {status === 0 && alumno && (
            <p className="bajas-admin-hint bajas-admin-hint--warn">
              Este alumno ya tiene baja general; no se puede procesar de nuevo.
            </p>
          )}

          <div className="bajas-admin-actions">
            <button
              type="button"
              className="bajas-admin-btn"
              disabled={!puedeBajar}
              onClick={() => void procesarBaja()}
            >
              {procesando ? (
                <>
                  <Loader2 size={18} className="bajas-admin-spin" aria-hidden />
                  Procesando…
                </>
              ) : (
                <>
                  <UserX size={18} aria-hidden />
                  Baja general
                </>
              )}
            </button>
          </div>

          {mensaje && (
            <p
              className={`bajas-admin-msg bajas-admin-msg--${mensaje.tipo}`}
              role="status"
            >
              {mensaje.texto}
            </p>
          )}

          <p className="bajas-admin-hint">
            El aviso se envía desde el mismo buzón que los envíos masivos de
            Servicios.
          </p>
        </div>
      </div>
    </div>
  )
}
