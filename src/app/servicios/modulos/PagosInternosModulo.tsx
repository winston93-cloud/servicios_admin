'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Settings2, Wallet } from 'lucide-react'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import {
  alumnoTieneCuotaPadresPagada,
  crearPagoInterno,
  esConceptoManuales,
  listarConceptosInternos,
  listarPagosPorAlumno,
  mensajeManualesRequiereCuotaPadres,
  nivelGradoDesdeAlumno,
  obtenerSiguienteFolioPago,
  resolverPrecioInterno,
  type ConceptoInterno,
  type PagoInternoRegistro,
} from '@/lib/pagoInternoService'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import PagosInternosCatalogoModal from '../components/PagosInternosCatalogoModal'
import ValePagoInternoPrint, {
  imprimirValePagoInterno,
  type DatosValePagoInterno,
} from '../components/ValePagoInternoPrint'

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  abrirCatalogoInicial?: boolean
}

export default function PagosInternosModulo({ abrirCatalogoInicial = false }: Props) {
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

  const [catalogoAbierto, setCatalogoAbierto] = useState(abrirCatalogoInicial)
  const [valeImpresion, setValeImpresion] = useState<DatosValePagoInterno | null>(null)

  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargarConceptos = useCallback(async () => {
    const lista = await listarConceptosInternos(true)
    setConceptos(lista)
    if (lista.length) {
      setConceptoId((prev) => (prev === 0 ? lista[0].concepto_id : prev))
    }
  }, [])

  useEffect(() => {
    recargarConceptos()
    obtenerSiguienteFolioPago().then((f) => setFolio(f))
  }, [recargarConceptos])

  useEffect(() => {
    setCicloPago(cicloSeleccionado)
  }, [cicloSeleccionado])

  useEffect(() => {
    if (alumnoId == null) return
    alumnoTieneCuotaPadresPagada(alumnoId, cicloPago).then(setCuotaPadresPagada)
  }, [alumnoId, cicloPago])

  const conceptoSeleccionado = useMemo(
    () => conceptos.find((c) => c.concepto_id === conceptoId) ?? null,
    [conceptos, conceptoId]
  )

  const bloqueoManualesSinCuota =
    conceptoSeleccionado != null &&
    esConceptoManuales(conceptoSeleccionado.concepto_id, conceptoSeleccionado.concepto_clase) &&
    !cuotaPadresPagada

  const cargarDatosAlumno = useCallback(
    async (ref: string, ciclo: number) => {
      setCargandoPagos(true)
      setError(null)
      const alumno = await obtenerAlumnoPorRef(ref, ciclo)
      if (!alumno) {
        setAlumnoId(null)
        setPagos([])
        setCuotaPadresPagada(false)
        setCargandoPagos(false)
        setError('El alumno no tiene registro en el ciclo de consulta.')
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
      const alumno = await obtenerAlumnoPorRef(
        alumnoSeleccionado.alumno_ref,
        cicloSeleccionado
      )
      if (!alumno) return

      const concepto =
        conceptos.find((c) => c.concepto_id === conceptoIdPago)?.concepto_clase ?? ''

      setValeImpresion({
        fecha,
        importe: importePago,
        concepto,
        conceptoExtra,
        nombreAlumno: alumnoSeleccionado.nombre_completo,
        alumnoApp: alumno.alumno_app,
        alumnoApm: alumno.alumno_apm,
        alumnoNombre: alumno.alumno_nombre,
        alumnoNivel: alumno.alumno_nivel,
        alumnoGrado: alumno.alumno_grado ?? null,
        cicloEtiqueta: etiquetaCicloEscolar(ciclo, opcionesCatalogo),
      })
      imprimirValePagoInterno()
    },
    [alumnoSeleccionado, cicloSeleccionado, conceptos, opcionesCatalogo]
  )

  const onCambioConcepto = useCallback(
    async (id: number) => {
      setConceptoId(id)
      if (!alumnoSeleccionado || id <= 0) return
      const alumno = await obtenerAlumnoPorRef(
        alumnoSeleccionado.alumno_ref,
        cicloSeleccionado
      )
      if (!alumno) return
      const { nivel, grado } = nivelGradoDesdeAlumno(alumno.alumno_nivel, alumno.alumno_grado)
      const precio = await resolverPrecioInterno(id, cicloPago, nivel, grado)
      if (precio != null) setImporte(precio)
    },
    [alumnoSeleccionado, cicloSeleccionado, cicloPago]
  )

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
    })

    setGuardando(false)

    if (!res.ok) {
      setError(res.mensaje)
      return
    }

    setMensaje(`Pago registrado. Folio ${res.pago_folio}.`)
    setFolio(await obtenerSiguienteFolioPago())
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
    const conceptoCuota = conceptos.find((c) => c.concepto_id === 2) ?? conceptos[0]
    if (!conceptoCuota) {
      setError('No hay concepto de cuota de padres en el catálogo.')
      return
    }
    const alumno = await obtenerAlumnoPorRef(
      alumnoSeleccionado!.alumno_ref,
      cicloSeleccionado
    )
    let monto = typeof importe === 'number' ? importe : 0
    if (alumno) {
      const { nivel, grado } = nivelGradoDesdeAlumno(alumno.alumno_nivel, alumno.alumno_grado)
      const precio = await resolverPrecioInterno(
        conceptoCuota.concepto_id,
        cicloPago,
        nivel,
        grado
      )
      if (precio != null) monto = precio
    }
    setGuardando(true)
    const res = await crearPagoInterno({
      alumno_id: alumnoId,
      concepto_id: conceptoCuota.concepto_id,
      pago_importe: monto,
      pago_fecha: fechaPago,
      pago_ciclo_escolar: cicloPago,
    })
    setGuardando(false)
    if (!res.ok) {
      setError(res.mensaje)
      return
    }
    setMensaje('Cuota de padres registrada.')
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

  const nombreAlumno = alumnoSeleccionado?.nombre_completo ?? ''

  return (
    <div className="servicios-panel-inner servicios-panel-inner--pagos-internos">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Pagos internos</h1>
        <button
          type="button"
          className="pi-btn pi-btn--secondary pi-btn--catalogo"
          onClick={() => setCatalogoAbierto(true)}
        >
          <Settings2 size={18} aria-hidden />
          Conceptos y precios
        </button>
      </header>

      <AlumnoAutocomplete
        etiqueta="Nombre del alumno / No. control"
        alumnoSeleccionado={alumnoSeleccionado}
        onSeleccionar={setAlumnoSeleccionado}
        autoFocus
      />

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
                    min={1}
                    className="pi-input"
                    value={folio}
                    onChange={(e) =>
                      setFolio(e.target.value === '' ? '' : Number(e.target.value))
                    }
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
                    {conceptos.map((c) => (
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
                  Agregar pago
                </button>
              </form>
            </section>

            <section className="pi-tarjeta pi-tarjeta--cuota" aria-labelledby="pi-cuota-titulo">
              <h2 id="pi-cuota-titulo" className="pi-tarjeta-titulo">
                Cuota de padres
              </h2>
              <label className="pi-check pi-check--grande">
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
                  className="pi-btn pi-btn--secondary"
                  disabled={guardando || alumnoId == null}
                  onClick={onCuotaPadresRapida}
                >
                  Registrar cuota de padres
                </button>
              )}
            </section>
          </div>

          {(mensaje || error) && (
            <p className={`pi-msg ${error ? 'pi-msg--error' : 'pi-msg--ok'}`} role="status">
              {error ?? mensaje}
            </p>
          )}

          <section className="pi-historial" aria-label="Pagos del alumno">
            <h2 className="pi-historial-titulo">Pagos registrados (ciclo de consulta)</h2>
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
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map((p) => (
                      <tr key={p.pago_id}>
                        <td>{p.pago_folio}</td>
                        <td>
                          {conceptos.find((c) => c.concepto_id === p.concepto_id)?.concepto_clase ??
                            p.concepto_id}
                        </td>
                        <td>{p.concepto_otro ?? '—'}</td>
                        <td>${Number(p.pago_importe).toFixed(2)}</td>
                        <td>{p.pago_fecha ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <PagosInternosCatalogoModal
        abierto={catalogoAbierto}
        onCerrar={() => setCatalogoAbierto(false)}
        onActualizado={recargarConceptos}
      />

      <ValePagoInternoPrint datos={valeImpresion} />
    </div>
  )
}
