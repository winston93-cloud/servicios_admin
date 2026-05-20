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

function AccionesPago({
  pago,
  busy,
  onCambiarEstatus,
}: {
  pago: PagoDetalleRegistro
  busy: boolean
  onCambiarEstatus: (pagoId: number, nuevoEstatus: number, mensaje: string) => void
}) {
  return (
    <div className="pc-acciones" role="group" aria-label="Acciones del pago">
      <button
        type="button"
        className="pc-accion pc-accion--cancelar"
        title="Marcar como pago cancelado"
        disabled={busy || pago.pago_cancelado === 1}
        onClick={() => onCambiarEstatus(pago.pago_id, 1, '¿Marcar este pago como cancelado?')}
      >
        <XCircle size={16} aria-hidden />
      </button>
      <button
        type="button"
        className="pc-accion pc-accion--devolucion"
        title="Marcar como devolución"
        disabled={busy || pago.pago_cancelado === 2}
        onClick={() => onCambiarEstatus(pago.pago_id, 2, '¿Marcar este pago como devolución?')}
      >
        <RotateCcw size={16} aria-hidden />
      </button>
      <button
        type="button"
        className="pc-accion pc-accion--manual"
        title="Marcar como agregado manual"
        disabled={busy || pago.pago_cancelado === 3}
        onClick={() =>
          onCambiarEstatus(pago.pago_id, 3, '¿Marcar este pago como agregado manual?')
        }
      >
        <PlusCircle size={16} aria-hidden />
      </button>
      <button
        type="button"
        className="pc-accion pc-accion--restaurar"
        title="Restaurar a pago vigente"
        disabled={busy || pago.pago_cancelado === 0}
        onClick={() => onCambiarEstatus(pago.pago_id, 0, '¿Restaurar este pago como vigente?')}
      >
        <FileText size={16} aria-hidden />
      </button>
    </div>
  )
}

