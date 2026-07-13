import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import { formaIngresoPorDefecto } from './alumnoFormaIngreso'
import type { CicloEscolarRegistro } from './ciclosEscolaresService'
import { etiquetaGradoEscolar } from './gradoEscolar'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import {
  formatearAlumnoRefParaReferencia,
  normalizarConceptoNo,
  parsearReferenciaPago,
} from './pagoReferenciaColegiatura'
import { esDeudorReinscrito } from './portalAdmisionesDeudor'
import {
  evaluarVentanaPortalNuevoIngreso,
  evaluarVentanaPortalReinscrito,
  puedeVerPasosInscripcion,
} from './portalAdmisionesEstadoService'
import { urlReglamentoEscolarLegacy } from './portalAdmisionesConfig'
import { documentosNiYaEnviados } from './portalDocumentosNiService'
import {
  hrefReglamentoArchivo,
  obtenerReglamento,
} from './reglamentosEscolaresService'
import { construirFilasInscripcionPortal } from './portalPagosMatrizService'
import { resolverCicloPagoInscripcionPortal } from './portalInscripcionesCiclo'
import { calcularReinscripcionDiferido } from './portalReinscripcionService'
import {
  inscripcionCompletaPagada,
  solicitudCapturada,
} from './portalInscripcionesSolicitud'
import type {
  BloqueoInscripcion,
  EstadoPortalInscripciones,
  PasoEstadoInscripcion,
  PasoInscripcion,
  ReinscripcionPeriodo,
} from './portalInscripcionesTypes'

function pagoVigente(p: PagoDetalleRegistro): boolean {
  return p.pago_cancelado !== 1 && p.pago_cancelado !== 2
}

export function tienePagoConcepto(
  pagos: PagoDetalleRegistro[],
  alumnoRef: string | number,
  conceptoNo: string,
  cicloEscolar: number
): boolean {
  const ref5 = formatearAlumnoRefParaReferencia(String(alumnoRef).replace(/\D/g, '').slice(-5))
  const concepto = normalizarConceptoNo(conceptoNo)

  return pagos.some((p) => {
    if (!pagoVigente(p)) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) return false
    return (
      parsed.alumnoRef === ref5 &&
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
    case 5:
      return {
        bloqueo: 'psicologia',
        mensaje: 'Este servicio no está disponible. Comunícate al Departamento de Psicología.',
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
  pagos: PagoDetalleRegistro[]
): Promise<EstadoPortalInscripciones> {
  const formaIngreso = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso)
  const esReinscrito = formaIngreso === 0
  const cea = ciclo.valor

  let bloqueo: BloqueoInscripcion | null = null
  let mensajeBloqueo: string | null = null
  let aviso: string | null = null
  let reinscripcionInfo: ReinscripcionPeriodo | null = null

  const solCapturada = await solicitudCapturada(supabase, alumno)
  const calcReinscripcion = esReinscrito
    ? await calcularReinscripcionDiferido(supabase, alumno)
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
      (await esDeudorReinscrito(supabase, alumno, pagos, cea)) &&
      Number(alumno.alumno_status) !== 2
    ) {
      bloqueo = 'adeudos'
      mensajeBloqueo =
        'Tienes adeudos pendientes. Debes cubrir las colegiaturas requeridas para reinscribirte.'
    } else if (calcReinscripcion) {
      const ventana = await evaluarVentanaPortalReinscrito(
        supabase,
        alumno,
        pagos,
        cen,
        calcReinscripcion
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

  const flujoActivo = bloqueo == null
  const pasosVisibles = flujoActivo && puedeVerPasosInscripcion(alumno, esReinscrito, liberateInfo)
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

  let docsEnviados = false
  if (!esReinscrito) {
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
      : showInfo
        ? 'Completa el formulario para habilitar los pagos.'
        : 'Disponible cuando abra el periodo de inscripción.',
    fechaCompletado: alumno.alumno_registro ?? null,
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
    estado: resolverEstadoPaso(false, pasosVisibles && solCapturada),
    detalle: urlReglamento
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
      ? 'Pago registrado correctamente.'
      : showPayment
        ? 'Pendiente de pago.'
        : solCapturada
          ? 'El pago se habilitará en la ventana oficial de reinscripción.'
          : 'Completa la solicitud para habilitar el pago.',
    accion:
      pasosVisibles && solCapturada && showPayment && !insPagada
        ? {
            tipo: 'ruta-interna',
            href: '/portal-inscripciones/pago',
            etiqueta: esReinscrito ? 'Pagar reinscripción' : 'Pagar inscripción',
          }
        : insPagada
          ? {
              tipo: 'externo',
              href: `/api/portal-inscripciones/comprobante?alumnoId=${alumno.alumno_id}`,
              etiqueta: 'Ver comprobante',
            }
          : null,
  })

  if (!esReinscrito) {
    const docsDisponibles = Boolean(pasosVisibles && solCapturada && insPagada)
    pasos.push({
      id: 'documentos',
      orden: 4,
      titulo: 'Carga de documentos',
      descripcion:
        'Sube en PDF el acta, CURP, CURP de mamá/papá, constancia de no adeudo y carta de buena conducta.',
      estado: resolverEstadoPaso(docsEnviados, docsDisponibles),
      detalle: docsEnviados
        ? 'Documentos enviados a control escolar. Puedes volver a cargarlos si necesitas actualizarlos.'
        : docsDisponibles
          ? 'Carga los 5 PDF y se enviarán automáticamente al correo de control escolar de tu nivel.'
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

  const ordenRecibo = esReinscrito ? 4 : 5
  const puedeRecibo =
    pasosVisibles && insPagada && (reciboHabilitado || esReinscrito)

  pasos.push({
    id: 'recibo-final',
    orden: ordenRecibo,
    titulo: 'Recibo final',
    descripcion: 'Comprobante de proceso de inscripción completado.',
    estado: resolverEstadoPaso(reciboHabilitado && insPagada, puedeRecibo),
    detalle: reciboHabilitado
      ? 'Tu recibo final está disponible.'
      : puedeRecibo
        ? 'Disponible al cerrar todos los pasos anteriores.'
        : 'Completa los pasos previos.',
    accion:
      puedeRecibo && insPagada
        ? {
            tipo: 'externo',
            href: `/api/portal-inscripciones/recibo-final?alumnoId=${alumno.alumno_id}`,
            etiqueta: 'Imprimir recibo final',
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
  }
}
