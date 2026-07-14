'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Banknote, CreditCard, RefreshCw, Smartphone } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { nivelCobroElectronico } from '@/lib/nivelCobroElectronico'
import type { FilaMatrizPortal } from '@/lib/portalPagosMatrizService'
import type { VistaPagoInscripcionPortal } from '@/lib/portalInscripcionPagoService'
import { vigenciaBoucherPorDefecto } from '@/lib/boucherCore'
import PortalDocumentoModal, { type TipoDocumentoPortal } from '@/app/portal-pagos/components/PortalDocumentoModal'
import PortalBoucherModal from '@/app/portal-pagos/components/PortalBoucherModal'
import PortalTransferenciaModal, { type DatosTransferenciaPortal } from '@/app/portal-pagos/components/PortalTransferenciaModal'
import PortalSpeiReciboModal from '@/app/portal-pagos/components/PortalSpeiReciboModal'
import PortalPagosTablaSeccion from '@/app/portal-pagos/components/PortalPagosTablaSeccion'

function nombreCompletoAlumno(
  vista: VistaPagoInscripcionPortal | null,
  fallback?: string
): string {
  if (!vista) return fallback?.trim() || 'Alumno'
  const a = vista.alumno
  const n = `${a.alumno_nombre ?? ''} ${a.alumno_app ?? ''} ${a.alumno_apm ?? ''}`.trim()
  return n || fallback?.trim() || 'Alumno'
}

function nombreAlumnoTransferencia(
  vista: VistaPagoInscripcionPortal | null,
  fallback?: string
): string {
  if (!vista) return (fallback?.trim() || 'Alumno').toUpperCase()
  const a = vista.alumno
  const n = `${a.alumno_app ?? ''} ${a.alumno_apm ?? ''} ${a.alumno_nombre ?? ''}`.trim()
  return (n || fallback?.trim() || 'Alumno').toUpperCase()
}

