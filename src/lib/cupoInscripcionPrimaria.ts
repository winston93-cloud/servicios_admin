/**
 * Cupo máximo de TOTAL INSCRITOS (reporte 2.º diferido) para 3° y 5° de Primaria.
 * Misma métrica que `cargarMatrizInscripciones(ciclo, 'dif2')`: RI INSCRITOS + NI INSCRITOS.
 */
import { formaIngresoPorDefecto } from '@/lib/alumnoFormaIngreso'
import type { AlumnoRegistro } from '@/lib/alumnoDatosService'
import {
  cargarMatrizInscripciones,
  etiquetaNivelInscripciones,
} from '@/lib/reportes/inscripcionesAdminService'
import { resolverCicloInscripcionSistemaValor } from '@/lib/ciclosEscolaresService'
import { proyectarReinscripcionAlumno } from '@/lib/portalReinscripcionProyeccion'

export const CUPO_MAX_PRIMARIA_ESPECIAL = 60

/** Solo estos grados (nivel Primaria = 3). */
export const GRADOS_CUPO_LIMITADO: ReadonlyArray<{ nivel: number; grado: number }> = [
  { nivel: 3, grado: 3 },
  { nivel: 3, grado: 5 },
]

export const MENSAJE_CUPO_LLENO =
  'Por el momento el cupo de este grado se encuentra completo. Agradecemos su comprensión y le invitamos a comunicarse con Administración o Control Escolar ante cualquier apertura o indicación adicional.'

export type ConsultaCupoInscripcion = {
  aplica: boolean
  nivel: number
  grado: number
  etiqueta: string
  totalInscritos: number
  max: number
  lleno: boolean
  cicloInscripcion: number
  mensaje: string | null
}

export function aplicaCupoLimitado(nivel: number, grado: number): boolean {
  return GRADOS_CUPO_LIMITADO.some((g) => g.nivel === nivel && g.grado === grado)
}

export function mensajeCupoLleno(nivel: number, grado: number): string {
  const etiqueta = etiquetaNivelInscripciones(nivel, grado)
  return `Por el momento el cupo de ${etiqueta} se encuentra completo. Agradecemos su comprensión y le invitamos a comunicarse con Administración o Control Escolar ante cualquier apertura o indicación adicional.`
}

/** grade_level AgendaW → { nivel, grado } MySQL (primaria_3 → 3,3). */
export function nivelGradoDesdeGradeLevelAgenda(
  level: string,
  gradeLevel: string | null | undefined
): { nivel: number; grado: number } | null {
  const lvl = String(level ?? '').trim().toLowerCase()
  const raw = String(gradeLevel ?? '').trim().toLowerCase()
  if (!lvl || !raw) return null

  if (lvl === 'maternal') {
    if (raw.includes('b') || raw.endsWith('_2')) return { nivel: 1, grado: 2 }
    return { nivel: 1, grado: 1 }
  }
  if (lvl === 'kinder') {
    const n = Number(raw.match(/(\d+)$/)?.[1] ?? 1)
    return { nivel: 2, grado: n >= 1 && n <= 3 ? n : 1 }
  }
  if (lvl === 'primaria') {
    const n = Number(raw.match(/(\d+)$/)?.[1] ?? 0)
    if (n >= 1 && n <= 6) return { nivel: 3, grado: n }
    return null
  }
  if (lvl === 'secundaria') {
    const n = Number(raw.match(/(\d+)$/)?.[1] ?? 0)
    if (n === 7 || n === 1) return { nivel: 4, grado: 1 }
    if (n === 8 || n === 2) return { nivel: 4, grado: 2 }
    if (n === 9 || n === 3) return { nivel: 4, grado: 3 }
    return null
  }
  return null
}

/**
 * TOTAL INSCRITOS del reporte 2.º diferido para un grado
 * (= RI INSCRITOS + NI INSCRITOS).
 */
export async function totalInscritosDif2(
  nivel: number,
  grado: number,
  cicloInscripcion?: number
): Promise<{ total: number; cicloInscripcion: number }> {
  const ciclo = cicloInscripcion ?? (await resolverCicloInscripcionSistemaValor())
  const matriz = await cargarMatrizInscripciones(ciclo, 'dif2')
  const etiqueta = etiquetaNivelInscripciones(nivel, grado)
  const fila = matriz.filas.find((f) => !f.esTotales && f.nivelLabel === etiqueta)
  const total = (fila?.riPag ?? 0) + (fila?.niPag ?? 0)
  return { total, cicloInscripcion: ciclo }
}

