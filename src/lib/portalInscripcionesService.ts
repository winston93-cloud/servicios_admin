import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import { esEstatusBloqueo } from './alumnoStatus'
import type { CicloEscolarRegistro } from './ciclosEscolaresService'
import { etiquetaGradoEscolar } from './gradoEscolar'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import {
  formatearAlumnoRefParaReferencia,
  normalizarConceptoNo,
  parsearReferenciaPago,
} from './pagoReferenciaColegiatura'
import { esDeudorReinscrito } from './portalAdmisionesDeudor'
import { resumenCierreCicloParaReinscrito } from './portalCierreCicloAnterior'
import { resumenAdeudoDobleTitulacionCiclo } from './portalDobleTitulacionAdeudo'
import {
  evaluarVentanaPortalNuevoIngreso,
  evaluarVentanaPortalReinscrito,
  puedeVerPasosInscripcion,
} from './portalAdmisionesEstadoService'
import { urlReglamentoEscolarLegacy } from './portalAdmisionesConfig'
import { requiereDocumentosAdmision } from './portalDocumentosAdmision'
import { documentosNiYaEnviados } from './portalDocumentosNiService'
import {
  hrefReglamentoArchivo,
  obtenerReglamento,
} from './reglamentosEscolaresService'
import { construirFilasInscripcionPortal } from './portalPagosMatrizService'
import { resolverCicloPagoInscripcionPortal } from './portalInscripcionesCiclo'
import { calcularReinscripcionDiferido } from './portalReinscripcionService'
import {
  evaluarSolicitudCapturada,
  inscripcionCompletaPagada,
} from './portalInscripcionesSolicitud'
import { getPaymentConcept } from './boucherCore'
import { rutasFacturaDesdeReferencia } from './portalFacturaRutas'
import type {
  BloqueoInscripcion,
  EstadoPortalInscripciones,
  FacturaPasoInscripcion,
  PasoEstadoInscripcion,
  PasoInscripcion,
  ReinscripcionPeriodo,
  CierreCicloPortal,
} from './portalInscripcionesTypes'

function pagoVigente(p: PagoDetalleRegistro): boolean {
  return p.pago_cancelado !== 1 && p.pago_cancelado !== 2
}

/** Facturas CFDI de conceptos 11/12/13 ya pagados en el ciclo de inscripción. */
export function facturasPagoInscripcion(
  pagos: PagoDetalleRegistro[],
  alumnoRef: string | number,
  cicloEscolar: number
): FacturaPasoInscripcion[] {
  const control = formatearAlumnoRefParaReferencia(alumnoRef)
  const out: FacturaPasoInscripcion[] = []
  for (const c of ['11', '12', '13'] as const) {
    const pago = pagos.find((p) => {
      if (!pagoVigente(p)) return false
      const parsed = parsearReferenciaPago(p.pago_referencia)
      if (!parsed) return false
      return (
        normalizarConceptoNo(parsed.conceptoNo) === c &&
        parsed.cicloEscolar === cicloEscolar
      )
    })
    if (!pago) continue
    const rutas = rutasFacturaDesdeReferencia(
      pago.pago_referencia,
      control,
      c,
      cicloEscolar
    )
    if (!rutas.pdf) continue
    out.push({
      conceptoNo: c,
      etiqueta: getPaymentConcept(c),
      pdf: rutas.pdf,
      xml: rutas.xml ?? rutas.pdf.replace(/\.pdf$/i, '.xml'),
    })
  }
  return out
}

export function tienePagoConcepto(
  pagos: PagoDetalleRegistro[],
  alumnoRef: string | number,
  conceptoNo: string,
  cicloEscolar: number
): boolean {
  const concepto = normalizarConceptoNo(conceptoNo)

  return pagos.some((p) => {
    if (!pagoVigente(p)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) return false
    return (
      normalizarConceptoNo(parsed.conceptoNo) === concepto &&
      parsed.cicloEscolar === cicloEscolar
    )
  })
}

