'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CreditCard,
  FileText,
  Loader2,
  PlusCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { clasePlanMeses, etiquetaPlanMeses } from '@/lib/alumnoPlanMeses'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { obtenerAlumnoPorRef, type AlumnoRegistro } from '@/lib/alumnoDatosService'
import { normalizarConceptoNo, parsearReferenciaPago } from '@/lib/pagoReferenciaColegiatura'
import {
  actualizarEstatusPagoColegiatura,
  estatusVisualPago,
  etiquetaEstatusPago,
  listarConceptosBoucher,
  listarPagosColegiaturaAlumno,
  mapaConceptosPorNo,
  obtenerUltimaActualizacionPagos,
  type ConceptoBoucher,
  type PagoDetalleRegistro,
} from '@/lib/pagoColegiaturaService'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import CicloEscolarSelector from '../components/CicloEscolarSelector'

function formatearMonto(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function claseFilaEstatus(estatus: ReturnType<typeof estatusVisualPago>): string {
  switch (estatus) {
    case 'cancelado':
      return 'pc-fila--cancelado'
    case 'devolucion':
      return 'pc-fila--devolucion'
    case 'manual':
      return 'pc-fila--manual'
    default:
      return ''
  }
}

function conceptoDesdeReferencia(
  referencia: string | null | undefined,
  mapa: Map<string, string>
): string {
  const p = parsearReferenciaPago(referencia)
  if (!p) return '—'
  const no = normalizarConceptoNo(p.conceptoNo)
  return mapa.get(no) ?? `Concepto ${no}`
}

export default function PagosColegiaturasModulo() {
  const {
    cicloSeleccionado,
    cicloActualSistema,
    cargando: cargandoCiclos,
    setCicloSeleccionado,
  } = useCicloEscolar()
  const cicloInicializado = useRef(false)
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  const [conceptos, setConceptos] = useState<ConceptoBoucher[]>([])
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null)
  const [alumnoCargado, setAlumnoCargado] = useState<AlumnoRegistro | null>(null)
  const [pagos, setPagos] = useState<PagoDetalleRegistro[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actualizandoId, setActualizandoId] = useState<number | null>(null)

  const mapaConceptos = useMemo(() => mapaConceptosPorNo(conceptos), [conceptos])

  const etiquetaPlan = useMemo(
    () => etiquetaPlanMeses(alumnoCargado?.mes),
    [alumnoCargado?.mes]
  )

  useEffect(() => {
    listarConceptosBoucher().then(setConceptos)
    obtenerUltimaActualizacionPagos().then(setUltimaActualizacion)
  }, [])

  useEffect(() => {
    if (cargandoCiclos || cicloInicializado.current) return
    setCicloSeleccionado(cicloActualSistema)
    cicloInicializado.current = true
  }, [cargandoCiclos, cicloActualSistema, setCicloSeleccionado])

  const cargarPagos = useCallback(async (ref: string, ciclo: number) => {
    setCargando(true)
    setError(null)
    const alumno = await obtenerAlumnoPorRef(ref, ciclo)
    if (!alumno) {
      setAlumnoCargado(null)
      setPagos([])
      setCargando(false)
      setError('El alumno no tiene registro en el ciclo de consulta.')
      return
    }
    setAlumnoCargado(alumno)
    const lista = await listarPagosColegiaturaAlumno(alumno.alumno_id, ciclo)
    setPagos(lista)
    setCargando(false)
  }, [])

  useEffect(() => {
    if (!alumnoSeleccionado) {
      setAlumnoCargado(null)
      setPagos([])
      setError(null)
      return
    }
    if (resolviendoCiclo) return
    cargarPagos(alumnoSeleccionado.alumno_ref, cicloSeleccionado)
  }, [alumnoSeleccionado, cicloSeleccionado, resolviendoCiclo, cargarPagos])

  const etiquetaCiclo = useMemo(
    () => etiquetaCicloEscolar(cicloSeleccionado),
    [cicloSeleccionado]
  )

  const totalImporte = useMemo(
    () => pagos.reduce((s, p) => s + p.pago_importe + p.pago_recargo, 0),
    [pagos]
  )

  const cambiarEstatus = useCallback(
    async (pagoId: number, nuevoEstatus: number, mensaje: string) => {
      if (!window.confirm(mensaje)) return
      setActualizandoId(pagoId)
      const res = await actualizarEstatusPagoColegiatura(pagoId, nuevoEstatus)
      setActualizandoId(null)
      if (!res.ok) {
        setError(res.error ?? 'No se pudo actualizar el pago.')
        return
      }
      setPagos((prev) =>
        prev.map((p) => (p.pago_id === pagoId ? { ...p, pago_cancelado: nuevoEstatus } : p))
      )
    },
    []
  )

  return (
    <div className="servicios-panel-inner pc-modulo">
      <header className="pc-encabezado">
        <div className="pc-encabezado-titulo">
          <span className="pc-encabezado-icono" aria-hidden>
            <CreditCard size={22} />
          </span>
          <div>
            <h1 className="pc-encabezado-h1">Pagos de Colegiaturas</h1>
            {ultimaActualizacion ? (
              <p className="pc-ultima-actualizacion">
                Última actualización: <strong>{ultimaActualizacion}</strong>
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="pc-filtros">
        <section className="pc-panel-busqueda" aria-label="Búsqueda de alumno">
          <AlumnoAutocomplete
            etiqueta="Nombre del alumno / No. control"
            alumnoSeleccionado={alumnoSeleccionado}
            onSeleccionar={setAlumnoSeleccionado}
          />
        </section>
        <CicloEscolarSelector
          id="ciclo-escolar-pagos-colegiaturas"
          etiqueta="Ciclo activo"
          variante="inline"
          mostrarCicloSistema={false}
          className="pc-ciclo-selector"
        />
      </div>

      {error ? (
        <p className="pc-msg pc-msg--error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="pc-tabla-card" aria-labelledby="pc-tabla-titulo">
        <div className="pc-tabla-card-bar">
          <div className="pc-tabla-card-bar-izq">
            <h2 id="pc-tabla-titulo" className="pc-tabla-card-titulo">
              Historial de pagos
            </h2>
            {etiquetaPlan ? (
              <span
                className={`pc-plan-badge ${clasePlanMeses(alumnoCargado?.mes)}`}
                title="Forma de pago según registro del alumno (campo mes)"
              >
                {etiquetaPlan}
              </span>
            ) : null}
          </div>
          {alumnoSeleccionado && pagos.length > 0 ? (
            <div className="pc-tabla-resumen">
              <span>{pagos.length} pagos</span>
              <span className="pc-tabla-resumen-sep" aria-hidden>
                ·
              </span>
              <span>
                Total: <strong>{formatearMonto(totalImporte)}</strong>
              </span>
            </div>
          ) : null}
        </div>

        <div className="pc-tabla-scroll">
          {cargando ? (
            <p className="pc-loading">
              <Loader2 className="pc-spin" size={22} aria-hidden />
              Cargando pagos…
            </p>
          ) : !alumnoSeleccionado ? (
            <p className="pc-empty">
              Busca un alumno para ver sus pagos de colegiatura en el ciclo seleccionado.
            </p>
          ) : pagos.length === 0 ? (
            <p className="pc-empty">
              No hay pagos registrados para este alumno en {etiquetaCiclo}.
            </p>
          ) : (
            <table className="pc-tabla">
              <thead>
                <tr>
                  <th scope="col" className="pc-col--num">
                    #
                  </th>
                  <th scope="col">Concepto</th>
                  <th scope="col" className="pc-col--monto">
                    Monto
                  </th>
                  <th scope="col" className="pc-col--monto">
                    Recargos
                  </th>
                  <th scope="col">Fecha pago</th>
                  <th scope="col">Referencia</th>
                  <th scope="col">Emisora</th>
                  <th scope="col">Forma de pago</th>
                  <th scope="col">Estatus</th>
                  <th scope="col" className="pc-col--acciones">
                    Cancelar
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p, i) => {
                  const est = estatusVisualPago(p.pago_cancelado)
                  const etiquetaEst = etiquetaEstatusPago(p.pago_cancelado)
                  const busy = actualizandoId === p.pago_id
                  return (
                    <tr key={p.pago_id} className={claseFilaEstatus(est)}>
                      <td className="pc-col--num">{i + 1}</td>
                      <td className="pc-col--concepto">
                        {conceptoDesdeReferencia(p.pago_referencia, mapaConceptos)}
                      </td>
                      <td className="pc-col--monto">{formatearMonto(p.pago_importe)}</td>
                      <td className="pc-col--monto">{formatearMonto(p.pago_recargo)}</td>
                      <td className="pc-col--fecha">{p.pago_fecha ?? '—'}</td>
                      <td className="pc-col--ref">{p.pago_referencia ?? '—'}</td>
                      <td>{p.pago_emisora ?? 'S/E'}</td>
                      <td>{p.pago_forma ?? '—'}</td>
                      <td className="pc-col--estatus">
                        {etiquetaEst ? (
                          <span className={`pc-estatus-badge pc-estatus-badge--${est}`}>
                            {etiquetaEst}
                          </span>
                        ) : (
                          <span className="pc-estatus-vacio">—</span>
                        )}
                      </td>
                      <td className="pc-col--acciones">
                        <div className="pc-acciones" role="group" aria-label="Acciones del pago">
                          <button
                            type="button"
                            className="pc-accion pc-accion--cancelar"
                            title="Marcar como pago cancelado"
                            disabled={busy || p.pago_cancelado === 1}
                            onClick={() =>
                              cambiarEstatus(
                                p.pago_id,
                                1,
                                '¿Marcar este pago como cancelado?'
                              )
                            }
                          >
                            <XCircle size={18} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="pc-accion pc-accion--devolucion"
                            title="Marcar como devolución"
                            disabled={busy || p.pago_cancelado === 2}
                            onClick={() =>
                              cambiarEstatus(
                                p.pago_id,
                                2,
                                '¿Marcar este pago como devolución?'
                              )
                            }
                          >
                            <RotateCcw size={18} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="pc-accion pc-accion--manual"
                            title="Marcar como agregado manual"
                            disabled={busy || p.pago_cancelado === 3}
                            onClick={() =>
                              cambiarEstatus(
                                p.pago_id,
                                3,
                                '¿Marcar este pago como agregado manual?'
                              )
                            }
                          >
                            <PlusCircle size={18} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="pc-accion pc-accion--restaurar"
                            title="Restaurar a pago vigente"
                            disabled={busy || p.pago_cancelado === 0}
                            onClick={() =>
                              cambiarEstatus(
                                p.pago_id,
                                0,
                                '¿Restaurar este pago como vigente?'
                              )
                            }
                          >
                            <FileText size={18} aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
