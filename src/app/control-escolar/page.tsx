'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  Sparkles,
  UserRound,
} from 'lucide-react'
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

export default function ControlEscolarPage() {
  return (
    <ProtectedRoute roles={['usuario']}>
      <CicloEscolarProvider>
        <ControlEscolarView />
      </CicloEscolarProvider>
    </ProtectedRoute>
  )
}

function ControlEscolarView() {
  const router = useRouter()
  const { user, session } = useAuth()
  const usuarioNombre =
    user?.usuario_nombre_completo?.trim() ||
    user?.usuario_username?.trim() ||
    session?.usuario_username?.trim() ||
    ''

  const [alumno, setAlumno] = useState<AlumnoBusquedaResultado | null>(null)
  const [docsCompleta, setDocsCompleta] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<{
    tipo: 'ok' | 'warn' | 'err'
    texto: string
  } | null>(null)

  const status = parseEstatusAlumno(alumno?.alumno_status)
  const puedeGuardar = !!alumno && docsCompleta && !procesando

  const onSeleccionar = useCallback((a: AlumnoBusquedaResultado | null) => {
    setAlumno(a)
    setDocsCompleta(false)
    setMensaje(null)
  }, [])

  async function guardarAutorizacion() {
    if (!alumno || !puedeGuardar) return
    if (!usuarioNombre) {
      setMensaje({
        tipo: 'err',
        texto: 'No se pudo identificar al usuario de sesión. Vuelve a entrar desde el dashboard.',
      })
      return
    }

    setProcesando(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/control-escolar/autorizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoRef: alumno.alumno_ref,
          autorizadoPor: usuarioNombre,
          documentacionCompleta: docsCompleta,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        correoEnviado?: boolean
        yaExistia?: boolean
      }

      if (!data.ok) {
        setMensaje({
          tipo: 'err',
          texto: data.message ?? 'No se pudo guardar la autorización',
        })
        return
      }

      if (data.yaExistia) {
        setMensaje({
          tipo: 'warn',
          texto: data.message ?? 'La documentación ya estaba autorizada.',
        })
      } else if (data.correoEnviado === false) {
        setMensaje({
          tipo: 'warn',
          texto:
            data.message ??
            'Registro guardado, pero hubo un problema al enviar el correo.',
        })
      } else {
        setMensaje({
          tipo: 'ok',
          texto:
            data.message ??
            'Documentación autorizada. El alumno ya puede generar el recibo final.',
        })
      }
      setDocsCompleta(false)
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
    <div className="dashboard-container ce-page">
      <div className="dashboard-main">
        <div className="dashboard-heading ce-heading">
          <button
            type="button"
            className="servicios-back-btn"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft size={16} aria-hidden />
            Volver al inicio
          </button>
          <div className="ce-heading-row">
            <span className="ce-heading-icon" aria-hidden>
              <FileCheck2 size={22} />
            </span>
            <div>
              <h1 className="dashboard-title">Control Escolar</h1>
              <p className="dashboard-subtitle">
                Autoriza la documentación completa de nuevo ingreso y libera el
                recibo final.
              </p>
            </div>
          </div>
        </div>

        <div className="ce-panel">
          <div className="ce-usuario">
            <span className="ce-usuario-icon" aria-hidden>
              <UserRound size={16} />
            </span>
            <div className="ce-usuario-text">
              <span className="ce-usuario-label">Sesión</span>
              <span className="ce-usuario-name">{usuarioNombre || '—'}</span>
            </div>
          </div>

          <div className="ce-search">
            <AlumnoAutocomplete
              etiqueta="Usuario (No. Control / referencia)"
              alumnoSeleccionado={alumno}
              onSeleccionar={onSeleccionar}
              autoFocus
            />
          </div>

          {detalleAlumno && (
            <div className="ce-detalle">
              <div className="ce-detalle-item">
                <span className="ce-detalle-label">Referencia</span>
                <strong className="ce-detalle-value">{detalleAlumno.ref}</strong>
              </div>
              <div className="ce-detalle-item">
                <span className="ce-detalle-label">Nivel / grado</span>
                <strong className="ce-detalle-value">
                  {detalleAlumno.nivel} · {detalleAlumno.grado} · Grupo{' '}
                  {detalleAlumno.grupo}
                </strong>
              </div>
              <div className="ce-detalle-item">
                <span className="ce-detalle-label">Estatus</span>
                <strong className="ce-detalle-value ce-detalle-value--status">
                  {detalleAlumno.estatus}
                </strong>
              </div>
            </div>
          )}

          {status === 0 && alumno && (
            <p className="ce-hint ce-hint--warn">
              Este alumno figura con baja general; revisa antes de autorizar.
            </p>
          )}

          <label
            className={`ce-check ${docsCompleta ? 'ce-check--on' : ''} ${!alumno ? 'ce-check--disabled' : ''}`}
          >
            <input
              type="checkbox"
              checked={docsCompleta}
              disabled={!alumno || procesando}
              onChange={(e) => {
                setDocsCompleta(e.target.checked)
                setMensaje(null)
              }}
            />
            <span className="ce-check-body">
              <span className="ce-check-title">
                <ClipboardCheck size={18} aria-hidden />
                Documentación completa
              </span>
              <span className="ce-check-hint">
                Marca cuando el alumno entregó todo el expediente. Sin esta
                autorización no se genera el recibo final, aunque ya haya
                cargado los PDF en el portal.
              </span>
            </span>
          </label>

          <div className="ce-actions">
            <button
              type="button"
              className="ce-btn"
              disabled={!puedeGuardar}
              onClick={() => void guardarAutorizacion()}
            >
              {procesando ? (
                <>
                  <Loader2 size={18} className="ce-spin" aria-hidden />
                  Guardando…
                </>
              ) : (
                <>
                  <Sparkles size={18} aria-hidden />
                  Guardar y autorizar
                </>
              )}
            </button>
          </div>

          {mensaje && (
            <p className={`ce-msg ce-msg--${mensaje.tipo}`} role="status">
              {mensaje.texto}
            </p>
          )}

          <p className="ce-hint">
            Queda registrado quién autorizó (tu sesión), la fecha y la hora. Al
            guardar se envía el correo de bienvenida a mamá/papá desde el buzón
            de envíos masivos.
          </p>
        </div>
      </div>
    </div>
  )
}
