'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ListOrdered, Loader2, Plus, Printer, Settings2, Wallet, Trash2 } from 'lucide-react'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { useAuth } from '@/contexts/AuthContext'
import { useAlumnoSeleccionado } from '@/contexts/AlumnoSeleccionadoContext'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { obtenerAlumnoPorRef } from '@/lib/alumnoDatosService'
import { nombreVisibleAlumno, ALUMNO_REF_EXTERNO } from '@/lib/alumnoBusquedaServicios'
import {
  alumnoTieneCuotaPadresPagada,
  CONCEPTO_ID_CUOTA_PADRES,
  CONCEPTO_ID_MANUALES,
  crearPagoInterno,
  cancelarPagoInternoSolo,
  cancelarPagoInternoYRecorrer,
  esConceptoCuotaPadresMasManuales,
  esConceptoManuales,
  esConceptoSerieCuotaPadres,
  listarConceptosInternos,
  ordenarConceptosAz,
  listarPagosPorAlumno,
  mensajeManualesRequiereCuotaPadres,
  nivelGradoDesdeAlumno,
  obtenerSiguienteFolioPago,
  repararFoliosWinstonTrasReinicio2671,
  resolverPlantelFolioPagoInterno,
  resolverPrecioInterno,
  resolverPreciosCuotaYManuales,
  type ConceptoInterno,
  type ModoCancelacionPagoInterno,
  type PagoInternoRegistro,
  type PlantelPagosInternos,
  type TipoSerieFolioPagoInterno,
} from '@/lib/pagoInternoService'
import AlumnoAutocomplete from '../components/AlumnoAutocomplete'
import PagosInternosCatalogoModal from '../components/PagosInternosCatalogoModal'
import PagosInternosCancelarModal from '../components/PagosInternosCancelarModal'
import PagosInternosListadoModal from '../components/PagosInternosListadoModal'
import ValePagoInternoPrint, {
  imprimirValePagoInterno,
  imprimirVariosValesPagoInterno,
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
  const [pagoCancelar, setPagoCancelar] = useState<PagoInternoRegistro | null>(null)
  const [cancelando, setCancelando] = useState(false)

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

  const tipoSerieFolioActual = useMemo((): TipoSerieFolioPagoInterno => {
    if (esConceptoSerieCuotaPadres(conceptoId)) return 'cuota_padres'
    return 'general'
  }, [conceptoId])

  const refrescarFolio = useCallback(
    async (plantel: PlantelPagosInternos, tipoSerie: TipoSerieFolioPagoInterno = 'general') => {
      setFolio(await obtenerSiguienteFolioPago(plantel, tipoSerie))
    },
    []
  )

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
    void refrescarFolio(plantelSerieActual, tipoSerieFolioActual)
  }, [plantelSerieActual, tipoSerieFolioActual, refrescarFolio])

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

  const esComboCuotaManuales =
    conceptoSeleccionado != null &&
    esConceptoCuotaPadresMasManuales(
      conceptoSeleccionado.concepto_id,
      conceptoSeleccionado.concepto_clase
    )

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
    cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloPago)
  }, [alumnoSeleccionado, cicloPago, cargarDatosAlumno])

  // Una sola vez por carga: revalida consecutivo Winston desde 2848 (API admin).
  useEffect(() => {
    let cancelado = false
    void (async () => {
      try {
        const r = await fetch('/api/servicios/reparar-folios-winston', {
          method: 'POST',
          cache: 'no-store',
        })
        const res = (await r.json()) as {
          ok?: boolean
          aplicada?: boolean
          mensaje?: string
        }
        if (cancelado) return
        if (!r.ok || res.ok === false) {
          // Fallback cliente si la API falla
          const local = await repararFoliosWinstonTrasReinicio2671()
          if (cancelado) return
          if (!local.ok) {
            setError(local.mensaje)
            return
          }
          setMensaje(local.mensaje)
          if (local.aplicada && alumnoSeleccionado) {
            await cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloPago)
          }
          await refrescarFolio(plantelSerieActual, tipoSerieFolioActual)
          return
        }
        setMensaje(res.mensaje ?? 'Folios revisados.')
        if (res.aplicada && alumnoSeleccionado) {
          await cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloPago)
        }
        await refrescarFolio(plantelSerieActual, tipoSerieFolioActual)
      } catch (e) {
        if (cancelado) return
        const local = await repararFoliosWinstonTrasReinicio2671()
        if (cancelado) return
        if (!local.ok) {
          setError(local.mensaje)
          return
        }
        setMensaje(local.mensaje)
        await refrescarFolio(plantelSerieActual, tipoSerieFolioActual)
        if (local.aplicada && alumnoSeleccionado) {
          await cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloPago)
        }
      }
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- montaje único
  }, [])

  const prepararValeImpresion = useCallback(
    async (
      conceptoIdPago: number,
      importePago: number,
      fecha: string,
      ciclo: number,
      conceptoExtra?: string
    ): Promise<DatosValePagoInterno | null> => {
      if (!alumnoSeleccionado) return null
      const alumno =
        (await obtenerAlumnoPorRef(alumnoSeleccionado.alumno_ref, ciclo)) ??
        (await obtenerAlumnoPorRef(alumnoSeleccionado.alumno_ref))
      if (!alumno) return null

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
      return datos
    },
    [alumnoSeleccionado, conceptosOrdenados, opcionesCatalogo]
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
      const datos = await prepararValeImpresion(
        pago.concepto_id,
        Number(pago.pago_importe),
        String(pago.pago_fecha ?? hoyIso()),
        cicloVale,
        pago.concepto_otro ?? undefined
      )
      if (datos) imprimirValePagoInterno(datos)
      setMensaje(`Reimpresión folio ${pago.pago_folio} (sin nuevo registro).`)
    },
    [alumnoSeleccionado, cicloPago, prepararValeImpresion]
  )

  const onConfirmarCancelacion = useCallback(
    async (modo: ModoCancelacionPagoInterno) => {
      if (!pagoCancelar) return
      setCancelando(true)
      setError(null)
      setMensaje(null)
      try {
        const res =
          modo === 'solo'
            ? await cancelarPagoInternoSolo({
                pagoId: pagoCancelar.pago_id,
                motivo: 'admin',
              })
            : await cancelarPagoInternoYRecorrer({
                pagoId: pagoCancelar.pago_id,
                motivo: 'recorrido',
              })

        if (!res.ok) {
          setError(res.mensaje)
          return
        }

        setMensaje(res.mensaje)
        setPagoCancelar(null)
        if (alumnoSeleccionado) {
          await cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloPago)
        }
        await refrescarFolio(plantelSerieActual, tipoSerieFolioActual)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cancelar el pago')
      } finally {
        setCancelando(false)
      }
    },
    [
      pagoCancelar,
      alumnoSeleccionado,
      cicloPago,
      cargarDatosAlumno,
      refrescarFolio,
      plantelSerieActual,
      tipoSerieFolioActual,
    ]
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
      const concepto = conceptosOrdenados.find((c) => c.concepto_id === conceptoIdPago)
      if (
        concepto &&
        esConceptoCuotaPadresMasManuales(concepto.concepto_id, concepto.concepto_clase)
      ) {
        const partes = await resolverPreciosCuotaYManuales(cicloPago, nivel, grado, {
          cualquierNivel: esExterno,
        })
        if (partes) setImporte(partes.total)
        return
      }
      const precio = await resolverPrecioInterno(
        conceptoIdPago,
        cicloPago,
        nivel,
        grado,
        { cualquierNivel: esExterno }
      )
      if (precio != null) setImporte(precio)
    },
    [alumnoSeleccionado, cicloPago, conceptosOrdenados]
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

    // Combo legacy: 2 registros (cuota + manuales) y 2 recibos (orig+copia c/u).
    if (
      conceptoSeleccionado &&
      esConceptoCuotaPadresMasManuales(
        conceptoSeleccionado.concepto_id,
        conceptoSeleccionado.concepto_clase
      )
    ) {
      const esExterno =
        String(alumnoSeleccionado?.alumno_ref ?? '').trim() === ALUMNO_REF_EXTERNO
      const { nivel, grado } = nivelGradoDesdeAlumno(
        alumnoSeleccionado?.alumno_nivel,
        alumnoSeleccionado?.alumno_grado
      )
      const partes = await resolverPreciosCuotaYManuales(cicloPago, nivel, grado, {
        cualquierNivel: esExterno,
      })
      if (!partes) {
        setGuardando(false)
        setError(
          'No hay precio de cuota de padres o manuales para el nivel/grado de este alumno.'
        )
        return
      }

      const resCuota = await crearPagoInterno({
        alumno_id: alumnoId,
        concepto_id: CONCEPTO_ID_CUOTA_PADRES,
        concepto_otro: conceptoOtro,
        pago_importe: partes.cuota,
        pago_fecha: fechaPago,
        pago_ciclo_escolar: cicloPago,
        plantel_serie: plantelSerieActual,
        tipo_serie_folio: 'cuota_padres',
      })
      if (!resCuota.ok) {
        setGuardando(false)
        setError(resCuota.mensaje)
        return
      }

      const resManuales = await crearPagoInterno({
        alumno_id: alumnoId,
        concepto_id: CONCEPTO_ID_MANUALES,
        concepto_otro: conceptoOtro,
        pago_importe: partes.manuales,
        pago_fecha: fechaPago,
        pago_ciclo_escolar: cicloPago,
        plantel_serie: plantelSerieActual,
        tipo_serie_folio: 'general',
      })
      setGuardando(false)
      if (!resManuales.ok) {
        setError(
          `Cuota registrada (folio ${resCuota.pago_folio}), pero falló manuales: ${resManuales.mensaje}`
        )
        await refrescarFolio(plantelSerieActual, tipoSerieFolioActual)
        if (alumnoSeleccionado) {
          await cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloPago)
        }
        return
      }

      setMensaje(
        `Combo registrado. Cuota folio ${resCuota.pago_folio} ($${partes.cuota.toFixed(2)}) · Manuales folio ${resManuales.pago_folio} ($${partes.manuales.toFixed(2)})${
          resCuota.hermanos_cuota
            ? ` · Cuota replicada a ${resCuota.hermanos_cuota} hermano(s) mismo nivel`
            : ''
        }.`
      )
      await refrescarFolio(plantelSerieActual, tipoSerieFolioActual)
      if (alumnoSeleccionado) {
        await cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloPago)
      }

      const [valeCuota, valeManuales] = await Promise.all([
        prepararValeImpresion(
          CONCEPTO_ID_CUOTA_PADRES,
          partes.cuota,
          fechaPago,
          cicloPago,
          conceptoOtro
        ),
        prepararValeImpresion(
          CONCEPTO_ID_MANUALES,
          partes.manuales,
          fechaPago,
          cicloPago,
          conceptoOtro
        ),
      ])
      const vales = [valeCuota, valeManuales].filter(Boolean) as DatosValePagoInterno[]
      if (vales.length) imprimirVariosValesPagoInterno(vales)
      return
    }

    const res = await crearPagoInterno({
      alumno_id: alumnoId,
      concepto_id: conceptoId,
      concepto_otro: conceptoOtro,
      pago_folio: folio === '' ? undefined : Number(folio),
      pago_importe: Number(importe),
      pago_fecha: fechaPago,
      pago_ciclo_escolar: cicloPago,
      plantel_serie: plantelSerieActual,
      tipo_serie_folio: tipoSerieFolioActual,
    })

    setGuardando(false)

    if (!res.ok) {
      setError(res.mensaje)
      return
    }

    setMensaje(
      `Pago registrado. Folio ${res.pago_folio}.${
        res.hermanos_cuota
          ? ` Cuota replicada a ${res.hermanos_cuota} hermano(s) del mismo nivel (mismo folio).`
          : ''
      }`
    )
    await refrescarFolio(plantelSerieActual, tipoSerieFolioActual)
    if (alumnoSeleccionado) {
      await cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloPago)
    }
    const vale = await prepararValeImpresion(
      conceptoId,
      Number(importe),
      fechaPago,
      cicloPago,
      conceptoOtro
    )
    if (vale) imprimirValePagoInterno(vale)
  }

  const onCuotaPadresRapida = async () => {
    if (alumnoId == null) {
      setError('Selecciona un alumno primero.')
      return
    }
    const conceptoCuota =
      conceptosOrdenados.find((c) => c.concepto_id === CONCEPTO_ID_CUOTA_PADRES) ??
      conceptosOrdenados[0]
    if (!conceptoCuota) {
      setError('No hay concepto de cuota de padres en el catálogo.')
      return
    }
    const alumno =
      (await obtenerAlumnoPorRef(alumnoSeleccionado!.alumno_ref, cicloPago)) ??
      (await obtenerAlumnoPorRef(alumnoSeleccionado!.alumno_ref))
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
      tipo_serie_folio: 'cuota_padres',
    })
    setGuardando(false)
    if (!res.ok) {
      setError(res.mensaje)
      return
    }
    setMensaje(
      `Cuota de padres registrada. Folio ${res.pago_folio}.${
        res.hermanos_cuota
          ? ` Replicada a ${res.hermanos_cuota} hermano(s) del mismo nivel (mismo folio).`
          : ''
      }`
    )
    await refrescarFolio(plantelSerieActual, tipoSerieFolioActual)
    if (alumnoSeleccionado) {
      await cargarDatosAlumno(alumnoSeleccionado.alumno_ref, cicloPago)
    }
    const vale = await prepararValeImpresion(
      conceptoCuota.concepto_id,
      monto,
      fechaPago,
      cicloPago
    )
    if (vale) imprimirValePagoInterno(vale)
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
                    className="pi-input pi-input--ro"
                    value={folio}
                    readOnly
                    title={
                      esComboCuotaManuales
                        ? 'Cuota usa serie propia; manuales usan serie general del plantel'
                        : tipoSerieFolioActual === 'cuota_padres'
                          ? `Serie cuota de padres (${plantelSerieActual === 'educativo' ? 'desde 1037' : 'desde 2140'})`
                          : `Serie general ${plantelSerieActual === 'educativo' ? '(desde 2849)' : '(desde 2671)'}`
                    }
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
                {esComboCuotaManuales && (
                  <p className="pi-hint" role="note">
                    Este concepto registra e imprime dos recibos: cuota de padres
                    y manuales (cada uno original + copia), con el precio de su
                    nivel y grado.
                  </p>
                )}
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
              <h2 className="pi-tarjeta-titulo">
                Pagos registrados (
                {etiquetaCicloEscolar(cicloPago, opcionesCatalogo) || 'ciclo del pago'})
              </h2>
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
                        <th>Estado</th>
                        <th className="pi-historial-col-accion">Recibo</th>
                        <th className="pi-historial-col-accion">Cancelar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagos.map((p) => {
                        const cancelado = Number(p.pago_cancelado) === 1
                        return (
                        <tr
                          key={p.pago_id}
                          className={cancelado ? 'pi-historial-fila--cancelado' : undefined}
                        >
                          <td>{p.pago_folio}</td>
                          <td>
                            {conceptosOrdenados.find((c) => c.concepto_id === p.concepto_id)
                              ?.concepto_clase ?? p.concepto_id}
                          </td>
                          <td>{p.concepto_otro ?? '—'}</td>
                          <td>${Number(p.pago_importe).toFixed(2)}</td>
                          <td>{p.pago_fecha?.slice(0, 10) ?? '—'}</td>
                          <td>
                            {cancelado ? (
                              <span className="pi-historial-estado pi-historial-estado--cancelado">
                                Cancelado
                              </span>
                            ) : (
                              <span className="pi-historial-estado pi-historial-estado--vigente">
                                Vigente
                              </span>
                            )}
                          </td>
                          <td className="pi-historial-col-accion">
                            <button
                              type="button"
                              className="pi-icon-btn pi-icon-btn--print"
                              title={`Reimprimir folio ${p.pago_folio}`}
                              aria-label={`Reimprimir recibo folio ${p.pago_folio}`}
                              disabled={cancelado}
                              onClick={() => onReimprimirPago(p)}
                            >
                              <Printer size={16} aria-hidden />
                            </button>
                          </td>
                          <td className="pi-historial-col-accion">
                            {cancelado ? (
                              <span className="pi-historial-accion-vacia" aria-hidden>
                                —
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="pi-icon-btn pi-icon-btn--cancel"
                                title={`Cancelar folio ${p.pago_folio}`}
                                aria-label={`Cancelar folio ${p.pago_folio}`}
                                onClick={() => {
                                  setError(null)
                                  setMensaje(null)
                                  setPagoCancelar(p)
                                }}
                              >
                                <Trash2 size={16} aria-hidden />
                              </button>
                            )}
                          </td>
                        </tr>
                        )
                      })}
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

      <PagosInternosCancelarModal
        abierto={pagoCancelar != null}
        pago={pagoCancelar}
        conceptoEtiqueta={
          pagoCancelar
            ? conceptosOrdenados.find((c) => c.concepto_id === pagoCancelar.concepto_id)
                ?.concepto_clase ?? undefined
            : undefined
        }
        procesando={cancelando}
        onCerrar={() => {
          if (!cancelando) setPagoCancelar(null)
        }}
        onConfirmar={(modo) => void onConfirmarCancelacion(modo)}
      />

      <ValePagoInternoPrint datos={valeImpresion} />
    </div>
  )
}