async function enReciboFinal(
  supabase: AppDatabaseClient,
  alumnoRef: string | number
): Promise<boolean> {
  const ref = String(alumnoRef).replace(/\D/g, '').slice(-5)
  const { count, error } = await supabase
    .from('a_inscritos')
    .select('ctrl', { count: 'exact', head: true })
    .eq('ctrl', ref)

  if (error) return false
  return (count ?? 0) > 0
}

function bloqueoPorStatus(status: number | null | undefined): {
  bloqueo: BloqueoInscripcion
  mensaje: string
} | null {
  switch (status) {
    case 0:
      return {
        bloqueo: 'inactivo',
        mensaje:
          'El alumno se encuentra inactivo. Comunícate al Departamento de Sistemas Winston.',
      }
    case 3:
      return {
        bloqueo: 'baja-temporal',
        mensaje:
          'El alumno está en baja temporal por adeudos. Comunícate a Administración.',
      }
    case 4:
    case 5:
      return {
        bloqueo: 'psicologia',
        mensaje:
          'Tienes un bloqueo académico o psicológico: no puedes pagar la inscripción del ciclo nuevo hasta que Psicología/Académico libere tu estatus. Sí puedes liquidar colegiaturas pendientes del ciclo anterior.',
      }
    default:
      return null
  }
}

function resolverEstadoPaso(
  completado: boolean,
  disponible: boolean,
  atencion = false
): PasoEstadoInscripcion {
  if (completado) return 'completado'
  if (atencion) return 'atencion'
  if (disponible) return 'disponible'
  return 'bloqueado'
}

function combinarAvisos(...partes: Array<string | null | undefined>): string | null {
  const unicos = [...new Set(partes.filter((p): p is string => !!p?.trim()))]
  return unicos.length > 0 ? unicos.join(' ') : null
}

