import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from './alumnoDatosService'
import type { PagoDetalleRegistro } from './pagoColegiaturaService'
import { cambioCicloMmDd, admisionesLegacyBaseUrl } from './portalAdmisionesConfig'
import { hoyIso, mmddHoy } from './portalAdmisionesCiclo'
import { colegiaturaRequeridaCubierta } from './portalAdmisionesColegiatura'
import {
  obtenerAutorizacionPortalDif2,
  tieneAccesoProrrogaDif1,
} from './portalAdmisionesProrroga'
import { tieneDiferido1Pagado } from './portalInscripcionesSolicitud'
import type { ReinscripcionDiferido } from './portalReinscripcionService'

export interface VentanasInscripcion {
  fechaIniDif1: string | null
  fechaFinDif1: string | null
  fechaIniDif2: string | null
  fechaFinDif2: string | null
}

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

function fechaValida(valor: unknown): string | null {
  const s = String(valor ?? '').slice(0, 10)
  return s && s !== '0000-00-00' ? s : null
}

export async function obtenerVentanasInscripcion(
  supabase: AppDatabaseClient,
  cen: number,
  alumnoMes: number
): Promise<VentanasInscripcion> {
  const vacio: VentanasInscripcion = {
    fechaIniDif1: null,
    fechaFinDif1: null,
    fechaIniDif2: null,
    fechaFinDif2: null,
  }

  const { data, error } = await supabase
    .from('iwc_gral_ins')
    .select('*')
    .eq('ins_ce', cen)
    .maybeSingle()

  if (error || !data) return vacio

  const fila = data as Record<string, unknown>
  // Plan 10 meses (mes=1) usa columnas legacy ins_cambio_lv_*;
  // plan 11 meses usa ins_normal_* (igual que prorroga_inscripcion.php).
  const usarPlan10Meses = alumnoMes === 1

  return {
    fechaIniDif1: fechaValida(
      usarPlan10Meses ? fila.ins_cambio_lv_dif1_ini : fila.ins_normal_dif1_ini
    ),
    fechaFinDif1: fechaValida(
      usarPlan10Meses ? fila.ins_cambio_lv_dif1_fin : fila.ins_normal_dif1_fin
    ),
    fechaIniDif2: fechaValida(
      usarPlan10Meses ? fila.ins_cambio_lv_dif2_ini : fila.ins_normal_dif2_ini
    ),
    fechaFinDif2: fechaValida(
      usarPlan10Meses ? fila.ins_cambio_lv_dif2_fin : fila.ins_normal_dif2_fin
    ),
  }
}

function proyectarAlumnoReinscripcion(alumno: AlumnoRegistro): {
  nivel: number
  grado: number
  ciclo: number
  cambioNivel: boolean
  graduado: boolean
  mensaje: string | null
} {
  let nivel = Number(alumno.alumno_nivel) || 0
  let grado = Number(alumno.alumno_grado) || 0
  let ciclo = Number(alumno.alumno_ciclo_escolar) || 0
  let cambioNivel = false
  let graduado = false
  let mensaje: string | null = null

  if (mmddHoy() < cambioCicloMmDd()) {
    ciclo++
    if (nivel === 1 && grado === 2) {
      nivel = 2
      grado = 1
      cambioNivel = true
      mensaje = 'Cambia de nivel a Kinder 1.'
    } else if (nivel === 2 && grado === 3) {
      nivel = 3
      grado = 1
      cambioNivel = true
      mensaje = 'Cambia de nivel a Primaria.'
    } else if (nivel === 3 && grado === 6) {
      nivel = 4
      grado = 1
      cambioNivel = true
      mensaje = 'Cambia de nivel a Secundaria.'
    } else if (nivel === 4 && grado === 3) {
      graduado = true
      mensaje = '¡Felicidades! El alumno ha egresado del Instituto Winston Churchill.'
    } else {
      grado++
    }
  } else if (nivel === 4 && grado === 3) {
    graduado = true
    mensaje = '¡Felicidades! El alumno ha egresado del Instituto Winston Churchill.'
  }

  return { nivel, grado, ciclo, cambioNivel, graduado, mensaje }
}

/**
 * Port de admisiones_estado_portal_inscripcion (reinscritos) + reglas loader.php
 * sin listas hardcodeadas de refs.
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
  const ventanas = await obtenerVentanasInscripcion(supabase, cen, alumnoMes)

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

  if (fechaIniDif1 && cd < fechaIniDif1 && !prorrogaDif1) {
    const col = colegiaturaRequeridaCubierta(pagos, alumnoRef, 'febrero', cen)
    base.msg2 = `Su primer periodo de reinscripción es de ${fechaIniDif1} al ${fechaFinDif1}.`
    if (!col.ok) {
      base.errorPagoPendiente = true
      base.msg3 = col.mensaje
    } else {
      base.msg3 =
        'Recuerde que es necesario no tener adeudos hasta este mes para validar su descuento de reinscripción.'
    }
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
    if (hasDif && authDif2.activa) {
      base.msg2 = `Autorización especial: puede realizar su pago de segundo diferido hasta el ${authDif2.vigenciaHasta}.`
      portalAbierto = true
      showInfo = true
    } else if (alumnoMes === 2 && hasDif) {
      base.msg2 = `Su segundo periodo de reinscripción será del ${fechaIniDif2} al ${fechaFinDif2}.`
      base.msg3 =
        'Su plan de pago es de 11 meses; el segundo diferido se habilitará en julio.'
      showInfo = true
    } else if (alumnoMes === 2 && !hasDif) {
      base.msg2 = 'Debe cubrir su inscripción completa (sin descuento de reinscripción).'
      portalAbierto = true
      showInfo = true
    } else {
      const tipoCol = alumnoMes === 1 ? 'junio' : 'julio'
      const col = colegiaturaRequeridaCubierta(pagos, alumnoRef, tipoCol, cen)
      base.msg2 = `Su segundo periodo de reinscripción es del ${fechaIniDif2} al ${fechaFinDif2}.`
      if (!col.ok) {
        base.errorPagoPendiente = true
        base.msg3 = col.mensaje
      }
    }
  } else if (fechaFinDif2 && cd > fechaFinDif2) {
    portalAbierto = true
    showInfo = true
    base.msg1 = null
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

export function puedeVerPasosInscripcion(
  alumno: AlumnoRegistro,
  esReinscrito: boolean,
  liberateInfo: boolean
): boolean {
  if (!liberateInfo) return false
  const mes = new Date().getMonth() + 1
  if (esReinscrito && mes < 3) return false
  return true
}
