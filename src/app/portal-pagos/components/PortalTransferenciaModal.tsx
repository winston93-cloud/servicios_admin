'use client'

import { useEffect } from 'react'
import { formatearMontoPortal } from '@/lib/portalPagosService'

export interface DatosTransferenciaPortal {
  alumno: string
  grado: string
  referencia: string
  concepto: string
  importe: number
}

interface PortalTransferenciaModalProps {
  abierto: boolean
  cargando?: boolean
  datos: DatosTransferenciaPortal | null
  onCerrar: () => void
}

export default function PortalTransferenciaModal({
  abierto,
  cargando = false,
  datos,
  onCerrar,
}: PortalTransferenciaModalProps) {
  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div
      className="portal-doc-modal-overlay portal-transfer-overlay"
      role="presentation"
      onClick={onCerrar}
    >
      <div
        className="portal-transfer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-transfer-title"
        aria-busy={cargando}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="portal-transfer-cerrar-x"
          onClick={onCerrar}
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
                  <th scope="row">Referencia:</th>
                  <td>
                    <code className="portal-transfer-ref">{datos.referencia}</code>
                  </td>
                </tr>
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
              <div className="portal-transfer-opcion">
                <h3 className="portal-transfer-opcion-titulo">Pago con Tarjeta de Crédito/Débito</h3>
                <button type="button" className="portal-transfer-btn-pago" disabled>
                  Realizar Pago
                </button>
                <p className="portal-transfer-opcion-nota">Disponible próximamente</p>
              </div>
              <div className="portal-transfer-opcion">
                <h3 className="portal-transfer-opcion-titulo">Pago SPEI (Transferencia Interbancaria)</h3>
                <button type="button" className="portal-transfer-btn-pago" disabled>
                  Generar Recibo
                </button>
                <p className="portal-transfer-opcion-nota">Disponible próximamente</p>
              </div>
            </div>
          </>
        ) : (
          <p className="portal-transfer-error" role="alert">
            No se pudieron cargar los datos de la transferencia.
          </p>
        )}

        <div className="portal-transfer-pie">
          <button type="button" className="portal-transfer-btn-cerrar" onClick={onCerrar}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
