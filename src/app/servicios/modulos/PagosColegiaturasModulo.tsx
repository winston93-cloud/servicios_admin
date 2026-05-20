'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import {
  conceptoClasePorReferencia,
  estatusVisualPago,
  listarConceptosBoucher,
  listarPagosColegiaturaAlumno,
  obtenerUltimaActualizacionPagos,
  type ConceptoBoucher,
  type PagoDetalleRegistro,
} from '@/lib/pagoColegiaturaService'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'

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

export default function PagosColegiaturasModulo() {
  const { cicloSeleccionado } = useCicloEscolar()
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  const [conceptos, setConceptos] = useState<ConceptoBoucher[]>([])
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null)
  const [pagos, setPagos] = useState<PagoDetalleRegistro[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarConceptosBoucher().then(setConceptos)
    obtenerUltimaActualizacionPagos().then(setUltimaActualizacion)
  }, [])

  const cargarPagos = useCallback(async (ref: string, ciclo: number) => {
    setCargando(true)
    setError(null)
    const alumno = await obtenerAlumnoPorRef(ref, ciclo)
    if (!alumno) {
      setPagos([])
      setCargando(false)
      setError('El alumno no tiene registro en el ciclo de consulta.')
      return
    }
    const lista = await listarPagosColegiaturaAlumno(alumno.alumno_id, ciclo)
    setPagos(lista)
    setCargando(false)
  }, [])

  useEffect(() => {
    if (!alumnoSeleccionado) {
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

  return (
    <div className="servicios-panel-inner pc-modulo">
      <header className="servicios-panel-header">
        <h1 className="servicios-panel-title">Pagos de Colegiaturas</h1>
        {ultimaActualizacion ? (
          <p className="pc-ultima-actualizacion">
            Última actualización: <strong>{ultimaActualizacion}</strong>
          </p>
        ) : null}
        <p className="servicios-panel-lead">
          Consulta los pagos registrados por comercio electrónico, Openpay u otros medios
          confirmados. Ciclo de consulta: <strong>{etiquetaCiclo}</strong>.
        </p>
      </header>

      <div className="pc-busqueda">
        <AlumnoAutocomplete
          etiqueta="Nombre del alumno / No. control"
          alumnoSeleccionado={alumnoSeleccionado}
          onSeleccionar={setAlumnoSeleccionado}
        />
      </div>

      <div className="pc-leyenda" aria-label="Leyenda de estados de pago">
        <span className="pc-leyenda-item">
          <span className="pc-leyenda-muestra pc-leyenda-muestra--cancelado" />
          Es pago cancelado
        </span>
        <span className="pc-leyenda-item">
          <span className="pc-leyenda-muestra pc-leyenda-muestra--devolucion" />
          Es devolución
        </span>
        <span className="pc-leyenda-item">
          <span className="pc-leyenda-muestra pc-leyenda-muestra--manual" />
          Agregado manual
        </span>
      </div>

      {error ? <p className="pc-msg pc-msg--error">{error}</p> : null}

      <div className="pc-tabla-wrap">
        {cargando ? (
          <p className="pc-loading">
            <Loader2 className="pc-spin" size={20} aria-hidden />
            Cargando pagos…
          </p>
        ) : !alumnoSeleccionado ? (
          <p className="pc-empty">Busca un alumno para ver sus pagos de colegiatura.</p>
        ) : pagos.length === 0 ? (
          <p className="pc-empty">
            No hay pagos registrados para este alumno en el ciclo {etiquetaCiclo}.
          </p>
        ) : (
          <table className="pc-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Concepto</th>
                <th>Monto</th>
                <th>Recargos</th>
                <th>Fecha pago</th>
                <th>Referencia</th>
                <th>Emisora</th>
                <th>Forma de pago</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p, i) => {
                const est = estatusVisualPago(p.pago_cancelado)
                return (
                  <tr key={p.pago_id} className={claseFilaEstatus(est)}>
                    <td>{i + 1}</td>
                    <td>{conceptoClasePorReferencia(p.pago_referencia, conceptos)}</td>
                    <td className="pc-num">{formatearMonto(p.pago_importe)}</td>
                    <td className="pc-num">{formatearMonto(p.pago_recargo)}</td>
                    <td>{p.pago_fecha ?? '—'}</td>
                    <td className="pc-ref">{p.pago_referencia ?? '—'}</td>
                    <td>{p.pago_emisora ?? '—'}</td>
                    <td>{p.pago_forma ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
