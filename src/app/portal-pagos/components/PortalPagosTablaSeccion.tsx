'use client'

import type { FilaMatrizPortal, SeccionMatrizPortal } from '@/lib/portalPagosMatrizService'
import { formatearMontoPortal } from '@/lib/portalPagosService'
import { FileText, Printer, CreditCard, Code2 } from 'lucide-react'

interface PortalPagosTablaSeccionProps {
  seccion: SeccionMatrizPortal
  generandoBoucher: string | null
  onImprimirBoucher: (fila: FilaMatrizPortal) => void
  onPagoEnLinea: (fila: FilaMatrizPortal) => void
  onVerPdf: (url: string, concepto: string) => void
  onVerXml: (url: string, concepto: string) => void
}

export default function PortalPagosTablaSeccion({
  seccion,
  generandoBoucher,
  onImprimirBoucher,
  onPagoEnLinea,
  onVerPdf,
  onVerXml,
}: PortalPagosTablaSeccionProps) {
  if (seccion.filas.length === 0) return null

  const mostrarEncabezadoSeccion = seccion.id !== 'colegiatura'

  return (
    <section
      className="portal-matriz-seccion"
      aria-label={mostrarEncabezadoSeccion ? undefined : seccion.titulo}
      aria-labelledby={mostrarEncabezadoSeccion ? `seccion-${seccion.id}` : undefined}
    >
      {mostrarEncabezadoSeccion && (
        <div className="portal-matriz-seccion-head">
          <h2 id={`seccion-${seccion.id}`} className="portal-matriz-seccion-titulo">
            {seccion.titulo}
          </h2>
          {seccion.planEtiqueta && (
            <span className="portal-matriz-plan-badge">{seccion.planEtiqueta}</span>
          )}
        </div>
      )}

      <div className="portal-matriz-tabla-wrap">
        <table className="portal-matriz-tabla">
          <thead>
            <tr>
              <th scope="col">Conceptos</th>
              <th scope="col">Generar baucher (ventanilla)</th>
              <th scope="col">Pago en línea</th>
              <th scope="col">Facturas</th>
            </tr>
          </thead>
          <tbody>
            {seccion.filas.map((fila) => (
              <tr
                key={`${seccion.id}-${fila.conceptoNo}`}
                className={fila.pagado ? 'portal-matriz-fila--pagada' : 'portal-matriz-fila--pendiente'}
              >
                <td className="portal-matriz-col-concepto">{fila.conceptoClase}</td>
                <td className="portal-matriz-col-accion">
                  {fila.pagado ? (
                    <span className="portal-matriz-pagado">Pagado</span>
                  ) : (
                    <div className="portal-matriz-accion-grupo">
                      <span className="portal-matriz-monto">
                        {fila.importe != null ? formatearMontoPortal(fila.importe) : '—'}
                      </span>
                      <button
                        type="button"
                        className="portal-pagos-btn-boucher"
                        disabled={generandoBoucher === fila.conceptoNo}
                        onClick={() => onImprimirBoucher(fila)}
                      >
                        <Printer size={14} aria-hidden />
                        {generandoBoucher === fila.conceptoNo ? 'Generando…' : 'Imprimir'}
                      </button>
                    </div>
                  )}
                </td>
                <td className="portal-matriz-col-accion">
                  {fila.pagado ? (
                    <span className="portal-matriz-pagado">Pagado</span>
                  ) : (
                    <div className="portal-matriz-accion-grupo">
                      <span className="portal-matriz-monto">
                        {fila.importeLinea != null
                          ? formatearMontoPortal(fila.importeLinea)
                          : fila.importe != null
                            ? formatearMontoPortal(fila.importe)
                            : '—'}
                      </span>
                      {(fila.recargo ?? 0) > 0 && (
                        <span className="portal-matriz-recargo-nota">
                          Incluye recargo {formatearMontoPortal(fila.recargo ?? 0)}
                        </span>
                      )}
                      <button
                        type="button"
                        className="portal-pagos-btn-linea"
                        onClick={() => onPagoEnLinea(fila)}
                      >
                        <CreditCard size={14} aria-hidden />
                        Pago en línea
                      </button>
                    </div>
                  )}
                </td>
                <td className="portal-matriz-col-facturas">
                  {fila.pagado && fila.facturaPdf ? (
                    <div className="portal-matriz-facturas">
                      <button
                        type="button"
                        className="portal-pagos-btn-pdf"
                        onClick={() => onVerPdf(fila.facturaPdf!, fila.conceptoClase)}
                      >
                        <FileText size={14} aria-hidden />
                        PDF
                      </button>
                      {fila.facturaXml && (
                        <button
                          type="button"
                          className="portal-pagos-btn-xml"
                          onClick={() => onVerXml(fila.facturaXml!, fila.conceptoClase)}
                        >
                          <Code2 size={14} aria-hidden />
                          XML
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="portal-matriz-sin-factura">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="portal-matriz-cards" aria-label={seccion.titulo}>
        {seccion.filas.map((fila) => (
          <li
            key={`card-${seccion.id}-${fila.conceptoNo}`}
            className={
              fila.pagado ? 'portal-matriz-card portal-matriz-card--pagada' : 'portal-matriz-card'
            }
          >
            <p className="portal-matriz-card-concepto">{fila.conceptoClase}</p>
            {fila.pagado ? (
              <p className="portal-matriz-pagado portal-matriz-pagado--card">Pagado</p>
            ) : (
              <>
                <p className="portal-matriz-monto portal-matriz-monto--card">
                  {fila.importeLinea != null
                    ? formatearMontoPortal(fila.importeLinea)
                    : fila.importe != null
                      ? formatearMontoPortal(fila.importe)
                      : '—'}
                </p>
                {(fila.recargo ?? 0) > 0 && (
                  <p className="portal-matriz-recargo-nota">
                    Ventanilla {fila.importe != null ? formatearMontoPortal(fila.importe) : '—'} ·
                    recargo {formatearMontoPortal(fila.recargo ?? 0)}
                  </p>
                )}
              </>
            )}
            <div className="portal-matriz-card-acciones">
              {!fila.pagado && (
                <>
                  <button
                    type="button"
                    className="portal-pagos-btn-boucher"
                    disabled={generandoBoucher === fila.conceptoNo}
                    onClick={() => onImprimirBoucher(fila)}
                  >
                    <Printer size={14} aria-hidden />
                    Baucher
                  </button>
                  <button
                    type="button"
                    className="portal-pagos-btn-linea"
                    onClick={() => onPagoEnLinea(fila)}
                  >
                    <CreditCard size={14} aria-hidden />
                    En línea
                  </button>
                </>
              )}
              {fila.pagado && fila.facturaPdf && (
                <div className="portal-matriz-facturas">
                  <button
                    type="button"
                    className="portal-pagos-btn-pdf"
                    onClick={() => onVerPdf(fila.facturaPdf!, fila.conceptoClase)}
                  >
                    PDF
                  </button>
                  {fila.facturaXml && (
                    <button
                      type="button"
                      className="portal-pagos-btn-xml"
                      onClick={() => onVerXml(fila.facturaXml!, fila.conceptoClase)}
                    >
                      XML
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
