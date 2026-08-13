import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import { esEstatusBloqueo } from './alumnoStatus'
import type { CicloEscolarRegistro } from './ciclosEscolaresService'
import { etiquetaGradoEscolar } from './gradoEscolar'
import {
  listarPagosColegiaturaAlumno,
  type PagoDetalleRegistro,
} from './pagoColegiaturaService'
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
import { documentacionOkParaReciboFinal } from './controlEscolarService'
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
import { evaluarBloqueoCupoPortal } from './cupoInscripcionPrimaria'
import { getPaymentConcept } from './boucherCore'
import { rutasFacturaDesdeReferencia } from './portalFacturaRutas'
import {
  marcarPortalInscripcionProgreso,
  obtenerPortalInscripcionProgreso,
} from './portalInscripcionProgreso'
import { obtenerPlanMesesCiclo } from './portalPlanMesesCiclo'
import {
  obtenerAdeudoEgresadoActivoPorAlumno,
  type AlumnoPagoEgresadoRegistro,
} from './adeudosEgresadosService'
import { etiquetaCicloEscolar } from './cicloEscolar'
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
  _supabase: AppDatabaseClient,
  opts: {
    alumnoRef: string | number
    alumnoId: number
    cicloValor: number
  }
): Promise<{ ok: boolean; exigeAutorizacionCe: boolean }> {
  const r = await documentacionOkParaReciboFinal(opts)
  return { ok: r.ok, exigeAutorizacionCe: r.exigeAutorizacionCe }
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

  const adeudoEgresado: AlumnoPagoEgresadoRegistro | null =
    await obtenerAdeudoEgresadoActivoPorAlumno(supabase, alumno.alumno_id)
  const modoAdeudoEgresado = Boolean(adeudoEgresado?.activo)

  // Acceso temporal egresado: forzar cierre del ciclo de adeudos (sin tocar ficha).
  let pagosCierreEfectivos = opciones?.pagosCierre
  let cicloCierreEfectivo = opciones?.cicloCierre
  if (modoAdeudoEgresado && adeudoEgresado) {
    const cicloAdeudo = adeudoEgresado.ciclo_valor
    cicloCierreEfectivo = {
      valor: cicloAdeudo,
      nombre: etiquetaCicloEscolar(cicloAdeudo) || String(cicloAdeudo),
    }
    pagosCierreEfectivos = await listarPagosColegiaturaAlumno(
      alumno.alumno_id,
      cicloAdeudo
    )
  }

  if ((esReinscrito || modoAdeudoEgresado) && pagosCierreEfectivos && cicloCierreEfectivo) {
    cierreCiclo = await resumenCierreCicloParaReinscrito(
      supabase,
      alumno,
      pagosCierreEfectivos,
      cicloCierreEfectivo
    )

    const doble = resumenAdeudoDobleTitulacionCiclo(
      pagosCierreEfectivos,
      alumno.alumno_ref,
      cicloCierreEfectivo.valor
    )
    if (doble.tienePrograma && !doble.liquidado) {
      dobleAdeudoPrevio = {
        ciclo: cicloCierreEfectivo,
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
    modoAdeudoEgresado || (esReinscrito && calcReinscripcion?.graduado)
      ? 'Egresado'
      : esReinscrito && calcReinscripcion
        ? etiquetaGradoEscolar(
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

  if (modoAdeudoEgresado && adeudoEgresado) {
    // Solo liquidar adeudos del ciclo indicado; sin reinscripción ni cambio de ficha.
    showPayment = false
    liberateInfo = false
    showInfo = false
    if (cierreCiclo?.requerido) {
      aviso = adeudoEgresado.con_recargos
        ? `Acceso temporal de egresado: liquida las colegiaturas pendientes del ciclo ${cierreCiclo.ciclo.nombre} (con recargos). Tu estatus de egresado / baja general no cambia.`
        : `Acceso temporal de egresado: liquida las colegiaturas pendientes del ciclo ${cierreCiclo.ciclo.nombre} (sin recargos). Tu estatus de egresado / baja general no cambia.`
    } else {
      aviso = `No hay colegiaturas pendientes del ciclo ${adeudoEgresado.ciclo_valor}. Puedes pedir a Servicios que desactive este acceso.`
    }
  } else if (calcReinscripcion?.graduado) {
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

  // Cupo 3°/5° Primaria (máx. 60 inscritos dif2). No aplica si ya pagó inscripción.
  if (
    bloqueo == null &&
    !modoAdeudoEgresado &&
    !insPagada &&
    !calcReinscripcion?.graduado
  ) {
    const cupo = await evaluarBloqueoCupoPortal({
      alumno,
      cicloTemporadaActual: cea,
      yaInscrito: insPagada,
      cicloInscripcion: cen,
    })
    if (cupo) {
      bloqueo = 'cupo'
      mensajeBloqueo = cupo.mensaje
      showPayment = false
    }
  }

  const flujoActivo = bloqueo == null && !modoAdeudoEgresado
  // Con bloqueo psico/académico aún pueden liquidar el ciclo anterior (cierre).
  // Adeudo egresado: solo matriz de cierre, sin pasos de reinscripción.
  const pasosVisibles =
    flujoActivo && puedeVerPasosInscripcion(alumno, esReinscrito, liberateInfo)

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

  const reciboDocs = requiereDocs
    ? await enReciboFinal(supabase, {
        alumnoRef: alumno.alumno_ref,
        alumnoId: alumno.alumno_id,
        cicloValor: Number(cicloPago),
      })
    : { ok: true, exigeAutorizacionCe: false }
  const reciboHabilitado = reciboDocs.ok
  const exigeAutorizacionCe = reciboDocs.exigeAutorizacionCe

  // Progreso multi-dispositivo: BD + respaldo (cuota 00 o plan ya elegido).
  // Antes solo vivía en localStorage → al abrir en otra PC pedía reglamento/recibo otra vez.
  const cicloColegiaturasValor = Number(cicloPagoReg.valor)
  const cuotaInicioCursoPagada = pagos.some((p) => {
    if (Number(p.pago_cancelado) === 1 || Number(p.pago_cancelado) === 2) return false
    if (!(Number(p.pago_importe) > 0)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed || parsed.cicloEscolar !== cicloColegiaturasValor) return false
    return normalizarConceptoNo(parsed.conceptoNo) === '00'
  })
  const planGuardadoCiclo =
    (await obtenerPlanMesesCiclo(supabase, alumno.alumno_id, cicloColegiaturasValor)) !=
    null
  let progresoRow = await obtenerPortalInscripcionProgreso(
    supabase,
    alumno.alumno_id,
    cicloColegiaturasValor
  )
  // Backfill: cuota 00 implica proceso de colegiaturas ya abierto (pasos previos OK).
  // El plan solo no marca reglamento/recibo: se elige al final, no los sustituye.
  if (
    cuotaInicioCursoPagada &&
    (!progresoRow?.reglamento_visto ||
      !progresoRow?.recibo_final_visto ||
      !progresoRow?.plan_confirmado)
  ) {
    await marcarPortalInscripcionProgreso(
      supabase,
      alumno.alumno_id,
      cicloColegiaturasValor,
      {
        reglamento_visto: true,
        recibo_final_visto: true,
        plan_confirmado: true,
      }
    )
    progresoRow = await obtenerPortalInscripcionProgreso(
      supabase,
      alumno.alumno_id,
      cicloColegiaturasValor
    )
  } else if (planGuardadoCiclo && !progresoRow?.plan_confirmado) {
    await marcarPortalInscripcionProgreso(
      supabase,
      alumno.alumno_id,
      cicloColegiaturasValor,
      { plan_confirmado: true }
    )
    progresoRow = await obtenerPortalInscripcionProgreso(
      supabase,
      alumno.alumno_id,
      cicloColegiaturasValor
    )
  }
  const reglamentoVistoServidor = Boolean(
    progresoRow?.reglamento_visto || cuotaInicioCursoPagada
  )
  const reciboFinalVistoServidor = Boolean(
    progresoRow?.recibo_final_visto || cuotaInicioCursoPagada
  )
  const planConfirmadoServidor = Boolean(
    progresoRow?.plan_confirmado || cuotaInicioCursoPagada || planGuardadoCiclo
  )
  const pasosVistaCerrados =
    reglamentoVistoServidor && reciboFinalVistoServidor
  if (pasosVistaCerrados && requiereDocs) {
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
      reglamentoVistoServidor,
      pasosVisibles && solCapturada
    ),
    detalle: reglamentoVistoServidor
      ? cuotaInicioCursoPagada
        ? 'Paso cerrado: el proceso de inscripción de este ciclo ya quedó registrado.'
        : 'Reglamento consultado.'
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
  // NI / cambio de nivel: solicitud + pago + docs portal.
  // Autorización CE solo si el envío de docs es ≥ lanzamiento del módulo (hoy).
  // Envíos anteriores al módulo: se respeta el recibo con solo documentos enviados.
  const docsPortalOk = !requiereDocs || docsEnviados
  const autorizacionControlEscolarOk = !requiereDocs || reciboHabilitado
  const pasosPreviosRecibo = Boolean(
    solCapturada && insPagada && docsPortalOk && autorizacionControlEscolarOk
  )
  const puedeRecibo = Boolean(pasosVisibles && pasosPreviosRecibo)

  let detalleRecibo: string
  if (reciboFinalVistoServidor) {
    detalleRecibo = cuotaInicioCursoPagada
      ? 'Paso cerrado: el proceso de inscripción de este ciclo ya quedó registrado. Las colegiaturas están desbloqueadas.'
      : 'Recibo final consultado. Las colegiaturas del ciclo nuevo se desbloquean con todos los pasos completados.'
  } else if (puedeRecibo) {
    detalleRecibo =
      'Ábrelo al menos una vez para marcarlo como completado. Las colegiaturas del ciclo nuevo se desbloquean cuando los pasos estén completados.'
  } else if (requiereDocs) {
    if (!solCapturada || !insPagada) {
      detalleRecibo = exigeAutorizacionCe
        ? 'Se habilita al completar solicitud, pago, carga de documentos y autorización de Control Escolar.'
        : 'Se habilita al completar solicitud, pago y carga de documentos.'
    } else if (!docsEnviados) {
      detalleRecibo = exigeAutorizacionCe
        ? 'Falta la carga de documentos en el portal. Después Control Escolar debe autorizar la documentación completa.'
        : 'Falta la carga de documentos en el portal para generar el recibo final.'
    } else if (!reciboHabilitado && exigeAutorizacionCe) {
      detalleRecibo =
        'Documentos cargados. Falta la autorización de Control Escolar (documentación completa) para generar el recibo final.'
    } else {
      detalleRecibo =
        'Se habilita al completar solicitud, pago y carga de documentos.'
    }
  } else {
    detalleRecibo =
      'Se habilita al completar la solicitud y el pago de reinscripción.'
  }

  pasos.push({
    id: 'recibo-final',
    orden: ordenRecibo,
    titulo: 'Recibo final',
    descripcion: 'Comprobante del proceso de inscripción con código QR de verificación.',
    estado: resolverEstadoPaso(
      reciboFinalVistoServidor,
      puedeRecibo || reciboFinalVistoServidor
    ),
    detalle: detalleRecibo,
    accion: puedeRecibo || reciboFinalVistoServidor
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
    formaIngresoEtiqueta: modoAdeudoEgresado
      ? 'Adeudos'
      : esReinscrito
        ? 'Reinscrito'
        : 'Nuevo ingreso',
    gradoEtiqueta,
    bloqueo,
    mensajeBloqueo,
    aviso,
    pasos: modoAdeudoEgresado ? [] : pasos,
    pasosCompletados: modoAdeudoEgresado ? 0 : pasosCompletados,
    pasosTotales: modoAdeudoEgresado ? 0 : pasosTotales,
    progresoPct: modoAdeudoEgresado ? 0 : progresoPct,
    montoInscripcion: modoAdeudoEgresado ? null : montoInscripcion,
    reinscripcion: modoAdeudoEgresado ? null : reinscripcionInfo,
    showPayment: modoAdeudoEgresado ? false : showPayment,
    solicitudCapturada: solCapturada,
    inscripcionPagada: insPagada,
    cuotaInicioCursoPagada,
    progresoInscripcion: {
      reglamentoVisto: reglamentoVistoServidor,
      reciboFinalVisto: reciboFinalVistoServidor,
      planConfirmado: planConfirmadoServidor,
    },
    cierreCiclo,
    dobleAdeudoPrevio,
    cicloColegiaturas: modoAdeudoEgresado && adeudoEgresado
      ? {
          valor: adeudoEgresado.ciclo_valor,
          nombre:
            etiquetaCicloEscolar(adeudoEgresado.ciclo_valor) ||
            String(adeudoEgresado.ciclo_valor),
        }
      : {
          valor: cicloPagoReg.valor,
          nombre: cicloPagoReg.nombre,
        },
    modoAdeudoEgresado,
  }
}
