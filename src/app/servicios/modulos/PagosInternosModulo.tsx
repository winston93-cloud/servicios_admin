'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ListOrdered, Loader2, Plus, Printer, Settings2, Wallet } from 'lucide-react'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { useAuth } from '@/contexts/AuthContext'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import { nombreVisibleAlumno, ALUMNO_REF_EXTERNO } from '@/lib/alumnoBusquedaServicios'
import {
  alumnoTieneCuotaPadresPagada,
  crearPagoInterno,
  esConceptoManuales,
  listarConceptosInternos,
  ordenarConceptosAz,
  listarPagosPorAlumno,
  mensajeManualesRequiereCuotaPadres,
  nivelGradoDesdeAlumno,
  obtenerSiguienteFolioPago,
  resolverPlantelFolioPagoInterno,
  resolverPrecioInterno,
  type ConceptoInterno,
  type PagoInternoRegistro,
  type PlantelPagosInternos,
} from '@/lib/pagoInternoService'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import PagosInternosCatalogoModal from '../components/PagosInternosCatalogoModal'
import PagosInternosListadoModal from '../components/PagosInternosListadoModal'
import ValePagoInternoPrint, {
  imprimirValePagoInterno,
  type DatosValePagoInterno,
} from '../components/ValePagoInternoPrint'

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function PagosInternosModulo() {
  const { user } = useAuth()
  const { cicloSeleccionado, opcionesCatalogo } = useCicloEscolar()
  const { alumnoSeleccionado, setAlumnoSeleccionado, resolviendoCiclo } =
    useAlumnoSeleccionado()

  const [conceptos, setConceptos] = useState<ConceptoInterno[]>([])
  const [alumnoId, setAlumnoId] = useState<number | null>(null)
  const [pagos, setPagos] = useState<PagoInternoRegistro[]>([])
  const [cuotaPadresPagada, setCuotaPadresPagada] = useState(false)
  const [cargandoPagos, setCargandoPagos] = useState(false)

  const [folio, setFolio] = useState<number | ''>('')
  const [conceptoId, setConceptoId] = useState(0)
  const [conceptoOtro, setConceptoOtro] = useState('')
  const [importe, setImporte] = useState<number | ''>('')
  const [fechaPago, setFechaPago] = useState(hoyIso())
  const [cicloPago, setCicloPago] = useState(cicloSeleccionado)

  const [catalogoAbierto, setCatalogoAbierto] = useState(false)
  const [listadoAbierto, setListadoAbierto] = useState(false)
  const [valeImpresion, setValeImpresion] = useState<DatosValePagoInterno | null>(null)

  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const conceptosOrdenados = useMemo(() => ordenarConceptosAz(conceptos), [conceptos])

  const plantelSerieActual = useMemo((): PlantelPagosInternos => {
    return resolverPlantelFolioPagoInterno({
      alumnoRef: alumnoSeleccionado?.alumno_ref,
      alumnoNivel: alumnoSeleccionado?.alumno_nivel,
      usuarioUsername: user?.usuario_username,
    })
  }, [alumnoSeleccionado, user?.usuario_username])

  const refrescarFolio = useCallback(async (plantel: PlantelPagosInternos) => {
    setFolio(await obtenerSiguienteFolioPago(plantel))
  }, [])

  const recargarConceptos = useCallback(async () => {
    const lista = ordenarConceptosAz(await listarConceptosInternos(true))
    setConceptos(lista)
    if (lista.length) {
      setConceptoId((prev) => (prev === 0 ? lista[0].concepto_id : prev))
    }
  }, [])

  useEffect(() => {
    recargarConceptos()
  }, [recargarConceptos])

  useEffect(() => {
    void refrescarFolio(plantelSerieActual)
  }, [plantelSerieActual, refrescarFolio])

  useEffect(() => {
    setCicloPago(cicloSeleccionado)
  }, [cicloSeleccionado])

  useEffect(() => {
    if (alumnoId == null) return
    alumnoTieneCuotaPadresPagada(alumnoId, cicloPago).then(setCuotaPadresPagada)
  }, [alumnoId, cicloPago])

  const conceptoSeleccionado = useMemo(
    () => conceptosOrdenados.find((c) => c.concepto_id === conceptoId) ?? null,
    [conceptosOrdenados, conceptoId]
  )

  const bloqueoManualesSinCuota =
    conceptoSeleccionado != null &&
    esConceptoManuales(conceptoSeleccionado.concepto_id, conceptoSeleccionado.concepto_clase) &&
    !cuotaPadresPagada

  const cargarDatosAlumno = useCallback(
    async (ref: string, ciclo: number) => {
      setCargandoPagos(true)
      setError(null)
      // Preferir ficha del ciclo consultado; si no hay (pre-ingreso), tomar la existente
      // sin alterar estatus/ciclo/grado.
      const alumno =
        (await obtenerAlumnoPorRef(ref, ciclo)) ?? (await obtenerAlumnoPorRef(ref))
      if (!alumno) {
        setAlumnoId(null)
        setPagos([])
        setCuotaPadresPagada(false)
        setCargandoPagos(false)
        setError('No se encontró el alumno con ese número de control.')
        return
      }
      setAlumnoId(alumno.alumno_id)
      const [lista, cuota] = await Promise.all([
        listarPagosPorAlumno(alumno.alumno_id, ciclo),
        alumnoTieneCuotaPadresPagada(alumno.alumno_id, ciclo),
      ])
      setPagos(lista)
      setCuotaPadresPagada(cuota)
      setCargandoPagos(false)
    },
    []
  )

  useEffect(() => {
    if (!alumnoSeleccionado) {
      setAlumnoId(null)
      setPagos([])
      setCuotaPadresPagada(false)
      return
    }
    cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloSeleccionado)
  }, [alumnoSeleccionado, cicloSeleccionado, cargarDatosAlumno])

  const prepararValeImpresion = useCallback(
    async (
      conceptoIdPago: number,
      importePago: number,
      fecha: string,
      ciclo: number,
      conceptoExtra?: string
    ) => {
      if (!alumnoSeleccionado) return
      const alumno =
        (await obtenerAlumnoPorRef(
          alumnoSeleccionado.alumno_ref,
          cicloSeleccionado
        )) ?? (await obtenerAlumnoPorRef(alumnoSeleccionado.alumno_ref))
      if (!alumno) return

      const concepto =
        conceptosOrdenados.find((c) => c.concepto_id === conceptoIdPago)?.concepto_clase ?? ''

      const datos: DatosValePagoInterno = {
        fecha: fecha.slice(0, 10),
        importe: importePago,
        concepto,
        conceptoExtra,
        nombreAlumno: nombreVisibleAlumno(alumnoSeleccionado),
        alumnoApp: alumno.alumno_app,
        alumnoApm: alumno.alumno_apm,
        alumnoNombre:
          String(alumno.alumno_ref) === '11404'
            ? 'Externo'
            : alumno.alumno_nombre,
        alumnoNivel: alumno.alumno_nivel,
        alumnoGrado: alumno.alumno_grado ?? null,
        cicloEtiqueta: etiquetaCicloEscolar(ciclo, opcionesCatalogo),
      }
      setValeImpresion(datos)
      // Imprime con los datos ya armados (iframe), sin esperar el paint de React.
      imprimirValePagoInterno(datos)
    },
    [alumnoSeleccionado, cicloSeleccionado, conceptosOrdenados, opcionesCatalogo]
  )

  const onReimprimirPago = useCallback(
    async (pago: PagoInternoRegistro) => {
      if (!alumnoSeleccionado) {
        setError('Selecciona un alumno para reimprimir.')
        return
      }
      setError(null)
      setMensaje(null)
      const cicloVale = pago.pago_ciclo_escolar ?? cicloPago
      await prepararValeImpresion(
        pago.concepto_id,
        Number(pago.pago_importe),
        String(pago.pago_fecha ?? hoyIso()),
        cicloVale,
        pago.concepto_otro ?? undefined
      )
      setMensaje(`Reimpresión folio ${pago.pago_folio} (sin nuevo registro).`)
    },
    [alumnoSeleccionado, cicloPago, prepararValeImpresion]
  )

  const aplicarPrecioConcepto = useCallback(
    async (conceptoIdPago: number) => {
      if (!alumnoSeleccionado || conceptoIdPago <= 0) return
      const esExterno =
        String(alumnoSeleccionado.alumno_ref ?? '').trim() === ALUMNO_REF_EXTERNO
      const { nivel, grado } = nivelGradoDesdeAlumno(
        alumnoSeleccionado.alumno_nivel,
        alumnoSeleccionado.alumno_grado
      )
      const precio = await resolverPrecioInterno(
        conceptoIdPago,
        cicloPago,
        nivel,
        grado,
        { cualquierNivel: esExterno }
      )
      if (precio != null) setImporte(precio)
    },
    [alumnoSeleccionado, cicloPago]
  )

  const onCambioConcepto = useCallback(
    async (id: number) => {
      setConceptoId(id)
      await aplicarPrecioConcepto(id)
    },
    [aplicarPrecioConcepto]
  )

  // Al cambiar alumno o ciclo del pago, recalcular monto del concepto elegido.
  useEffect(() => {
    if (conceptoId > 0 && alumnoSeleccionado) {
      void aplicarPrecioConcepto(conceptoId)
    }
  }, [alumnoSeleccionado, cicloPago, conceptoId, aplicarPrecioConcepto])

  const onAgregarPago = async (e: React.FormEvent) => {
    e.preventDefault()
    if (alumnoId == null || conceptoId <= 0 || importe === '' || importe < 0) {
      setError('Completa alumno, concepto e importe.')
      return
    }

    const cuotaEnCiclo = await alumnoTieneCuotaPadresPagada(alumnoId, cicloPago)
    setCuotaPadresPagada(cuotaEnCiclo)
    if (
      conceptoSeleccionado &&
      esConceptoManuales(
        conceptoSeleccionado.concepto_id,
        conceptoSeleccionado.concepto_clase
      ) &&
      !cuotaEnCiclo
    ) {
      setError(mensajeManualesRequiereCuotaPadres())
      return
    }

    setGuardando(true)
    setMensaje(null)
    setError(null)

    const res = await crearPagoInterno({
      alumno_id: alumnoId,
      concepto_id: conceptoId,
      concepto_otro: conceptoOtro,
      pago_folio: folio === '' ? undefined : Number(folio),
      pago_importe: Number(importe),
      pago_fecha: fechaPago,
      pago_ciclo_escolar: cicloPago,
      plantel_serie: plantelSerieActual,
    })

    setGuardando(false)

    if (!res.ok) {
      setError(res.mensaje)
      return
    }

    setMensaje(`Pago registrado. Folio ${res.pago_folio}.`)
    await refrescarFolio(plantelSerieActual)
    if (alumnoSeleccionado) {
      await cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloSeleccionado)
    }
    await prepararValeImpresion(
      conceptoId,
      Number(importe),
      fechaPago,
      cicloPago,
      conceptoOtro
    )
  }

  const onCuotaPadresRapida = async () => {
    if (alumnoId == null) {
      setError('Selecciona un alumno primero.')
      return
    }
    const conceptoCuota = conceptosOrdenados.find((c) => c.concepto_id === 2) ?? conceptosOrdenados[0]
    if (!conceptoCuota) {
      setError('No hay concepto de cuota de padres en el catálogo.')
      return
    }
    const alumno =
      (await obtenerAlumnoPorRef(
        alumnoSeleccionado!.alumno_ref,
        cicloSeleccionado
      )) ?? (await obtenerAlumnoPorRef(alumnoSeleccionado!.alumno_ref))
    let monto = typeof importe === 'number' ? importe : 0
    if (alumno) {
      const esExterno = String(alumno.alumno_ref ?? '').trim() === ALUMNO_REF_EXTERNO
      const { nivel, grado } = nivelGradoDesdeAlumno(alumno.alumno_nivel, alumno.alumno_grado)
      const precio = await resolverPrecioInterno(
        conceptoCuota.concepto_id,
        cicloPago,
        nivel,
        grado,
        { cualquierNivel: esExterno }
      )
      if (precio != null) monto = precio
    }
    setGuardando(true)
    const plantelCuota = resolverPlantelFolioPagoInterno({
      alumnoRef: alumnoSeleccionado?.alumno_ref,
      alumnoNivel: alumno?.alumno_nivel ?? alumnoSeleccionado?.alumno_nivel,
      usuarioUsername: user?.usuario_username,
    })
    const res = await crearPagoInterno({
      alumno_id: alumnoId,
      concepto_id: conceptoCuota.concepto_id,
      pago_importe: monto,
      pago_fecha: fechaPago,
      pago_ciclo_escolar: cicloPago,
      plantel_serie: plantelCuota,
    })
    setGuardando(false)
    if (!res.ok) {
      setError(res.mensaje)
      return
    }
    setMensaje(`Cuota de padres registrada. Folio ${res.pago_folio}.`)
    await refrescarFolio(plantelCuota)
    if (alumnoSeleccionado) {
      await cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloSeleccionado)
    }
    await prepararValeImpresion(
      conceptoCuota.concepto_id,
      monto,
      fechaPago,
      cicloPago
    )
  }

  const nombreAlumno = alumnoSeleccionado
    ? nombreVisibleAlumno(alumnoSeleccionado)
    : ''

  return (
    <div className="servicios-panel-inner servicios-panel-inner--pagos-internos">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Pagos internos</h1>
        <div className="pi-header-acciones">
          <button
            type="button"
            className="pi-btn pi-btn--secondary pi-btn--catalogo"
            onClick={() => setCatalogoAbierto(true)}
          >
            <Settings2 size={16} aria-hidden />
            Conceptos y precios
          </button>
          <button
            type="button"
            className="pi-btn pi-btn--secondary pi-btn--listado"
            onClick={() => setListadoAbierto(true)}
          >
            <ListOrdered size={16} aria-hidden />
            Listado de pagos internos
          </button>
        </div>
      </header>

      <div className="pi-busqueda-fila">
        <div className="pi-busqueda-fila__buscar">
          <AlumnoAutocomplete
            etiqueta="Nombre del alumno / No. control"
            alumnoSeleccionado={alumnoSeleccionado}
            onSeleccionar={setAlumnoSeleccionado}
            autoFocus
            cualquierCiclo
          />
        </div>
        {alumnoSeleccionado && !resolviendoCiclo && !cargandoPagos && (
          <aside className="pi-cuota-top" aria-labelledby="pi-cuota-titulo">
            <h2 id="pi-cuota-titulo" className="pi-cuota-top-titulo">
              Cuota de padres
            </h2>
            <label className="pi-check pi-check--compact">
              <input type="checkbox" checked={cuotaPadresPagada} readOnly />
              <span>
                Pagada
                {cuotaPadresPagada
                  ? ` (${etiquetaCicloEscolar(cicloPago, opcionesCatalogo) || 'ciclo del pago'})`
                  : ` — falta en ${etiquetaCicloEscolar(cicloPago, opcionesCatalogo) || 'este ciclo'}`}
              </span>
            </label>
            {!cuotaPadresPagada && (
              <button
                type="button"
                className="pi-btn pi-btn--secondary pi-btn--sm"
                disabled={guardando || alumnoId == null}
                onClick={onCuotaPadresRapida}
              >
                Registrar cuota
              </button>
            )}
          </aside>
        )}
      </div>

      {(resolviendoCiclo || cargandoPagos) && (
        <div className="pi-loading" role="status">
          <Loader2 size={22} className="pi-spin" aria-hidden />
          <span>Cargando alumno y pagos…</span>
        </div>
      )}

      {!alumnoSeleccionado && !resolviendoCiclo && (
        <div className="servicios-panel-card pi-empty">
          <Wallet size={28} strokeWidth={1.5} aria-hidden />
          <p>Selecciona un alumno para registrar o consultar pagos internos.</p>
        </div>
      )}

      {alumnoSeleccionado && !resolviendoCiclo && !cargandoPagos && (
        <>
          <div className="pi-tarjetas">
            <section className="pi-tarjeta" aria-labelledby="pi-anadir-titulo">
              <h2 id="pi-anadir-titulo" className="pi-tarjeta-titulo">
                Añadir pago
              </h2>
              <form className="pi-form" onSubmit={onAgregarPago}>
                <label>
                  Alumno
                  <input type="text" readOnly value={nombreAlumno} className="pi-input pi-input--ro" />
                </label>
                <label>
                  Folio
                  <input
                    type="number"
                    min={26550}
                    className="pi-input pi-input--ro"
                    value={folio}
                    readOnly
                    title="Asignado automáticamente (desde 26550)"
                    aria-label="Folio del recibo (automático)"
                  />
                </label>
                <label>
                  Concepto
                  <select
                    className="pi-select"
                    value={conceptoId || ''}
                    onChange={(e) => onCambioConcepto(Number(e.target.value))}
                  >
                    <option value="">No seleccionado</option>
                    {conceptosOrdenados.map((c) => (
                      <option key={c.concepto_id} value={c.concepto_id}>
                        {c.concepto_clase}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Concepto extra
                  <input
                    type="text"
                    className="pi-input"
                    maxLength={50}
                    placeholder="Texto extra al concepto…"
                    value={conceptoOtro}
                    onChange={(e) => setConceptoOtro(e.target.value)}
                  />
                </label>
                <label>
                  Monto
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="pi-input"
                    value={importe}
                    onChange={(e) =>
                      setImporte(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  />
                </label>
                <label>
                  Fecha de pago
                  <input
                    type="date"
                    className="pi-input"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                  />
                </label>
                <label>
                  Ciclo escolar
                  <select
                    className="pi-select"
                    value={String(cicloPago)}
                    onChange={(e) => setCicloPago(Number(e.target.value))}
                  >
                    {opcionesCatalogo.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
                {bloqueoManualesSinCuota && (
                  <p className="pi-msg pi-msg--error" role="alert">
                    {mensajeManualesRequiereCuotaPadres()}
                  </p>
                )}
                <button
                  type="submit"
                  className="pi-btn pi-btn--primary"
                  disabled={guardando || bloqueoManualesSinCuota}
                >
                  {guardando ? (
                    <Loader2 size={18} className="pi-spin" aria-hidden />
                  ) : (
                    <Plus size={18} aria-hidden />
                  )}
                  Guardar/Imprimir
                </button>
              </form>
            </section>

            <section className="pi-tarjeta pi-tarjeta--historial" aria-label="Pagos del alumno">
              <h2 className="pi-tarjeta-titulo">Pagos registrados (ciclo de consulta)</h2>
              {pagos.length === 0 ? (
                <p className="pi-hint">Sin pagos internos en este ciclo.</p>
              ) : (
                <div className="pi-historial-tabla-wrap">
                  <table className="pi-historial-tabla">
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Concepto</th>
                        <th>Extra</th>
                        <th>Monto</th>
                        <th>Fecha</th>
                        <th className="pi-historial-col-accion">Recibo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagos.map((p) => (
                        <tr key={p.pago_id}>
                          <td>{p.pago_folio}</td>
                          <td>
                            {conceptosOrdenados.find((c) => c.concepto_id === p.concepto_id)
                              ?.concepto_clase ?? p.concepto_id}
                          </td>
                          <td>{p.concepto_otro ?? '—'}</td>
                          <td>${Number(p.pago_importe).toFixed(2)}</td>
                          <td>{p.pago_fecha?.slice(0, 10) ?? '—'}</td>
                          <td className="pi-historial-col-accion">
                            <button
                              type="button"
                              className="pi-icon-btn pi-icon-btn--print"
                              title={`Reimprimir folio ${p.pago_folio}`}
                              aria-label={`Reimprimir recibo folio ${p.pago_folio}`}
                              onClick={() => onReimprimirPago(p)}
                            >
                              <Printer size={16} aria-hidden />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {(mensaje || error) && (
            <p className={`pi-msg ${error ? 'pi-msg--error' : 'pi-msg--ok'}`} role="status">
              {error ?? mensaje}
            </p>
          )}
        </>
      )}

      <PagosInternosCatalogoModal
        abierto={catalogoAbierto}
        onCerrar={() => setCatalogoAbierto(false)}
        onActualizado={recargarConceptos}
      />

      <PagosInternosListadoModal
        abierto={listadoAbierto}
        onCerrar={() => setListadoAbierto(false)}
      />

      <ValePagoInternoPrint datos={valeImpresion} />
    </div>
  )
}
