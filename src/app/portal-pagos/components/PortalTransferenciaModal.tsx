'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { formatearMontoPortal } from '@/lib/portalPagosService'
import {
  generarReferenciaPagoAleatoria,
  semibaseDesdeReferenciaCompleta,
} from '@/lib/pagoReferenciaColegiatura'

export interface DatosTransferenciaPortal {
  alumno: string
  grado: string
  /** Referencia ventanilla / baucher (9 semibase + verificador Banorte por algoritmo). */
  referenciaVentanilla: string
  concepto: string
  importe: number
  alumnoId: number
  conceptoNo: string
  cicloEscolar: number
  alumnoNivel: number
}

interface PortalTransferenciaModalProps {
  abierto: boolean
  cargando?: boolean
  datos: DatosTransferenciaPortal | null
  onCerrar: () => void
  onSpeiGenerado: (payload: {
    referenciaSpei: string
    speiPdfUrl: string
    concepto: string
  }) => void
}

declare global {
  interface Window {
    OpenPay?: {
      setId: (id: string) => void
      setApiKey: (key: string) => void
      setSandboxMode: (sandbox: boolean) => void
      deviceData: {
        setup: (formId: string, inputId: string) => void
      }
    }
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    document.head.appendChild(el)
  })
}

async function cargarOpenPayCliente(): Promise<void> {
  await loadScript('https://resources.openpay.mx/lib/openpay-js/1.2.38/openpay.v1.min.js')
  await loadScript('https://resources.openpay.mx/lib/openpay-data.v1.min.js')
}

async function obtenerDeviceSessionId(
  merchantId: string,
  publicKey: string,
  sandbox: boolean
): Promise<string> {
  await cargarOpenPayCliente()
  if (!window.OpenPay) throw new Error('OpenPay no está disponible en el navegador.')

  window.OpenPay.setId(merchantId)
  window.OpenPay.setApiKey(publicKey)
  window.OpenPay.setSandboxMode(sandbox)
  window.OpenPay.deviceData.setup('portal-spei-device-form', 'portal-spei-device-session')

  await new Promise((r) => setTimeout(r, 400))
  const input = document.getElementById('portal-spei-device-session') as HTMLInputElement | null
  return input?.value?.trim() ?? ''
}

