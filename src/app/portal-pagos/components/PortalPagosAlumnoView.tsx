'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  cargarPortalPagosAlumno,
  etiquetaConceptoPago,
  etiquetaEstatusAlumno,
  formatearMontoPortal,
  totalPagosVigentes,
  type PortalPagosContexto,
} from '@/lib/portalPagosService'
import { ArrowLeft, RefreshCw } from 'lucide-react'

function nombreCompletoAlumno(
  alumno: PortalPagosContexto['alumno'] | null,
  fallback: string | undefined
): string {
  if (!alumno) return fallback?.trim() || 'Alumno'
  const n = `${alumno.alumno_nombre ?? ''} ${alumno.alumno_app ?? ''} ${alumno.alumno_apm ?? ''}`.trim()
  return n || fallback?.trim() || 'Alumno'
}

export default function PortalPagosAlumnoView() {
  const router = useRouter()
  const { session } = useAuth()
  const alumnoId = session?.alumno_id

  const [ctx, setCtx] = useState<PortalPagosContexto | null>(null)
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
    const res = await cargarPortalPagosAlumno(alumnoId)
    if (!res.ok) {
      setCtx(null)
      setError(res.error)
    } else {
      setCtx(res.data)
    }
    setCargando(false)
  }, [alumnoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const refFmt = String(session?.alumno_ref ?? '').padStart(5, '0')
  const total = ctx ? totalPagosVigentes(ctx.pagos) : 0

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
                  <strong>{nombreCompletoAlumno(ctx?.alumno ?? null, session?.displayName)}</strong>
                  <span className="portal-pagos-alumno-ref">No. de control {refFmt}</span>
                </p>
              </div>
              {ctx?.ciclo && (
                <div className="portal-pagos-ciclo-badge" role="status">
                  <span className="portal-pagos-ciclo-label">Ciclo escolar vigente</span>
                  <span className="portal-pagos-ciclo-nombre">{ctx.ciclo.nombre}</span>
                </div>
              )}
            </div>

            <p className="portal-pagos-lead">
              Pagos registrados en el ciclo vigente. Los abonos pueden tardar hasta 48 horas en
              reflejarse después de realizar tu pago en línea o en ventanilla.
            </p>
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

          {cargando && (
            <div className="portal-pagos-estado" role="status">
              <div className="portal-access-loading-spinner" />
              <p>Cargando pagos del ciclo vigente…</p>
            </div>
          )}

          {!cargando && error && (
            <div className="portal-pagos-alerta portal-pagos-alerta--error" role="alert">
              {error}
            </div>
          )}

          {!cargando && !error && ctx && (
            <>
              <div className="portal-pagos-resumen">
                <div className="portal-pagos-resumen-item">
                  <span className="portal-pagos-resumen-label">Pagos en el ciclo</span>
                  <span className="portal-pagos-resumen-valor">{ctx.pagos.length}</span>
                </div>
                <div className="portal-pagos-resumen-item">
                  <span className="portal-pagos-resumen-label">Total abonado (vigente)</span>
                  <span className="portal-pagos-resumen-valor portal-pagos-resumen-valor--monto">
                    {formatearMontoPortal(total)}
                  </span>
                </div>
              </div>

              {ctx.pagos.length === 0 ? (
                <div className="servicios-panel-card portal-pagos-vacio">
                  <p className="servicios-panel-hint">
                    Aún no hay pagos registrados para el ciclo <strong>{ctx.ciclo.nombre}</strong>.
                    Cuando el banco confirme tu pago, aparecerá aquí.
                  </p>
                </div>
              ) : (
                <>
                  <div className="portal-pagos-tabla-wrap" aria-label="Pagos del ciclo vigente">
                    <table className="portal-pagos-tabla">
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">Concepto</th>
                          <th scope="col">Fecha</th>
                          <th scope="col">Monto</th>
                          <th scope="col">Recargo</th>
                          <th scope="col">Referencia</th>
                          <th scope="col">Forma</th>
                          <th scope="col">Estatus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ctx.pagos.map((p, i) => {
                          const concepto = etiquetaConceptoPago(
                            p.pago_referencia,
                            ctx.conceptos
                          )
                          const est = etiquetaEstatusAlumno(p.pago_cancelado)
                          return (
                            <tr
                              key={p.pago_id}
                              className={
                                p.pago_cancelado !== 0 ? 'portal-pagos-fila--inactiva' : ''
                              }
                            >
                              <td>{i + 1}</td>
                              <td className="portal-pagos-col-concepto">{concepto}</td>
                              <td>{p.pago_fecha ?? '—'}</td>
                              <td className="portal-pagos-col-monto">
                                {formatearMontoPortal(p.pago_importe)}
                              </td>
                              <td className="portal-pagos-col-monto">
                                {formatearMontoPortal(p.pago_recargo)}
                              </td>
                              <td className="portal-pagos-col-ref">
                                {p.pago_referencia ?? '—'}
                              </td>
                              <td>{p.pago_forma ?? '—'}</td>
                              <td>
                                {est ? (
                                  <span className="portal-pagos-estatus-tag">{est}</span>
                                ) : (
                                  <span className="portal-pagos-estatus-ok">Aplicado</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <ul className="portal-pagos-lista-movil" aria-label="Lista de pagos">
                    {ctx.pagos.map((p, i) => {
                      const concepto = etiquetaConceptoPago(p.pago_referencia, ctx.conceptos)
                      const est = etiquetaEstatusAlumno(p.pago_cancelado)
                      return (
                        <li key={p.pago_id} className="portal-pagos-card-pago">
                          <div className="portal-pagos-card-pago-head">
                            <span className="portal-pagos-card-num">#{i + 1}</span>
                            <p className="portal-pagos-card-concepto">{concepto}</p>
                            {est ? (
                              <span className="portal-pagos-estatus-tag">{est}</span>
                            ) : (
                              <span className="portal-pagos-estatus-ok">Aplicado</span>
                            )}
                          </div>
                          <dl className="portal-pagos-card-dl">
                            <div>
                              <dt>Fecha</dt>
                              <dd>{p.pago_fecha ?? '—'}</dd>
                            </div>
                            <div>
                              <dt>Monto</dt>
                              <dd>{formatearMontoPortal(p.pago_importe)}</dd>
                            </div>
                            <div>
                              <dt>Recargo</dt>
                              <dd>{formatearMontoPortal(p.pago_recargo)}</dd>
                            </div>
                            <div className="portal-pagos-card-dl--ancho">
                              <dt>Referencia</dt>
                              <dd>{p.pago_referencia ?? '—'}</dd>
                            </div>
                            <div>
                              <dt>Forma</dt>
                              <dd>{p.pago_forma ?? '—'}</dd>
                            </div>
                          </dl>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}

              <p className="portal-pagos-nota">
                La generación de referencias y pagos en línea se habilitará en una siguiente
                actualización. Por ahora puedes consultar aquí los pagos ya aplicados a tu cuenta.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
