import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import { admisionesLegacyBaseUrl } from './portalAdmisionesConfig'
import { hoyIso } from './portalAdmisionesCiclo'
import { colegiaturaRequeridaCubierta } from './portalAdmisionesColegiatura'
import {
  obtenerAutorizacionPortalDif2,
  tieneAccesoProrrogaDif1,
} from './portalAdmisionesProrroga'
import {
  obtenerVentanasInscripcion,
  type VentanasInscripcion,
} from './portalAdmisionesVentanas'
import { tieneDiferido1Pagado } from './portalInscripcionesSolicitud'
import { proyectarReinscripcionAlumno } from './portalReinscripcionProyeccion'
import {
  corteDiciembrePostDif2,
  type ReinscripcionDiferido,
} from './portalReinscripcionService'

export type { VentanasInscripcion }
export { obtenerVentanasInscripcion }

export interface EstadoVentanaPortal {
  showInfo: boolean
  liberateInfo: boolean
  showPayment: boolean
  errorPagoPendiente: boolean
  msg1: string | null
  msg2: string | null
  msg3: string | null
  ventanas: VentanasInscripcion
  hasDif: boolean
  graduated: boolean
  cambioNivel: boolean
  mensajeCambioNivel: string | null
  nivelProyectado: number
  gradoProyectado: number
  cicloProyectado: number
}

function proyectarAlumnoReinscripcion(alumno: AlumnoRegistro): {
  nivel: number
  grado: number
  ciclo: number
  cambioNivel: boolean
  graduado: boolean
  mensaje: string | null
} {
  const proy = proyectarReinscripcionAlumno(alumno)
  return {
    nivel: proy.nivel,
    grado: proy.grado,
    ciclo: proy.cicloDestino,
    cambioNivel: proy.cambioNivel,
    graduado: proy.graduado,
    mensaje: proy.mensaje,
  }
}

/**
 * Port de admisiones_estado_portal_inscripcion (reinscritos) + reglas portal:
 * hueco Dif1→Dif2 cerrado; post-Dif2 abierto hasta 31-dic; luego mensaje de fechas.
 */