export async function consultarCupoInscripcion(
  nivel: number,
  grado: number,
  cicloInscripcion?: number
): Promise<ConsultaCupoInscripcion> {
  const etiqueta = etiquetaNivelInscripciones(nivel, grado)
  const aplica = aplicaCupoLimitado(nivel, grado)
  if (!aplica) {
    const ciclo = cicloInscripcion ?? (await resolverCicloInscripcionSistemaValor())
    return {
      aplica: false,
      nivel,
      grado,
      etiqueta,
      totalInscritos: 0,
      max: CUPO_MAX_PRIMARIA_ESPECIAL,
      lleno: false,
      cicloInscripcion: ciclo,
      mensaje: null,
    }
  }

  const { total, cicloInscripcion: ciclo } = await totalInscritosDif2(
    nivel,
    grado,
    cicloInscripcion
  )
  const lleno = total >= CUPO_MAX_PRIMARIA_ESPECIAL
  return {
    aplica: true,
    nivel,
    grado,
    etiqueta,
    totalInscritos: total,
    max: CUPO_MAX_PRIMARIA_ESPECIAL,
    lleno,
    cicloInscripcion: ciclo,
    mensaje: lleno ? mensajeCupoLleno(nivel, grado) : null,
  }
}

/**
 * Grado de inscripción a evaluar en el portal (destino RI o ficha NI).
 */
export function gradoInscripcionPortal(
  alumno: Pick<
    AlumnoRegistro,
    'alumno_nuevo_ingreso' | 'alumno_nivel' | 'alumno_grado' | 'alumno_ciclo_escolar'
  >,
  cicloTemporadaActual: number
): { nivel: number; grado: number } {
  const esReinscrito = formaIngresoPorDefecto(alumno.alumno_nuevo_ingreso) === 0
  if (esReinscrito) {
    const proy = proyectarReinscripcionAlumno(alumno, cicloTemporadaActual)
    return { nivel: proy.nivel, grado: proy.grado }
  }
  return {
    nivel: Number(alumno.alumno_nivel) || 0,
    grado: Number(alumno.alumno_grado) || 0,
  }
}

/**
 * Bloqueo de cupo para portal / pagos de inscripción.
 * No aplica si el alumno ya pagó la inscripción (ya cuenta en el total).
 */
export async function evaluarBloqueoCupoPortal(opts: {
  alumno: Pick<
    AlumnoRegistro,
    'alumno_nuevo_ingreso' | 'alumno_nivel' | 'alumno_grado' | 'alumno_ciclo_escolar'
  >
  cicloTemporadaActual: number
  /** true si ya cubrió inscripción/reinscripción del ciclo destino. */
  yaInscrito: boolean
  cicloInscripcion?: number
}): Promise<ConsultaCupoInscripcion | null> {
  if (opts.yaInscrito) return null

  const { nivel, grado } = gradoInscripcionPortal(
    opts.alumno,
    opts.cicloTemporadaActual
  )
  if (!aplicaCupoLimitado(nivel, grado)) return null

  const consulta = await consultarCupoInscripcion(nivel, grado, opts.cicloInscripcion)
  return consulta.lleno ? consulta : null
}

export class CupoLlenoError extends Error {
  readonly code = 'CUPO_LLENO' as const
  readonly consulta: ConsultaCupoInscripcion

  constructor(consulta: ConsultaCupoInscripcion) {
    super(consulta.mensaje ?? MENSAJE_CUPO_LLENO)
    this.name = 'CupoLlenoError'
    this.consulta = consulta
  }
}

/** Lanza si el grado con cupo limitado ya alcanzó el máximo. */
export async function assertCupoDisponible(
  nivel: number,
  grado: number,
  cicloInscripcion?: number
): Promise<ConsultaCupoInscripcion> {
  const consulta = await consultarCupoInscripcion(nivel, grado, cicloInscripcion)
  if (consulta.lleno) throw new CupoLlenoError(consulta)
  return consulta
}
