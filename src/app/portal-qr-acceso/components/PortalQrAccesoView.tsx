'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarPlus,
  Expand,
  FileDown,
  ImageDown,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  esStaffPreviewPanelPadres,
  PORTAL_AUTORIZADOS_PREVIEW_REFS,
  puedeVerModuloPortalAutorizados,
} from '@/lib/portalPadresPreview'
import { dataTemaPadres, PortalPadresTopbar } from '@/components/portal/PortalPadresTopbar'
import { useDashTema } from '@/components/dashboard/DashboardTemas'
import { dibujarQrAccesoEnCanvas } from '@/lib/qrAccesoCanvas'
import { hojaQrAccesoPdf, qrAccesoPngDataUrl } from '@/lib/qrAccesoHoja'

type AlumnoQr = {
  alumnoId: number
  alumnoRef: number
  nombre: string
  nivel: string
  grado: string
  grupo: string
}

/** Tamaño moderado para compartir / pegar (WhatsApp, correo, etc.). */
const QR_DESCARGA_IMAGEN_PX = 400

export default function PortalQrAccesoView() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { session } = useAuth()
  const [tema] = useDashTema()
  const esStaff = esStaffPreviewPanelPadres(session)
  const permitido = puedeVerModuloPortalAutorizados(session)
  const [codigo, setCodigo] = useState<string | null>(null)
  const [alumno, setAlumno] = useState<AlumnoQr | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [accionHoja, setAccionHoja] = useState<'imagen' | 'pdf' | null>(null)

  const cargar = useCallback(async (alumnoRef?: string) => {
    setCargando(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (alumnoRef) params.set('alumnoRef', alumnoRef)
      const res = await fetch(`/api/portal-qr-acceso?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el QR.')
      setCodigo(String(data.codigo ?? ''))
      setAlumno(data.alumno ?? null)
    } catch (e) {
      setCodigo(null)
      setAlumno(null)
      setError(e instanceof Error ? e.message : 'No se pudo cargar el QR.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!permitido) {
      router.replace('/dashboard')
      return
    }
    void cargar(esStaff ? String(PORTAL_AUTORIZADOS_PREVIEW_REFS[0] ?? '') : undefined)
    // Solo al entrar: el staff puede cambiar de ficha con el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permitido, esStaff, cargar, router])

  useEffect(() => {
    if (!codigo || !canvasRef.current) return
    let cancelado = false
    const destino = canvasRef.current
    const offscreen = document.createElement('canvas')
    void dibujarQrAccesoEnCanvas(offscreen, codigo)
      .then(() => {
        if (cancelado || !canvasRef.current) return
        destino.width = offscreen.width
        destino.height = offscreen.height
        const ctx = destino.getContext('2d')
        if (ctx) ctx.drawImage(offscreen, 0, 0)
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo dibujar el QR.')
      })
    return () => {
      cancelado = true
    }
  }, [codigo])

  useEffect(() => {
    if (!pantallaCompleta) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPantallaCompleta(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [pantallaCompleta])

  const descargarImagen = useCallback(async () => {
    if (!codigo || !alumno) return
    setAccionHoja('imagen')
    setError(null)
    try {
      const dataUrl = await qrAccesoPngDataUrl(codigo, QR_DESCARGA_IMAGEN_PX)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `qr-acceso-${alumno.alumnoRef}.png`
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar la imagen.')
    } finally {
      setAccionHoja(null)
    }
  }, [alumno, codigo])

  const descargarPdf = useCallback(async () => {
    if (!codigo || !alumno) return
    setAccionHoja('pdf')
    setError(null)
    try {
      const pdf = await hojaQrAccesoPdf(codigo)
      pdf.save(`qr-acceso-${alumno.alumnoRef}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar el PDF.')
    } finally {
      setAccionHoja(null)
    }
  }, [alumno, codigo])

  const volverDashboard = esStaff ? '/dashboard?vista=padres' : '/dashboard'
  const meta = [alumno?.nivel, alumno?.grado, alumno?.grupo ? `Grupo ${alumno.grupo}` : '']
    .filter(Boolean)
    .join(' · ')
  const ocupadoHoja = accionHoja !== null

  return (
    <div
      className="dashboard-container dashboard-home dashboard-home--papas portal-inscripciones-page portal-autorizados-page portal-qr-acceso-page portal-padres-mod"
      data-tema={dataTemaPadres(tema)}
    >
      <div className="dashboard-home-bg" aria-hidden />
      <div className="dashboard-main portal-inscripciones-main">
        <header className="portal-padres-encabezado">
          <PortalPadresTopbar volver={volverDashboard} />
          <p className="portal-inscripciones-kicker">Acceso al plantel</p>
          <h1 className="dashboard-title portal-inscripciones-titulo">QR de acceso</h1>
          <p className="portal-padres-lead">
            Muestra o descarga el código para entrar al plantel. Si alguien más recoge al alumno
            solo un día, registra el permiso especial.
          </p>
          <nav className="portal-padres-modulos" aria-label="Atajos relacionados">
            <span className="portal-padres-modulo is-on" aria-current="page">
              QR de acceso
            </span>
            <Link href="/portal-autorizados#permiso-especial" className="portal-padres-modulo">
              <CalendarPlus size={16} aria-hidden />
              Permiso especial por un día
            </Link>
          </nav>
        </header>

        {cargando && !codigo ? (
          <div className="portal-padres-cargando" role="status">
            <RefreshCw size={20} className="portal-inscripciones-spin" aria-hidden />
            Generando tu código de acceso…
          </div>
        ) : null}

        {error ? (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--error" role="alert">
            {error}
          </div>
        ) : null}

        {codigo && alumno ? (
          <section className="portal-qr-acceso-card" aria-label="Código QR de acceso">
            <div
              className={
                pantallaCompleta
                  ? 'portal-qr-acceso-fullscreen'
                  : 'portal-qr-acceso-placa-wrap'
              }
              role={pantallaCompleta ? 'dialog' : undefined}
              aria-modal={pantallaCompleta ? true : undefined}
              aria-label={pantallaCompleta ? 'QR de acceso a pantalla completa' : undefined}
              onClick={pantallaCompleta ? () => setPantallaCompleta(false) : undefined}
            >
              {pantallaCompleta ? (
                <button
                  type="button"
                  className="portal-qr-acceso-fullscreen-cerrar"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPantallaCompleta(false)
                  }}
                >
                  <X size={20} aria-hidden />
                  Cerrar
                </button>
              ) : null}
              <div
                className="portal-qr-acceso-placa"
                onClick={pantallaCompleta ? (e) => e.stopPropagation() : undefined}
              >
                <canvas ref={canvasRef} width={320} height={320} aria-label="Código QR" />
              </div>
            </div>
            <div className="portal-qr-acceso-datos">
              <p className="portal-qr-acceso-nombre">{alumno.nombre}</p>
              <p className="portal-qr-acceso-meta">
                No. {alumno.alumnoRef}
                {meta ? ` · ${meta}` : ''}
              </p>
              <div className="portal-qr-acceso-acciones">
                <button
                  type="button"
                  className="portal-autorizados-btn-pri"
                  onClick={() => setPantallaCompleta(true)}
                >
                  <Expand size={16} aria-hidden />
                  Pantalla completa
                </button>
                <button
                  type="button"
                  className="portal-autorizados-btn-sec"
                  onClick={() => void descargarPdf()}
                  disabled={ocupadoHoja}
                >
                  {accionHoja === 'pdf' ? (
                    <Loader2 size={16} className="portal-inscripciones-spin" />
                  ) : (
                    <FileDown size={16} aria-hidden />
                  )}
                  Generar PDF
                </button>
                <button
                  type="button"
                  className="portal-autorizados-btn-sec"
                  onClick={() => void descargarImagen()}
                  disabled={ocupadoHoja}
                >
                  {accionHoja === 'imagen' ? (
                    <Loader2 size={16} className="portal-inscripciones-spin" />
                  ) : (
                    <ImageDown size={16} aria-hidden />
                  )}
                  Descargar imagen
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