export async function evaluarVentanaPortalReinscrito(
  supabase: AppDatabaseClient,
  alumno: AlumnoRegistro,
  pagos: PagoDetalleRegistro[],
  cen: number,
  calc: ReinscripcionDiferido
): Promise<EstadoVentanaPortal> {
  const cd = hoyIso()
  const alumnoMes = Number(alumno.mes ?? 0)
  const alumnoRef = Number(alumno.alumno_ref)
  const proy = proyectarAlumnoReinscripcion(alumno)
  const ventanas = calc.ventanas ?? (await obtenerVentanasInscripcion(supabase, cen, alumnoMes))

  const base: EstadoVentanaPortal = {
    showInfo: false,
    liberateInfo: false,
    showPayment: false,
    errorPagoPendiente: false,
    msg1: proy.mensaje,
    msg2: null,
    msg3: null,
    ventanas,
    hasDif: tieneDiferido1Pagado(pagos, alumnoRef, cen),
    graduated: proy.graduado,
    cambioNivel: proy.cambioNivel,
    mensajeCambioNivel: proy.cambioNivel ? proy.mensaje : null,
    nivelProyectado: proy.nivel,
    gradoProyectado: proy.grado,
    cicloProyectado: proy.ciclo,
  }

  if (proy.graduado) return base

  const { fechaIniDif1, fechaFinDif1, fechaIniDif2, fechaFinDif2 } = ventanas
  const hasDif = base.hasDif
  const prorrogaDif1 = await tieneAccesoProrrogaDif1(supabase, alumnoRef, cen)
  const authDif2 = await obtenerAutorizacionPortalDif2(supabase, alumnoRef, cen)

  const pagable = calc.pagable && calc.monto > 0
  let portalAbierto = false
  let showInfo = false

  if (!fechaIniDif1 || !fechaFinDif1 || !fechaIniDif2 || !fechaFinDif2) {
    base.msg2 = 'Aún no hay fechas de reinscripción registradas para este ciclo.'
    showInfo = true
  } else if (fechaFinDif2 && cd > corteDiciembrePostDif2(fechaFinDif2)) {
    // Regla 9: a partir del año siguiente, solo mensaje de fechas.
    base.msg2 = `El portal de reinscripción se abre en las fechas registradas: primer periodo del ${fechaIniDif1} al ${fechaFinDif1}; segundo periodo del ${fechaIniDif2} al ${fechaFinDif2}.`
    showInfo = true
  } else if (fechaIniDif1 && cd < fechaIniDif1 && !prorrogaDif1) {
    const col = colegiaturaRequeridaCubierta(pagos, alumnoRef, 'febrero', cen)
    base.msg2 = `Su primer periodo de reinscripción es de ${fechaIniDif1} al ${fechaFinDif1}.`
    if (!col.ok) {
      base.errorPagoPendiente = true
      base.msg3 = col.mensaje
    } else {
      base.msg3 =
        'Recuerde que es necesario no tener adeudos hasta este mes para validar su descuento de reinscripción.'
    }
    showInfo = true
  } else if (
    fechaIniDif2 &&
    fechaFinDif2 &&
    cd >= fechaIniDif2 &&
    cd <= fechaFinDif2
  ) {
    const tipoCol = alumnoMes === 1 ? 'junio' : 'julio'
    const col = colegiaturaRequeridaCubierta(pagos, alumnoRef, tipoCol, cen)
    if (!col.ok && !authDif2.activa) {
      base.errorPagoPendiente = true
      base.msg3 = col.mensaje
      showInfo = true
    } else {
      base.msg2 = `Bienvenido al segundo periodo de reinscripción del ${fechaIniDif2} al ${fechaFinDif2}.`
      portalAbierto = true
      showInfo = true
    }
  } else if (
    !hasDif &&
    ((fechaIniDif1 &&
      fechaFinDif1 &&
      cd >= fechaIniDif1 &&
      cd <= fechaFinDif1) ||
      (prorrogaDif1 && fechaIniDif2 && cd < fechaIniDif2))
  ) {
    if (prorrogaDif1) {
      portalAbierto = true
      showInfo = true
    } else {
      const col = colegiaturaRequeridaCubierta(pagos, alumnoRef, 'febrero', cen)
      if (!col.ok) {
        base.errorPagoPendiente = true
        base.msg3 = col.mensaje
        showInfo = true
      } else {
        portalAbierto = true
        showInfo = true
      }
    }
  } else if (
    hasDif &&
    fechaIniDif1 &&
    fechaFinDif1 &&
    cd >= fechaIniDif1 &&
    cd <= fechaFinDif1
  ) {
    base.msg2 = 'Ya registró su pago del primer periodo de reinscripción.'
    base.msg3 = `El segundo periodo será del ${fechaIniDif2} al ${fechaFinDif2}.`
    showInfo = true
  } else if (
    fechaFinDif1 &&
    fechaIniDif2 &&
    cd > fechaFinDif1 &&
    cd < fechaIniDif2
  ) {
    // Regla 7: hueco cerrado para reinscritos (salvo autorización Dif2).
    if (hasDif && authDif2.activa) {
      base.msg2 = `Autorización especial: puede realizar su pago de segundo diferido hasta el ${authDif2.vigenciaHasta}.`
      portalAbierto = true
      showInfo = true
    } else if (prorrogaDif1 && !hasDif) {
      portalAbierto = true
      showInfo = true
    } else {
      base.msg2 =
        'Por el momento no son las fechas para reinscripción. El segundo periodo será del ' +
        `${fechaIniDif2} al ${fechaFinDif2}.`
      if (hasDif) {
        base.msg3 =
          alumnoMes === 2
            ? 'Su plan de pago es de 11 meses; el segundo diferido se habilitará en julio.'
            : 'Conserve su comprobante del primer diferido para el segundo periodo.'
      } else {
        base.msg3 =
          'Si no cubrió el primer diferido, podrá pagar la inscripción completa (sin descuento) en el segundo periodo o después.'
      }
      showInfo = true
    }
  } else if (fechaFinDif2 && cd > fechaFinDif2) {
    // Regla 8 + 9: abierto hasta 31-dic del año de los diferidos.
    portalAbierto = true
    showInfo = true
    base.msg1 = null
    if (pagable) {
      base.msg2 = hasDif
        ? 'Periodo de descuento cerrado. Debe cubrir el restante de su reinscripción (segundo diferido).'
        : 'Periodo de descuento cerrado. Debe cubrir su inscripción completa (sin descuento de reinscripción).'
    }
  }

  base.showInfo = showInfo || portalAbierto
  base.liberateInfo = portalAbierto
  base.showPayment = portalAbierto && pagable && !calc.completa

  return base
}

export interface EstadoVentanaNuevoIngreso {
  showInfo: boolean
  liberateInfo: boolean
  showPayment: boolean
  msg1: string | null
}

/** Nuevo ingreso: port simplificado de admisiones_estado_portal_inscripcion (alu_nvo=1). */
export function evaluarVentanaPortalNuevoIngreso(
  alumno: AlumnoRegistro,
  inscripcionPagada: boolean,
  pagable: boolean
): EstadoVentanaNuevoIngreso {
  const status = Number(alumno.alumno_status)
  const showInfo = status === 1 || status === 2

  return {
    showInfo,
    liberateInfo: showInfo,
    showPayment: inscripcionPagada || (pagable && showInfo),
    msg1: null,
  }
}

export function urlComprobanteInscripcionLegacy(alumnoRef: number, ciclo: number): string {
  return `${admisionesLegacyBaseUrl()}/compPago.php`
}

export function urlReciboFinalLegacy(): string {
  return `${admisionesLegacyBaseUrl().replace(/\/admisiones$/, '')}/recibo_final/alumno/alu.php`
}

/** Visibilidad de pasos: solo depende de liberateInfo (ya no bloquea ene–feb). */
export function puedeVerPasosInscripcion(
  _alumno: AlumnoRegistro,
  _esReinscrito: boolean,
  liberateInfo: boolean
): boolean {
  return liberateInfo
}
