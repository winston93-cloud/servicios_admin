'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { formatearMontoPortal } from '@/lib/portalPagosService'
import type { FilaMatrizPortal, MatrizPortalPagos } from '@/lib/portalPagosMatrizService'
import { vigenciaBoucherPorDefecto } from '@/lib/boucherCore'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import PortalDocumentoModal, { type TipoDocumentoPortal } from './PortalDocumentoModal'
import PortalBoucherModal from './PortalBoucherModal'
import PortalPagosTablaSeccion from './PortalPagosTablaSeccion'

function nombreCompletoAlumno(matriz: MatrizPortalPagos | null, fallback?: string): string {
  if (!matriz) return fallback?.trim() || 'Alumno'
  const a = matriz.alumno
  const n = `${a.alumno_nombre ?? ''} ${a.alumno_app ?? ''} ${a.alumno_apm ?? ''}`.trim()
  return n || fallback?.trim() || 'Alumno'
}

export default function PortalPagosAlumnoView() {
  const router = useRouter()
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [matriz, setMatriz] = useState<MatrizPortalPagos | null>(null)
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

  const [avisoLinea, setAvisoLinea] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (alumnoId == null) {
      setError('Sesión de alumno no válida.')
      setCargando(false)
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/portal-pagos/matriz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumnoId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMatriz(null)
        setError(data.error ?? 'No se pudo cargar el portal de pagos.')
      } else {
        setMatriz(data.matriz)
      }
    } catch {
      setMatriz(null)
      setError('Error de conexión al cargar pagos.')
    }
    setCargando(false)
  }, [alumnoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const refFmt = String(session?.alumno_ref ?? '').padStart(5, '0')

  const imprimirBoucher = async (fila: FilaMatrizPortal) => {
    if (!matriz || alumnoId == null || fila.pagado) return
    setGenerandoBoucher(fila.conceptoNo)
    setError(null)
    try {
      const calcRes = await fetch('/api/bauchers/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId,
          conceptoNo: fila.conceptoNo,
          cicloEscolar: matriz.ciclo.valor,
        }),
      })
      const calc = await calcRes.json()
      if (!calcRes.ok) throw new Error(calc.error ?? 'No se pudo calcular la referencia.')

      const nombre = nombreCompletoAlumno(matriz, session?.displayName)
      const genRes = await fetch('/api/bauchers/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId,
          conceptoNo: fila.conceptoNo,
          conceptoClase: fila.conceptoClase,
          cicloEscolar: matriz.ciclo.valor,
          vigencia: vigenciaBoucherPorDefecto(),
          importe: calc.importe,
          referencia: calc.referencia,
          nombreAlumno: nombre,
          aplicarRecargos: false,
          ignorarMesPago: false,
        }),
      })
      const gen = await genRes.json()
      if (!genRes.ok) throw new Error(gen.error ?? 'No se pudo generar el baucher.')

      const pdfUrl = `data:application/pdf;base64,${gen.pdfBase64}`
      setBoucherModal({
        abierto: true,
        pdfUrl,
        referencia: gen.referencia,
        concepto: fila.conceptoClase,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar baucher.')
    }
    setGenerandoBoucher(null)
  }

  const pagoEnLinea = (fila: FilaMatrizPortal) => {
    setAvisoLinea(
      `El pago en línea de «${fila.conceptoClase}» (${formatearMontoPortal(fila.importe ?? 0)}) se conectará pronto a Openpay (SPEI) y Banorte. Por ahora usa el baucher para pagar en ventanilla.`
    )
  }

  const abrirDoc = (tipo: TipoDocumentoPortal, url: string, concepto: string) => {
    setDocModal({
      abierto: true,
      tipo,
      url,
      titulo: tipo === 'pdf' ? `Factura PDF — ${concepto}` : `Factura XML — ${concepto}`,
    })
  }

  return (
    <div className="dashboard-container dashboard-home portal-pagos-page">
      <div className="dashboard-home-bg" aria-hidden />

      <div className="dashboard-main portal-pagos-main">
        <div className="dashboard-main-center portal-pagos-center">
          <header className="portal-pagos-encabezado">
            <button
              type="button"
              className="servicios-back-btn"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft size={16} aria-hidden />
              Volver al inicio
            </button>

            <div className="portal-pagos-encabezado-grid">
              <div>
                <h1 className="dashboard-title portal-pagos-titulo">Portal de pagos</h1>
                <p className="portal-pagos-alumno">
                  <strong>{nombreCompletoAlumno(matriz, session?.displayName)}</strong>
                  <span className="portal-pagos-alumno-ref">No. de control {refFmt}</span>
                </p>
              </div>
              <div className="portal-pagos-encabezado-badges">
                {matriz && (
                  <div className="portal-pagos-plan-badge" role="status">
                    <span className="portal-pagos-ciclo-label">Modo de pago</span>
                    <span className="portal-pagos-plan-badge-valor">{matriz.planEtiqueta}</span>
                  </div>
                )}
                {matriz?.ciclo && (
                  <div className="portal-pagos-ciclo-badge" role="status">
                    <span className="portal-pagos-ciclo-label">Ciclo escolar vigente</span>
                    <span className="portal-pagos-ciclo-nombre">{matriz.ciclo.nombre}</span>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="portal-pagos-toolbar">
            <button
              type="button"
              className="portal-pagos-btn-sec"
              onClick={() => void cargar()}
              disabled={cargando}
            >
              <RefreshCw size={16} aria-hidden className={cargando ? 'portal-pagos-spin' : ''} />
              Actualizar
            </button>
          </div>

          {avisoLinea && (
            <div className="portal-pagos-alerta portal-pagos-alerta--info" role="status">
              <p>{avisoLinea}</p>
              <button type="button" className="portal-pagos-alerta-cerrar" onClick={() => setAvisoLinea(null)}>
                Entendido
              </button>
            </div>
          )}

          {cargando && (
            <div className="portal-pagos-estado" role="status">
              <div className="portal-access-loading-spinner" />
              <p>Cargando conceptos del ciclo vigente…</p>
            </div>
          )}

          {!cargando && error && (
            <div className="portal-pagos-alerta portal-pagos-alerta--error" role="alert">
              {error}
            </div>
          )}

          {!cargando && !error && matriz && (
            <div className="portal-matriz-contenedor">
              {matriz.secciones.map((seccion) => (
                <PortalPagosTablaSeccion
                  key={seccion.id}
                  seccion={seccion}
                  generandoBoucher={generandoBoucher}
                  onImprimirBoucher={(f) => void imprimirBoucher(f)}
                  onPagoEnLinea={pagoEnLinea}
                  onVerPdf={(url, c) => abrirDoc('pdf', url, c)}
                  onVerXml={(url, c) => abrirDoc('xml', url, c)}
                />
              ))}
            </div>
          )}
        </div>
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
    </div>
  )
}