export default function PortalTransferenciaModal({
  abierto,
  cargando = false,
  datos,
  onCerrar,
  onSpeiGenerado,
}: PortalTransferenciaModalProps) {
  const [generandoSpei, setGenerandoSpei] = useState(false)
  const [errorSpei, setErrorSpei] = useState<string | null>(null)
  const [referenciaSpei, setReferenciaSpei] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !generandoSpei) onCerrar()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [abierto, onCerrar, generandoSpei])

  useEffect(() => {
    if (!abierto) {
      setErrorSpei(null)
      setReferenciaSpei(null)
      setGenerandoSpei(false)
    }
  }, [abierto])

  const generarReciboSpei = useCallback(async () => {
    if (!datos) return
    setGenerandoSpei(true)
    setErrorSpei(null)
    try {
      const configRes = await fetch(
        `/api/portal-pagos/spei/config?nivel=${datos.alumnoNivel}`
      )
      const configData = await configRes.json()
      if (!configRes.ok) throw new Error(configData.error ?? 'OpenPay no configurado.')

      const deviceSessionId = await obtenerDeviceSessionId(
        configData.config.merchantId,
        configData.config.publicKey,
        configData.config.sandbox
      )

      const res = await fetch('/api/portal-pagos/spei', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId: datos.alumnoId,
          conceptoNo: datos.conceptoNo,
          cicloEscolar: datos.cicloEscolar,
          conceptoClase: datos.concepto,
          nombreAlumno: datos.alumno,
          deviceSessionId: deviceSessionId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No se pudo generar el recibo SPEI.')

      setReferenciaSpei(data.referenciaSpei)
      onSpeiGenerado({
        referenciaSpei: data.referenciaSpei,
        speiPdfUrl: data.speiPdfUrl,
        concepto: datos.concepto,
      })
    } catch (e) {
      setErrorSpei(e instanceof Error ? e.message : 'Error al generar recibo SPEI.')
    }
    setGenerandoSpei(false)
  }, [datos, onSpeiGenerado])

  if (!abierto) return null

  return (
    <div
      className="portal-doc-modal-overlay portal-transfer-overlay"
      role="presentation"
      onClick={generandoSpei ? undefined : onCerrar}
    >
      <form id="portal-spei-device-form" className="portal-spei-device-form" aria-hidden>
        <input type="hidden" id="portal-spei-device-session" name="device_session_id" />
      </form>

      <div
        className="portal-transfer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-transfer-title"
        aria-busy={cargando || generandoSpei}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="portal-transfer-cerrar-x"
          onClick={onCerrar}
          disabled={generandoSpei}
          aria-label="Cerrar"
        >
          ×
        </button>

        <div className="portal-transfer-titulo-caja">
          <h2 id="portal-transfer-title" className="portal-transfer-titulo">
            Información de la Transferencia
          </h2>
        </div>

        {cargando ? (
          <div className="portal-transfer-cargando" role="status">
            <div className="portal-access-loading-spinner" />
            <p>Preparando datos de pago…</p>
          </div>
        ) : datos ? (
          <>
            <table className="portal-transfer-datos">
              <tbody>
                <tr>
                  <th scope="row">Alumno:</th>
                  <td className="portal-transfer-datos--alumno">{datos.alumno}</td>
                </tr>
                <tr>
                  <th scope="row">Grado:</th>
                  <td>{datos.grado}</td>
                </tr>
                <tr>
                  <th scope="row">Referencia ventanilla:</th>
                  <td>
                    <code className="portal-transfer-ref">{datos.referenciaVentanilla}</code>
                  </td>
                </tr>
                {referenciaSpei && (
                  <tr>
                    <th scope="row">Referencia SPEI:</th>
                    <td>
                      <code className="portal-transfer-ref portal-transfer-ref--spei">
                        {referenciaSpei}
                      </code>
                    </td>
                  </tr>
                )}
                <tr>
                  <th scope="row">Concepto:</th>
                  <td>{datos.concepto}</td>
                </tr>
                <tr>
                  <th scope="row">Importe:</th>
                  <td className="portal-transfer-importe">{formatearMontoPortal(datos.importe)}</td>
                </tr>
              </tbody>
            </table>

            <div className="portal-transfer-opciones">
              <div className="portal-transfer-opcion portal-transfer-opcion--banorte">
                <div className="portal-transfer-logo-wrap">
                  <Image
                    src="/portal-pagos/banorte.png"
                    alt="Banorte"
                    width={140}
                    height={48}
                    className="portal-transfer-logo"
                  />
                </div>
                <h3 className="portal-transfer-opcion-titulo">
                  Comercio electrónico (tarjeta crédito o débito)
                </h3>
                <button
                  type="button"
                  className="portal-transfer-btn-pago portal-transfer-btn-pago--activo"
                  disabled={!datos || generandoSpei}
                  onClick={() => {
                    if (!datos) return
                    const semibase = semibaseDesdeReferenciaCompleta(datos.referenciaVentanilla)
                    const refBanorte = generarReferenciaPagoAleatoria(semibase)
                    const params = new URLSearchParams({
                      referencia: refBanorte,
                      monto: Number(datos.importe).toFixed(2),
                      concepto: datos.concepto,
                      nivel: String(datos.alumnoNivel),
                    })
                    window.open(
                      `/portal-pagos/banorte/3d?${params.toString()}`,
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }}
                >
                  Realizar pago
                </button>
                <p className="portal-transfer-opcion-nota">
                  Tarjeta de crédito o débito de cualquier banco, procesada por el comercio
                  electrónico de Banorte (3D Secure y Payworks).
                </p>
              </div>

              <div className="portal-transfer-opcion portal-transfer-opcion--openpay">
                <div className="portal-transfer-logo-wrap portal-transfer-logo-wrap--openpay">
                  <Image
                    src="/portal-pagos/openpay.jpg"
                    alt="OpenPay"
                    width={160}
                    height={56}
                    className="portal-transfer-logo portal-transfer-logo--openpay"
                  />
                </div>
                <h3 className="portal-transfer-opcion-titulo">Pago SPEI (Transferencia Interbancaria)</h3>
                <button
                  type="button"
                  className="portal-transfer-btn-pago portal-transfer-btn-pago--activo"
                  disabled={generandoSpei}
                  onClick={() => void generarReciboSpei()}
                >
                  {generandoSpei ? 'Generando recibo…' : 'Generar Recibo'}
                </button>
                <p className="portal-transfer-opcion-nota portal-transfer-opcion-nota--spei">
                  Al generar el recibo se crea una referencia SPEI con 3 dígitos aleatorios.
                </p>
                {errorSpei && (
                  <p className="portal-transfer-opcion-error" role="alert">
                    {errorSpei}
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <p className="portal-transfer-error" role="alert">
            No se pudieron cargar los datos de la transferencia.
          </p>
        )}

        <div className="portal-transfer-pie">
          <button
            type="button"
            className="portal-transfer-btn-cerrar"
            onClick={onCerrar}
            disabled={generandoSpei}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