export default function PagosColegiaturasModulo() {
  const {
    cicloSeleccionado,
    cicloActualSistema,
    opcionesCatalogo,
    cargando: cargandoCiclos,
  } = useCicloEscolar()
  const cicloPagosInicializado = useRef(false)
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  /** Ciclo para filtrar pagos (dígitos 8-9 de pago_referencia / alumno_ciclo_escolar). */
  const [cicloEscolarPagos, setCicloEscolarPagos] = useState(cicloActualSistema)

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
    if (cargandoCiclos || cicloPagosInicializado.current) return
    setCicloEscolarPagos(cicloActualSistema)
    cicloPagosInicializado.current = true
  }, [cargandoCiclos, cicloActualSistema])

  const cargarPagos = useCallback(
    async (ref: string, cicloAlumnoActivo: number, cicloPagos: number) => {
      setCargando(true)
      setError(null)
      const alumno = await obtenerAlumnoPorRef(ref, cicloAlumnoActivo)
      if (!alumno) {
        setAlumnoCargado(null)
        setPagos([])
        setCargando(false)
        setError('El alumno no tiene registro en el ciclo activo seleccionado.')
        return
      }
      setAlumnoCargado(alumno)
      const alumnoPagos =
        (await obtenerAlumnoPorRef(ref, cicloPagos)) ?? alumno
      const lista = await listarPagosColegiaturaAlumno(
        alumnoPagos.alumno_id,
        cicloPagos
      )
      setPagos(lista)
      setCargando(false)
    },
    []
  )

  useEffect(() => {
    if (!alumnoSeleccionado) {
      setAlumnoCargado(null)
      setPagos([])
      setError(null)
      return
    }
    if (resolviendoCiclo) return
    cargarPagos(
      alumnoSeleccionado.alumno_ref,
      cicloSeleccionado,
      cicloEscolarPagos
    )
  }, [
    alumnoSeleccionado,
    cicloSeleccionado,
    cicloEscolarPagos,
    resolviendoCiclo,
    cargarPagos,
  ])

  const etiquetaCicloPagos = useMemo(
    () => etiquetaCicloEscolar(cicloEscolarPagos, opcionesCatalogo),
    [cicloEscolarPagos, opcionesCatalogo]
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
        <section className="pc-panel-ciclo" aria-label="Ciclo escolar de pagos">
          <label htmlFor="ciclo-escolar-pagos" className="pc-ciclo-pagos-label">
            Ciclo escolar
          </label>
          <select
            id="ciclo-escolar-pagos"
            className="pc-ciclo-pagos-select"
            value={String(cicloEscolarPagos)}
            disabled={cargandoCiclos || opcionesCatalogo.length === 0}
            onChange={(e) => setCicloEscolarPagos(Number(e.target.value))}
            title="Muestra los pagos cuya referencia corresponde a este ciclo (posiciones 8-9)."
          >
            {opcionesCatalogo.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
                {o.valor === cicloActualSistema ? ' (activo)' : ''}
              </option>
            ))}
          </select>
        </section>
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

        <div className="pc-contenido-pagos">
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
              No hay pagos registrados para este alumno en {etiquetaCicloPagos}.
            </p>
          ) : (
            <>
            <div className="pc-tabla-scroll pc-vista-escritorio">
            <table className="pc-tabla">
              <colgroup>
                <col className="pc-w--num" />
                <col className="pc-w--concepto" />
                <col className="pc-w--monto" />
                <col className="pc-w--monto" />
                <col className="pc-w--fecha" />
                <col className="pc-w--ref" />
                <col className="pc-w--emisora" />
                <col className="pc-w--forma" />
                <col className="pc-w--estatus" />
                <col className="pc-w--acciones" />
              </colgroup>
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
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p, i) => {
                  const est = estatusVisualPago(p.pago_cancelado)
                  const etiquetaEst = etiquetaEstatusPago(p.pago_cancelado)
                  const busy = actualizandoId === p.pago_id
                  const concepto = conceptoDesdeReferencia(
                    p.pago_referencia,
                    mapaConceptos
                  )
                  return (
                    <tr key={p.pago_id} className={claseFilaEstatus(est)}>
                      <td className="pc-col--num">{i + 1}</td>
                      <td className="pc-col--concepto" title={concepto}>
                        <span className="pc-celda-ellipsis">{concepto}</span>
                      </td>
                      <td className="pc-col--monto">{formatearMonto(p.pago_importe)}</td>
                      <td className="pc-col--monto">{formatearMonto(p.pago_recargo)}</td>
                      <td className="pc-col--fecha">{p.pago_fecha ?? '—'}</td>
                      <td className="pc-col--ref">
                        <span className="pc-celda-ref">{p.pago_referencia ?? '—'}</span>
                      </td>
                      <td className="pc-col--emisora">{p.pago_emisora ?? 'S/E'}</td>
                      <td className="pc-col--forma" title={p.pago_forma ?? undefined}>
                        {p.pago_forma ?? '—'}
                      </td>
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
                        <AccionesPago
                          pago={p}
                          busy={busy}
                          onCambiarEstatus={cambiarEstatus}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
            <ul className="pc-pagos-movil" aria-label="Lista de pagos">
              {pagos.map((p, i) => {
                const est = estatusVisualPago(p.pago_cancelado)
                const etiquetaEst = etiquetaEstatusPago(p.pago_cancelado)
                const busy = actualizandoId === p.pago_id
                const concepto = conceptoDesdeReferencia(p.pago_referencia, mapaConceptos)
                return (
                  <li
                    key={p.pago_id}
                    className={`pc-pago-card ${claseFilaEstatus(est)}`}
                  >
                    <div className="pc-pago-card-cabecera">
                      <span className="pc-pago-card-num">#{i + 1}</span>
                      <p className="pc-pago-card-concepto">{concepto}</p>
                      {etiquetaEst ? (
                        <span className={`pc-estatus-badge pc-estatus-badge--${est}`}>
                          {etiquetaEst}
                        </span>
                      ) : null}
                    </div>
                    <dl className="pc-pago-card-datos">
                      <div>
                        <dt>Monto</dt>
                        <dd>{formatearMonto(p.pago_importe)}</dd>
                      </div>
                      <div>
                        <dt>Recargos</dt>
                        <dd>{formatearMonto(p.pago_recargo)}</dd>
                      </div>
                      <div>
                        <dt>Fecha</dt>
                        <dd>{p.pago_fecha ?? '—'}</dd>
                      </div>
                      <div className="pc-pago-card-datos--ancho">
                        <dt>Referencia</dt>
                        <dd className="pc-pago-card-ref">{p.pago_referencia ?? '—'}</dd>
                      </div>
                      <div>
                        <dt>Emisora</dt>
                        <dd>{p.pago_emisora ?? 'S/E'}</dd>
                      </div>
                      <div className="pc-pago-card-datos--ancho">
                        <dt>Forma de pago</dt>
                        <dd>{p.pago_forma ?? '—'}</dd>
                      </div>
                    </dl>
                    <AccionesPago
                      pago={p}
                      busy={busy}
                      onCambiarEstatus={cambiarEstatus}
                    />
                  </li>
                )
              })}
            </ul>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