export default function PortalInscripcionPagoView() {
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [vista, setVista] = useState<VistaPagoInscripcionPortal | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generandoBoucher, setGenerandoBoucher] = useState<string | null>(null)

  const [docModal, setDocModal] = useState<{
    abierto: boolean
    tipo: TipoDocumentoPortal
    url: string | null
    titulo: string
  }>({ abierto: false, tipo: 'pdf', url: null, titulo: '' })

  const [boucherModal, setBoucherModal] = useState<{
    abierto: boolean
    pdfUrl: string | null
    referencia: string | null
    concepto: string
  }>({ abierto: false, pdfUrl: null, referencia: null, concepto: '' })

  const [transferModal, setTransferModal] = useState<{
    abierto: boolean
    cargando: boolean
    datos: DatosTransferenciaPortal | null
  }>({ abierto: false, cargando: false, datos: null })

  const [speiModal, setSpeiModal] = useState<{
    abierto: boolean
    speiPdfUrl: string | null
    referenciaSpei: string | null
    concepto: string
  }>({ abierto: false, speiPdfUrl: null, referenciaSpei: null, concepto: '' })

  const cargar = useCallback(async () => {
    if (alumnoId == null) {
      setError('Sesión de alumno no válida.')
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/portal-inscripciones/pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setVista(null)
        setError(data.error ?? 'No se pudo cargar el pago de inscripción.')
      } else {
        setVista(data.vista)
      }
    } catch {
      setVista(null)
      setError('Error de conexión al cargar el pago.')
    }
    setCargando(false)
  }, [alumnoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const imprimirBoucher = async (fila: FilaMatrizPortal) => {
    if (!vista || alumnoId == null || fila.pagado) return
    setGenerandoBoucher(fila.conceptoNo)
    setError(null)
    try {
      const calcRes = await fetch('/api/bauchers/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId,
          conceptoNo: fila.conceptoNo,
          cicloEscolar: vista.ciclo.valor,
          // Reinscripción por diferidos: el importe ya viene calculado (Dif1/Dif2).
          importe: fila.importe ?? undefined,
        }),
      })
      const calc = await calcRes.json()
      if (!calcRes.ok) throw new Error(calc.error ?? 'No se pudo calcular la referencia.')

      const genRes = await fetch('/api/bauchers/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId,
          conceptoNo: fila.conceptoNo,
          conceptoClase: fila.conceptoClase,
          cicloEscolar: vista.ciclo.valor,
          vigencia: vigenciaBoucherPorDefecto(),
          importe: calc.importe,
          referencia: calc.referencia,
          nombreAlumno: nombreCompletoAlumno(vista, session?.displayName),
          aplicarRecargos: false,
          ignorarMesPago: false,
        }),
      })
      const gen = await genRes.json()
      if (!genRes.ok) throw new Error(gen.error ?? 'No se pudo generar el baucher.')

      setBoucherModal({
        abierto: true,
        pdfUrl: `data:application/pdf;base64,${gen.pdfBase64}`,
        referencia: gen.referencia,
        concepto: fila.conceptoClase,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar baucher.')
    }
    setGenerandoBoucher(null)
  }

  const abrirPagoEnLinea = async (fila: FilaMatrizPortal) => {
    if (!vista || alumnoId == null || fila.pagado) return
    setTransferModal({ abierto: true, cargando: true, datos: null })
    setError(null)
    try {
      let referencia =
        (fila.recargo ?? 0) > 0
          ? (fila.referenciaLinea ?? fila.referencia)
          : fila.referencia
      let importe =
        fila.importeLinea != null ? fila.importeLinea : (fila.importe ?? 0)
      if (!referencia) {
        const calcRes = await fetch('/api/bauchers/calcular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alumnoId,
            conceptoNo: fila.conceptoNo,
            cicloEscolar: vista.ciclo.valor,
            importe: fila.importe ?? undefined,
          }),
        })
        const calc = await calcRes.json()
        if (!calcRes.ok) throw new Error(calc.error ?? 'No se pudo calcular la referencia.')
        referencia = (calc.referenciaLinea ?? calc.referencia) as string
        importe = Number(calc.importeLinea ?? calc.importe)
      }
      if (!referencia) throw new Error('No se obtuvo referencia de pago.')
      setTransferModal({
        abierto: true,
        cargando: false,
        datos: {
          alumno: nombreAlumnoTransferencia(vista, session?.displayName),
          grado: vista.gradoEtiqueta,
          referenciaVentanilla: referencia,
          concepto: fila.conceptoClase,
          importe,
          alumnoId,
          conceptoNo: fila.conceptoNo,
          cicloEscolar: vista.ciclo.valor,
          alumnoNivel: nivelCobroElectronico(vista.alumno, fila.conceptoNo),
        },
      })
    } catch (e) {
      setTransferModal({ abierto: false, cargando: false, datos: null })
      setError(e instanceof Error ? e.message : 'No se pudo abrir el pago en línea.')
    }
  }

  const abrirDoc = (tipo: TipoDocumentoPortal, url: string, concepto: string) => {
    setDocModal({
      abierto: true,
      tipo,
      url,
      titulo: tipo === 'pdf' ? `Factura PDF — ${concepto}` : `Factura XML — ${concepto}`,
    })
  }

  const refFmt = String(session?.alumno_ref ?? '').padStart(5, '0')

  return (
    <div className="dashboard-container dashboard-home portal-inscripciones-page">
      <div className="dashboard-home-bg" aria-hidden />
      <div className="dashboard-main portal-inscripciones-main">
        <header className="portal-inscripciones-encabezado">
          <Link href="/portal-inscripciones" className="servicios-back-btn">
            <ArrowLeft size={16} aria-hidden />
            Volver al proceso
          </Link>

          <div className="portal-inscripciones-encabezado-grid">
            <div>
              <p className="portal-inscripciones-kicker">Paso 3 · Inscripciones</p>
              <h1 className="dashboard-title portal-inscripciones-titulo">
                {vista?.tituloPago ?? 'Pago de inscripción'}
              </h1>
              <p className="dashboard-subtitle portal-inscripciones-lead">
                <strong>{nombreCompletoAlumno(vista, session?.displayName)}</strong>
                {' · '}No. {refFmt}
                {vista?.gradoEtiqueta && ` · ${vista.gradoEtiqueta}`}
              </p>
            </div>
            {vista?.ciclo && (
              <div className="portal-inscripciones-ciclo-badge" role="status">
                <span className="portal-inscripciones-ciclo-label">Ciclo vigente</span>
                <span className="portal-inscripciones-ciclo-nombre">{vista.ciclo.nombre}</span>
              </div>
            )}
          </div>
        </header>

        <div className="pi-pago-metodos" role="note">
          <p className="pi-pago-metodos-titulo">Formas de pago disponibles</p>
          <ul className="pi-pago-metodos-lista">
            <li>
              <Banknote size={18} aria-hidden />
              <span>
                <strong>Efectivo en ventanilla</strong> — imprime el baucher y paga en sucursal bancaria.
              </span>
            </li>
            <li>
              <CreditCard size={18} aria-hidden />
              <span>
                <strong>Comercio electrónico</strong> — tarjeta de crédito o débito (Banorte).
              </span>
            </li>
            <li>
              <Smartphone size={18} aria-hidden />
              <span>
                <strong>SPEI</strong> — transferencia desde tu banca en línea (OpenPay).
              </span>
            </li>
          </ul>
        </div>

        {cargando && (
          <div className="portal-inscripciones-estado" role="status">
            <RefreshCw size={20} className="portal-inscripciones-spin" aria-hidden />
            Cargando opciones de pago…
          </div>
        )}

        {!cargando && error && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--error" role="alert">
            {error}
          </div>
        )}

        {!cargando && vista && !vista.solicitudCompleta && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--bloqueo" role="alert">
            Primero debes completar y guardar la solicitud de inscripción.
            <div style={{ marginTop: 12 }}>
              <Link href="/portal-inscripciones/solicitud" className="portal-inscripciones-paso-link">
                Ir al formulario de solicitud
              </Link>
            </div>
          </div>
        )}

        {!cargando && vista && vista.solicitudCompleta && vista.inscripcionPagada && (
          <div className="portal-inscripciones-alerta portal-inscripciones-alerta--aviso" role="status">
            Tu pago de inscripción ya está registrado. Puedes continuar con los siguientes pasos del proceso.
            <div style={{ marginTop: 12 }}>
              <Link href="/portal-inscripciones" className="portal-inscripciones-paso-link">
                Volver al portal de inscripciones
              </Link>
            </div>
          </div>
        )}

        {!cargando && vista && vista.solicitudCompleta && !vista.inscripcionPagada && (
          <>
            <div className="portal-matriz-contenedor">
              <PortalPagosTablaSeccion
                seccion={{
                  id: 'inscripcion',
                  titulo: vista.tituloPago,
                  filas: vista.filas,
                }}
                generandoBoucher={generandoBoucher}
                onImprimirBoucher={(f) => void imprimirBoucher(f)}
                onPagoEnLinea={(f) => void abrirPagoEnLinea(f)}
                onVerPdf={(url, c) => abrirDoc('pdf', url, c)}
                onVerXml={(url, c) => abrirDoc('xml', url, c)}
              />
            </div>
            <p className="portal-pagos-nota pi-pago-nota">
              El botón <strong>Pago en línea</strong> abre las opciones de comercio electrónico y SPEI,
              igual que en el portal de pagos.
            </p>
            <button
              type="button"
              className="portal-inscripciones-btn-sec"
              onClick={() => void cargar()}
              disabled={cargando}
            >
              <RefreshCw size={16} className={cargando ? 'portal-inscripciones-spin' : ''} aria-hidden />
              Actualizar estado de pago
            </button>
          </>
        )}
      </div>

      <PortalDocumentoModal
        abierto={docModal.abierto}
        tipo={docModal.tipo}
        url={docModal.url}
        titulo={docModal.titulo}
        onCerrar={() => setDocModal((s) => ({ ...s, abierto: false }))}
      />

      <PortalBoucherModal
        abierto={boucherModal.abierto}
        pdfUrl={boucherModal.pdfUrl}
        referencia={boucherModal.referencia}
        concepto={boucherModal.concepto}
        onCerrar={() => {
          setBoucherModal((s) => ({ ...s, abierto: false }))
          if (boucherModal.pdfUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(boucherModal.pdfUrl)
          }
        }}
      />

      <PortalTransferenciaModal
        abierto={transferModal.abierto}
        cargando={transferModal.cargando}
        datos={transferModal.datos}
        onCerrar={() => setTransferModal({ abierto: false, cargando: false, datos: null })}
        onSpeiGenerado={({ referenciaSpei, speiPdfUrl, concepto }) => {
          setSpeiModal({ abierto: true, speiPdfUrl, referenciaSpei, concepto })
        }}
      />

      <PortalSpeiReciboModal
        abierto={speiModal.abierto}
        speiPdfUrl={speiModal.speiPdfUrl}
        referenciaSpei={speiModal.referenciaSpei}
        concepto={speiModal.concepto}
        onCerrar={() =>
          setSpeiModal({ abierto: false, speiPdfUrl: null, referenciaSpei: null, concepto: '' })
        }
      />
    </div>
  )
}
