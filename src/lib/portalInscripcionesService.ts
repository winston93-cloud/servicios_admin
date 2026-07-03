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
import { construirFilasInscripcionPortal } from './portalPagosMatrizService'
import { calcularReinscripcionDiferido } from './portalReinscripcionService'
import type {
  BloqueoInscripcion,
  EstadoPortalInscripciones,
  PasoEstadoInscripcion,
  PasoInscripcion,
  ReinscripcionPeriodo,
} from './portalInscripcionesTypes'

const CAMBIO_CICLO = '07-20'

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function mesActual(): number {
  return new Date().getMonth() + 1
}

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

function inscripcionPagada(
  pagos: PagoDetalleRegistro[],
  alumno: AlumnoRegistro,
  ciclo: number,
  esReinscrito: boolean
): boolean {
  if (tienePagoConcepto(pagos, alumno.alumno_ref, '13', ciclo)) return true
  if (esReinscrito && tienePagoConcepto(pagos, alumno.alumno_ref, '12', ciclo)) return true
  if (esReinscrito && tienePagoConcepto(pagos, alumno.alumno_ref, '11', ciclo)) return true
  return false
}

async function tieneBecaCompleta(
  supabase: AppDatabaseClient,
  alumnoId: number,
  ciclo: number
): Promise<boolean> {
  const { count, error } = await supabase
    .from('alumno_beca')
    .select('beca_id', { count: 'exact', head: true })
    .eq('alumno_id', alumnoId)
    .eq('beca_porcentaje', 100)
    .eq('beca_ciclo_escolar', ciclo)
    .eq('beca_estatus', 1)

  if (error) return false
  return (count ?? 0) > 0
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

  if (error) {
    // Tabla opcional (puede no existir aún en InsForge)
    return false
  }
  return (count ?? 0) > 0
}

function solicitudCompleta(alumno: AlumnoRegistro): boolean {
  if (alumno.alumno_registro) return true
  // Legacy: nuevo ingreso activo puede continuar sin fecha de registro explícita
  if (formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 1 && alumno.alumno_status === 1) {
    return true
  }
  return false
}

function esEgresado(alumno: AlumnoRegistro): boolean {
  return alumno.alumno_nivel === 4 && Number(alumno.alumno_grado) === 3
}