export async function construirEstadoPortalInscripciones(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  ciclo: CicloEscolarRegistro,
  pagos: PagoDetalleRegistro[],
  opciones?: {
    pagosCierre?: PagoDetalleRegistro[]
    cicloCierre?: { valor: number; nombre: string }
  }
): Promise<EstadoPortalInscripciones> {
  const formaIngreso = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso)
  const esReinscrito = formaIngreso === 0
  const cea = ciclo.valor

  let bloqueo: BloqueoInscripcion | null = null
  let mensajeBloqueo: string | null = null
  let aviso: string | null = null
  let reinscripcionInfo: ReinscripcionPeriodo | null = null
  let cierreCiclo: CierreCicloPortal | null = null
  let dobleAdeudoPrevio: EstadoPortalInscripciones['dobleAdeudoPrevio'] = null

  if (esReinscrito && opciones?.pagosCierre && opciones.cicloCierre) {
    cierreCiclo = await resumenCierreCicloParaReinscrito(
      supabase,
      alumno,
      opciones.pagosCierre,
      opciones.cicloCierre
    )

    const doble = resumenAdeudoDobleTitulacionCiclo(
      opciones.pagosCierre,
      alumno.alumno_ref,
      opciones.cicloCierre.valor
    )
    if (doble.tienePrograma && !doble.liquidado) {
      dobleAdeudoPrevio = {
        ciclo: opciones.cicloCierre,
        pendientes: doble.pendientes,
      }
    }
  }

  const solEval = await evaluarSolicitudCapturada(supabase, alumno)
  const solCapturada = solEval.completa
  const calcReinscripcion = esReinscrito
    ? await calcularReinscripcionDiferido(supabase, alumno, cea)
    : null

  const gradoEtiqueta =
    esReinscrito && calcReinscripcion
      ? calcReinscripcion.graduado
        ? 'Egresado'
        : etiquetaGradoEscolar(
            calcReinscripcion.nivelDestino,
            calcReinscripcion.gradoDestino
          )
      : etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado)

  const cen = calcReinscripcion?.cicloReinscripcion ?? cea
  const cicloPagoReg = await resolverCicloPagoInscripcionPortal(
    alumno,
    ciclo,
    calcReinscripcion?.cicloReinscripcion
  )
  const cicloPago = cicloPagoReg.valor

  const insPagada = calcReinscripcion
    ? calcReinscripcion.completa
    : inscripcionCompletaPagada(pagos, alumno.alumno_ref, cicloPago)

  let showInfo = false
  let showPayment = false
  let liberateInfo = false
  let errorPagoPendiente = false

  const debeCerrarCicloAnterior = Boolean(cierreCiclo?.requerido)

  if (calcReinscripcion?.graduado) {
    bloqueo = 'egresado'
    mensajeBloqueo =
      '¡Felicidades! El alumno ha egresado del Instituto Winston Churchill.'
  } else {
    const statusBloqueo = bloqueoPorStatus(alumno.alumno_status)
    if (statusBloqueo) {
      bloqueo = statusBloqueo.bloqueo
      mensajeBloqueo = statusBloqueo.mensaje
    } else if (
      esReinscrito &&
      debeCerrarCicloAnterior &&
      Number(alumno.alumno_status) !== 2
    ) {
      bloqueo = 'adeudos'
      mensajeBloqueo = cierreCiclo
        ? `Debes liquidar las colegiaturas del ciclo ${cierreCiclo.ciclo.nombre} antes de reinscribirte. Paga un concepto a la vez según tu ${cierreCiclo.planEtiqueta.toLowerCase()}.`
        : 'Tienes adeudos pendientes. Debes cubrir las colegiaturas requeridas para reinscribirte.'
    } else if (
      esReinscrito &&
      !cierreCiclo &&
      (await esDeudorReinscrito(supabase, alumno, pagos, cea)) &&
      Number(alumno.alumno_status) !== 2
    ) {
      // Fallback legacy si no llegó info de cierre.
      bloqueo = 'adeudos'
      mensajeBloqueo =
        'Tienes adeudos pendientes. Debes cubrir las colegiaturas requeridas para reinscribirte.'
    } else if (calcReinscripcion) {
      const ventana = await evaluarVentanaPortalReinscrito(
        supabase,
        alumno,
        pagos,
        cen,
        calcReinscripcion,
        cea
      )

      showInfo = ventana.showInfo
      liberateInfo = ventana.liberateInfo
      showPayment = ventana.showPayment
      errorPagoPendiente = ventana.errorPagoPendiente

      reinscripcionInfo = {
        periodoInicio: ventana.ventanas.fechaIniDif1,
        fechaLimite:
          calcReinscripcion.diferido === 1
            ? ventana.ventanas.fechaFinDif1
            : ventana.ventanas.fechaFinDif2,
        diferido: calcReinscripcion.diferido,
      }

      aviso = combinarAvisos(ventana.msg1, ventana.msg2, ventana.msg3)

      if (ventana.graduated) {
        bloqueo = 'egresado'
        mensajeBloqueo =
          '¡Felicidades! El alumno ha egresado del Instituto Winston Churchill.'
      } else if (errorPagoPendiente) {
        bloqueo = 'adeudos'
        mensajeBloqueo = ventana.msg3 ?? 'Tienes adeudos pendientes para continuar tu reinscripción.'
      } else if (!showInfo && !showPayment) {
        bloqueo = 'periodo-cerrado'
        mensajeBloqueo =
          aviso ??
          'El portal de reinscripción no está abierto en este momento. Consulta las fechas oficiales.'
      }
    } else {
      let pagableNuevo = false
      let montoNuevo = 0
      try {
        const filas = await construirFilasInscripcionPortal(
          supabase,
          alumno,
          cicloPagoReg,
          pagos,
          false
        )
        const pendiente = filas.find((f) => !f.pagado)
        pagableNuevo = pendiente != null
        montoNuevo = pendiente?.importe ?? 0
      } catch {
        pagableNuevo = false
      }

      const ventanaNi = evaluarVentanaPortalNuevoIngreso(
        alumno,
        insPagada,
        pagableNuevo && montoNuevo > 0
      )
      showInfo = ventanaNi.showInfo
      liberateInfo = ventanaNi.liberateInfo
      showPayment = ventanaNi.showPayment
      aviso = ventanaNi.msg1
    }
  }

  if (!solCapturada && esReinscrito) {
    showPayment = false
  }
  if (solCapturada && !esReinscrito && (Number(alumno.alumno_status) === 1 || Number(alumno.alumno_status) === 2)) {
    showPayment = true
  }
  if (showPayment && calcReinscripcion && !calcReinscripcion.pagable) {
    showPayment = false
  }
  // Bloqueo 4/5: nunca habilitar pago de inscripción del ciclo nuevo.
  if (esEstatusBloqueo(alumno.alumno_status)) {
    showPayment = false
  }

  const flujoActivo = bloqueo == null
  // Con bloqueo psico/académico aún pueden liquidar el ciclo anterior (cierre).
  const pasosVisibles =
    flujoActivo && puedeVerPasosInscripcion(alumno, esReinscrito, liberateInfo)
  const reciboHabilitado = await enReciboFinal(supabase, alumno.alumno_ref)

  const cicloReglamento = esReinscrito
    ? calcReinscripcion?.cicloReinscripcion ?? cen
    : Number(alumno.alumno_ciclo_escolar) || cea
  const nivelReglamento = esReinscrito
    ? calcReinscripcion?.nivelDestino ?? alumno.alumno_nivel
    : alumno.alumno_nivel

  let urlReglamento: string | null = null
  try {
    const publicado = await obtenerReglamento(
      supabase,
      Number(nivelReglamento),
      Number(cicloReglamento)
    )
    if (publicado) {
      urlReglamento = hrefReglamentoArchivo(
        Number(nivelReglamento),
        Number(cicloReglamento)
      )
    }
  } catch {
    urlReglamento = null
  }
  if (!urlReglamento) {
    urlReglamento = urlReglamentoEscolarLegacy(nivelReglamento, cicloReglamento)
  }

  const requiereDocs = requiereDocumentosAdmision(alumno, cea)
  let docsEnviados = false
  if (requiereDocs) {
    try {
      docsEnviados = await documentosNiYaEnviados(
        supabase,
        alumno.alumno_id,
        Number(cicloPago)
      )
    } catch {
      docsEnviados = false
    }
  }

  // Cuota 00 del ciclo de colegiaturas: si ya pagó, la inscripción y el plan
  // quedaron cerrados en la práctica (no exigir localStorage de reglamento/recibo).
  const cicloColegiaturasValor = Number(cicloPagoReg.valor)
  const cuotaInicioCursoPagada = pagos.some((p) => {
    if (Number(p.pago_cancelado) === 1 || Number(p.pago_cancelado) === 2) return false
    if (!(Number(p.pago_importe) > 0)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed || parsed.cicloEscolar !== cicloColegiaturasValor) return false
    return normalizarConceptoNo(parsed.conceptoNo) === '00'
  })
  const pasosVistaCerradosPorCuota = cuotaInicioCursoPagada
  if (pasosVistaCerradosPorCuota && requiereDocs) {
    docsEnviados = true
  }

  let montoInscripcion: number | null = null
  if (flujoActivo && solCapturada && !insPagada && showPayment) {
    if (calcReinscripcion?.pagable) {
      montoInscripcion = calcReinscripcion.monto
    } else if (!esReinscrito) {
      try {
        const filasInscripcion = await construirFilasInscripcionPortal(
          supabase,
          alumno,
          cicloPagoReg,
          pagos,
          false
        )
        montoInscripcion = filasInscripcion.find((f) => !f.pagado)?.importe ?? null
      } catch {
        montoInscripcion = null
      }
    }
  }

  const facturasInscripcion: FacturaPasoInscripcion[] = (() => {
    if (!insPagada) return []
    if (calcReinscripcion?.filasPagadas?.length) {
      return calcReinscripcion.filasPagadas
        .filter((f) => Boolean(f.facturaPdf))
        .map((f) => ({
          conceptoNo: f.conceptoNo,
          etiqueta: f.conceptoClase,
          pdf: f.facturaPdf as string,
          xml: (f.facturaXml ?? (f.facturaPdf as string).replace(/\.pdf$/i, '.xml')) as string,
        }))
    }
    return facturasPagoInscripcion(pagos, alumno.alumno_ref, cicloPago)
  })()

  const pasos: PasoInscripcion[] = []

  pasos.push({
    id: 'solicitud',
    orden: 1,
    titulo: 'Solicitud de inscripción',
    descripcion: 'Captura o actualiza los datos del alumno y familiares.',
    estado: resolverEstadoPaso(solCapturada, pasosVisibles || flujoActivo),
    detalle: solCapturada
      ? alumno.alumno_registro
        ? `Registrada el ${alumno.alumno_registro}`
        : 'Datos capturados correctamente'
      : solEval.faltantesResumen
        ? solEval.faltantesResumen
        : showInfo
          ? 'Completa las 5 secciones del formulario (todas en amarillo) y guarda.'
          : 'Disponible cuando abra el periodo de inscripción.',
    fechaCompletado: solCapturada ? (alumno.alumno_registro ?? null) : null,
    accion:
      flujoActivo && (pasosVisibles || !esReinscrito)
        ? {
            tipo: 'ruta-interna',
            href: '/portal-inscripciones/solicitud',
            etiqueta: solCapturada ? 'Actualizar solicitud' : 'Completar solicitud',
          }
        : null,
  })

  pasos.push({
    id: 'reglamento',
    orden: 2,
    titulo: 'Reglamento escolar',
    descripcion: 'Imprime el reglamento, la carta compromiso y fírmala.',
    estado: resolverEstadoPaso(
      pasosVistaCerradosPorCuota,
      pasosVisibles && solCapturada
    ),
    detalle: pasosVistaCerradosPorCuota
      ? 'Paso cerrado: ya hay cuota de inicio de curso pagada en este ciclo.'
      : urlReglamento
        ? 'Descarga el reglamento y la carta compromiso para imprimir y firmar.'
        : solCapturada
          ? 'Consulta información en tu coordinación académica; el PDF aún no está publicado.'
          : 'Se habilita al completar la solicitud.',
    accion:
      pasosVisibles && solCapturada && urlReglamento
        ? { tipo: 'externo', href: urlReglamento, etiqueta: 'Ver reglamento y carta compromiso' }
        : null,
  })

  pasos.push({
    id: 'pago-inscripcion',
    orden: 3,
    titulo: esReinscrito ? 'Pago de reinscripción' : 'Pago de inscripción',
    descripcion: esReinscrito
      ? 'Efectivo en ventanilla, comercio electrónico o SPEI — igual que en portal de pagos.'
      : 'Paga inscripción en ventanilla (baucher), comercio electrónico o SPEI.',
    estado: resolverEstadoPaso(
      insPagada,
      pasosVisibles && solCapturada && (showPayment || insPagada),
      pasosVisibles && solCapturada && showPayment && !insPagada
    ),
    detalle: insPagada
      ? facturasInscripcion.length > 0
        ? 'Pago registrado y timbrado. Descarga tu factura electrónica (PDF y XML).'
        : 'Pago registrado correctamente. La factura aparecerá aquí al terminar el timbrado.'
      : showPayment
        ? 'Pendiente de pago.'
        : solCapturada
          ? 'El pago se habilitará en la ventana oficial de reinscripción.'
          : 'Completa la solicitud para habilitar el pago.',
    // Si ya pagó: PDF/XML (no el comprobante genérico). Si no: enlace a pagar.
    accion:
      pasosVisibles && solCapturada && showPayment && !insPagada
        ? {
            tipo: 'ruta-interna',
            href: '/portal-inscripciones/pago',
            etiqueta: esReinscrito ? 'Pagar reinscripción' : 'Pagar inscripción',
          }
        : null,
    facturas: insPagada && facturasInscripcion.length > 0 ? facturasInscripcion : null,
  })

  if (requiereDocs) {
    const docsDisponibles = Boolean(pasosVisibles && solCapturada && insPagada)
    pasos.push({
      id: 'documentos',
      orden: 4,
      titulo: 'Carga de documentos',
      descripcion:
        'Sube en PDF los documentos que pide control escolar según el nivel del alumno.',
      estado: resolverEstadoPaso(docsEnviados, docsDisponibles),
      detalle: docsEnviados
        ? 'Documentos enviados a control escolar. Puedes volver a cargarlos si necesitas actualizarlos.'
        : docsDisponibles
          ? 'Carga los PDF requeridos; se enviarán al correo de control escolar de tu nivel.'
          : 'Se habilita al completar la solicitud y el pago de inscripción.',
      accion: docsDisponibles
        ? {
            tipo: 'ruta-interna',
            href: '/portal-inscripciones/documentos',
            etiqueta: docsEnviados ? 'Ver o actualizar documentos' : 'Cargar documentos',
          }
        : null,
    })
  }

  const ordenRecibo = requiereDocs ? 5 : 4
  // NI / cambio de nivel (K3→1º, 6º→sec): solicitud + pago + documentos.
  // Reinscrito regular: solicitud + pago.
  const pasosPreviosRecibo = Boolean(
    solCapturada &&
      insPagada &&
      (!requiereDocs || docsEnviados || reciboHabilitado)
  )
  const puedeRecibo = Boolean(pasosVisibles && pasosPreviosRecibo)

  pasos.push({
    id: 'recibo-final',
    orden: ordenRecibo,
    titulo: 'Recibo final',
    descripcion: 'Comprobante del proceso de inscripción con código QR de verificación.',
    estado: resolverEstadoPaso(pasosVistaCerradosPorCuota, puedeRecibo || pasosVistaCerradosPorCuota),
    detalle: pasosVistaCerradosPorCuota
      ? 'Paso cerrado: ya hay cuota de inicio de curso pagada en este ciclo. Las colegiaturas están desbloqueadas.'
      : puedeRecibo
        ? 'Ábrelo al menos una vez para marcarlo como completado. Las colegiaturas del ciclo nuevo se desbloquean cuando los 4 pasos estén completados.'
        : requiereDocs
          ? 'Se habilita al completar solicitud, pago y carga de documentos.'
          : 'Se habilita al completar la solicitud y el pago de reinscripción.',
    accion: puedeRecibo || pasosVistaCerradosPorCuota
      ? {
          tipo: 'externo',
          href: `/api/portal-inscripciones/recibo-final?alumnoId=${alumno.alumno_id}`,
          etiqueta: 'Ver recibo final',
        }
      : null,
  })

  pasos.sort((a, b) => a.orden - b.orden)

  const pasosTotales = pasos.length
  const pasosCompletados = pasos.filter((p) => p.estado === 'completado').length
  const progresoPct =
    pasosTotales > 0 ? Math.round((pasosCompletados / pasosTotales) * 100) : 0

  if (flujoActivo && showInfo && !solCapturada) {
    aviso = combinarAvisos(
      aviso,
      'Para habilitar las opciones de pago primero debe llenar (o actualizar) y guardar la solicitud de inscripción.'
    )
  }

  return {
    alumno,
    ciclo,
    formaIngreso,
    formaIngresoEtiqueta: esReinscrito ? 'Reinscrito' : 'Nuevo ingreso',
    gradoEtiqueta,
    bloqueo,
    mensajeBloqueo,
    aviso,
    pasos,
    pasosCompletados,
    pasosTotales,
    progresoPct,
    montoInscripcion,
    reinscripcion: reinscripcionInfo,
    showPayment,
    solicitudCapturada: solCapturada,
    inscripcionPagada: insPagada,
    cuotaInicioCursoPagada,
    cierreCiclo,
    dobleAdeudoPrevio,
    cicloColegiaturas: {
      valor: cicloPagoReg.valor,
      nombre: cicloPagoReg.nombre,
    },
  }
}