async function evaluarAdeudosReinscrito(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  pagos: PagoDetalleRegistro[],
  ciclo: number
): Promise<boolean> {
  if (await tieneBecaCompleta(supabase, alumno.alumno_id, ciclo)) return false

  const mes = mesActual()
  const ref = alumno.alumno_ref

  if (mes === 2 && ciclo !== 17) {
    const materialFeb = tienePagoConcepto(pagos, ref, '16', ciclo)
    if (!materialFeb) return true
  }

  if (mes > 5) {
    const cmd = `${String(mes).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    const cicloJunio = cmd < CAMBIO_CICLO ? ciclo : ciclo - 1
    const junioPagado = tienePagoConcepto(pagos, ref, '10', cicloJunio)
    if (!junioPagado) return true
  }

  return false
}

function fechaValida(valor: unknown): string | null {
  const s = String(valor ?? '').slice(0, 10)
  return s && s !== '0000-00-00' ? s : null
}

async function periodoInscripcionAbierto(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  ciclo: number
): Promise<{ abierto: boolean; aviso: string | null; reinscripcion: ReinscripcionPeriodo | null }> {
  const esReinscrito = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 0
  const hoy = hoyIso()
  const anio = new Date().getFullYear()

  if (!esReinscrito) {
    const inicio = `${anio}-01-01`
    if (hoy < inicio) {
      return {
        abierto: false,
        aviso: 'El periodo de inscripción para nuevo ingreso abre a partir del 1 de enero.',
        reinscripcion: null,
      }
    }
    return { abierto: true, aviso: null, reinscripcion: null }
  }

  const { data, error } = await supabase
    .from('iwc_gral_ins')
    .select('*')
    .eq('ins_ce', ciclo)
    .maybeSingle()

  if (error || !data) {
    return { abierto: true, aviso: null, reinscripcion: null }
  }

  const fila = data as Record<string, unknown>
  const mesAlumno = Number(alumno.mes ?? 0)
  const usarCambioLv = mesAlumno === 1

  const dif1Ini = fechaValida(usarCambioLv ? fila.ins_cambio_lv_dif1_ini : fila.ins_normal_dif1_ini)
  const dif1Fin = fechaValida(usarCambioLv ? fila.ins_cambio_lv_dif1_fin : fila.ins_normal_dif1_fin)
  const dif2Ini = fechaValida(usarCambioLv ? fila.ins_cambio_lv_dif2_ini : fila.ins_normal_dif2_ini)
  const dif2Fin = fechaValida(usarCambioLv ? fila.ins_cambio_lv_dif2_fin : fila.ins_normal_dif2_fin)

  // Diferido vigente y fecha límite aplicable (mejor esfuerzo con los campos disponibles).
  let diferido: 1 | 2 | null = null
  let fechaLimite: string | null = dif2Fin ?? dif1Fin
  if (dif1Ini && dif1Fin && hoy >= dif1Ini && hoy <= dif1Fin) {
    diferido = 1
    fechaLimite = dif1Fin
  } else if (dif2Ini && dif2Fin && hoy >= dif2Ini && hoy <= dif2Fin) {
    diferido = 2
    fechaLimite = dif2Fin
  } else if (dif1Fin && dif2Ini && hoy > dif1Fin && hoy < dif2Ini) {
    diferido = 2
    fechaLimite = dif2Fin
  }

  const reinscripcion: ReinscripcionPeriodo = {
    periodoInicio: dif1Ini,
    fechaLimite,
    diferido,
  }

  if (dif1Ini && hoy < dif1Ini) {
    return {
      abierto: false,
      aviso: `El primer periodo de reinscripción inicia el ${dif1Ini}.`,
      reinscripcion,
    }
  }

  if (dif2Fin && hoy > dif2Fin) {
    return {
      abierto: true,
      aviso: 'Reinscripción fuera del periodo oficial; puedes continuar tu trámite.',
      reinscripcion,
    }
  }

  return { abierto: true, aviso: null, reinscripcion }
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

export async function construirEstadoPortalInscripciones(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  ciclo: CicloEscolarRegistro,
  pagos: PagoDetalleRegistro[]
): Promise<EstadoPortalInscripciones> {
  const formaIngreso = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso)
  const esReinscrito = formaIngreso === 0
  const cicloValor = ciclo.valor
  const gradoEtiqueta = etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado)

  let bloqueo: BloqueoInscripcion | null = null
  let mensajeBloqueo: string | null = null
  let aviso: string | null = null
  let reinscripcionInfo: ReinscripcionPeriodo | null = null

  if (esEgresado(alumno)) {
    bloqueo = 'egresado'
    mensajeBloqueo = '¡Felicidades! El alumno ha egresado del Instituto Winston Churchill.'
  } else {
    const statusBloqueo = bloqueoPorStatus(alumno.alumno_status)
    if (statusBloqueo) {
      bloqueo = statusBloqueo.bloqueo
      mensajeBloqueo = statusBloqueo.mensaje
    } else if (esReinscrito && (await evaluarAdeudosReinscrito(supabase, alumno, pagos, cicloValor))) {
      bloqueo = 'adeudos'
      mensajeBloqueo =
        'Tienes adeudos pendientes. Debes cubrir las colegiaturas requeridas para reinscribirte.'
    } else {
      const periodo = await periodoInscripcionAbierto(supabase, alumno, cicloValor)
      aviso = periodo.aviso
      reinscripcionInfo = periodo.reinscripcion
      if (!periodo.abierto) {
        bloqueo = 'periodo-cerrado'
        mensajeBloqueo = periodo.aviso
      }
    }
  }

  const flujoActivo = bloqueo == null

  const solCompleta = solicitudCompleta(alumno)

  // Reinscritos: la reinscripción es para el ciclo SIGUIENTE (cen = alu_ce + 1) y se
  // cobra por diferidos (concepto 11 → 12). Un solo diferido NO completa el trámite.
  const calcReinscripcion = esReinscrito
    ? await calcularReinscripcionDiferido(supabase, alumno)
    : null

  const insPagada = calcReinscripcion
    ? calcReinscripcion.completa
    : inscripcionPagada(pagos, alumno, cicloValor, esReinscrito)
  const reciboHabilitado = await enReciboFinal(supabase, alumno.alumno_ref)

  if (calcReinscripcion) {
    reinscripcionInfo = {
      periodoInicio: reinscripcionInfo?.periodoInicio ?? null,
      fechaLimite: reinscripcionInfo?.fechaLimite ?? null,
      diferido: calcReinscripcion.diferido,
    }
  }

  // Importe pendiente del pago de inscripción/reinscripción (para guiar al papá).
  let montoInscripcion: number | null = null
  if (flujoActivo && solCompleta && !insPagada) {
    if (calcReinscripcion) {
      montoInscripcion = calcReinscripcion.pagable ? calcReinscripcion.monto : null
    } else {
      try {
        const filasInscripcion = await construirFilasInscripcionPortal(
          supabase,
          alumno,
          ciclo,
          pagos,
          esReinscrito
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
      estado: resolverEstadoPaso(solCompleta, flujoActivo),
      detalle: solCompleta
        ? alumno.alumno_registro
          ? `Registrada el ${alumno.alumno_registro}`
          : 'Datos listos para continuar'
        : 'Completa el formulario para habilitar los pagos.',
      fechaCompletado: alumno.alumno_registro ?? null,
      accion:
        flujoActivo && !solCompleta
          ? { tipo: 'ruta-interna', href: '/portal-inscripciones/solicitud', etiqueta: 'Completar solicitud' }
          : flujoActivo && solCompleta
            ? { tipo: 'ruta-interna', href: '/portal-inscripciones/solicitud', etiqueta: 'Actualizar solicitud' }
            : null,
  })

  pasos.push({
      id: 'reglamento',
      orden: 2,
      titulo: 'Reglamento escolar',
      descripcion: 'Imprime el reglamento, la carta compromiso y fírmala.',
      estado: resolverEstadoPaso(false, flujoActivo && solCompleta),
      detalle: solCompleta
        ? 'El enlace del reglamento y la carta compromiso estará disponible aquí.'
        : 'Se habilita al completar la solicitud.',
      accion:
        flujoActivo && solCompleta
          ? { tipo: 'proximo', href: '', etiqueta: 'Ver reglamento y carta compromiso' }
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
        flujoActivo && solCompleta,
        flujoActivo && solCompleta && !insPagada
      ),
      detalle: insPagada ? 'Pago registrado correctamente.' : 'Pendiente de pago.',
      accion:
        flujoActivo && solCompleta && !insPagada
          ? { tipo: 'ruta-interna', href: '/portal-inscripciones/pago', etiqueta: 'Pagar inscripción' }
          : insPagada
            ? { tipo: 'ruta-interna', href: '/portal-inscripciones/pago', etiqueta: 'Ver comprobante' }
            : null,
  })

  if (!esReinscrito) {
    pasos.push({
      id: 'documentos',
      orden: 4,
      titulo: 'Carga de documentos',
      descripcion: 'Solo alumnos de nuevo ingreso: expediente digital.',
      estado: resolverEstadoPaso(false, flujoActivo && solCompleta && insPagada),
      detalle: 'El enlace para cargar documentos estará disponible aquí.',
      accion:
        flujoActivo && solCompleta && insPagada
          ? { tipo: 'proximo', href: '', etiqueta: 'Cargar documentos' }
          : null,
    })
  }

  const ordenRecibo = esReinscrito ? 4 : 5
  const puedeRecibo = flujoActivo && insPagada && (reciboHabilitado || esReinscrito)

  pasos.push({
      id: 'recibo-final',
      orden: ordenRecibo,
      titulo: 'Recibo final',
      descripcion: 'Comprobante de proceso de inscripción completado.',
      estado: resolverEstadoPaso(
        reciboHabilitado && insPagada,
        puedeRecibo
      ),
      detalle: reciboHabilitado
        ? 'Tu recibo final está disponible.'
        : puedeRecibo
          ? 'Disponible al cerrar todos los pasos anteriores.'
          : 'Completa los pasos previos.',
      accion: null,
  })

  pasos.sort((a, b) => a.orden - b.orden)

  const pasosTotales = pasos.length
  const pasosCompletados = pasos.filter((p) => p.estado === 'completado').length
  const progresoPct =
    pasosTotales > 0 ? Math.round((pasosCompletados / pasosTotales) * 100) : 0

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
  }
}
