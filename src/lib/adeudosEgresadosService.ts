import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from '@/lib/alumnoDatosService'
import { etiquetaCicloEscolar } from '@/lib/cicloEscolar'
import { getFullLevel } from '@/lib/boucherCore'
import { etiquetaEstatusAlumno } from '@/lib/alumnoStatus'

export type AlumnoPagoEgresadoRegistro = {
  alumno_id: number
  ciclo_valor: number
  activo: boolean
  con_recargos: boolean
  activado_en: string
  desactivado_en: string | null
  desactivado_motivo: string | null
  actualizado_en: string
}

export type EstadoAdeudoEgresado = {
  alumnoId: number
  alumnoRef: string
  nombre: string
  nivel: number
  grado: number
  gradoEtiqueta: string
  status: number
  statusEtiqueta: string
  cicloFicha: number
  /** Ciclo de adeudos en uso (activo o el sugerido al consultar). */
  cicloValor: number
  cicloEtiqueta: string
  /** Ciclo correcto según ficha (cursó / egreso−1). */
  cicloSugerido: number
  cicloSugeridoEtiqueta: string
  esEgresado: boolean
  activo: boolean
  conRecargos: boolean
  puedeActivar: boolean
  puedeDesactivar: boolean
  registro: AlumnoPagoEgresadoRegistro | null
}

function nombreAlumno(
  a: Pick<AlumnoRegistro, 'alumno_nombre' | 'alumno_app' | 'alumno_apm'>
): string {
  return [a.alumno_nombre, a.alumno_app, a.alumno_apm].filter(Boolean).join(' ').trim()
}

export function esAlumnoEgresadoOBaja(
  alumno: Pick<AlumnoRegistro, 'alumno_nivel' | 'alumno_grado' | 'alumno_status'>
): boolean {
  const nivel = Number(alumno.alumno_nivel)
  const grado = Number(alumno.alumno_grado)
  const status = Number(alumno.alumno_status)
  return status === 0 || (nivel === 4 && grado >= 4)
}

/**
 * Ciclo cuyos adeudos puede liquidar el egresado/baja:
 * - Secundaria grado 4 (ficha ya en año de egreso N): deudas del ciclo N−1.
 * - Baja aún en el ciclo que cursó: deudas de ese mismo ciclo (ficha).
 */
export function cicloAdeudosSugerido(
  alumno: Pick<AlumnoRegistro, 'alumno_nivel' | 'alumno_grado' | 'alumno_ciclo_escolar'>
): number {
  const cicloFicha = Number(alumno.alumno_ciclo_escolar) || 0
  const nivel = Number(alumno.alumno_nivel) || 0
  const grado = Number(alumno.alumno_grado) || 0
  if (cicloFicha <= 0) return 0
  if (nivel === 4 && grado >= 4) return Math.max(1, cicloFicha - 1)
  return cicloFicha
}

export async function obtenerRegistroAdeudoEgresado(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<AlumnoPagoEgresadoRegistro | null> {
  const { data, error } = await db
    .from('alumno_pago_egresado')
    .select(
      'alumno_id, ciclo_valor, activo, con_recargos, activado_en, desactivado_en, desactivado_motivo, actualizado_en'
    )
    .eq('alumno_id', alumnoId)
    .eq('ciclo_valor', cicloValor)
    .maybeSingle()

  if (error) {
    console.warn('obtenerRegistroAdeudoEgresado:', error.message)
    return null
  }
  if (!data) return null
  return {
    ...data,
    con_recargos: Boolean(data.con_recargos),
    activo: Boolean(data.activo),
  } as AlumnoPagoEgresadoRegistro
}

/** Cualquier ciclo con acceso activo (login / validación portal). */
export async function obtenerAdeudoEgresadoActivoPorAlumno(
  db: AppDatabaseClient,
  alumnoId: number
): Promise<AlumnoPagoEgresadoRegistro | null> {
  const { data, error } = await db
    .from('alumno_pago_egresado')
    .select(
      'alumno_id, ciclo_valor, activo, con_recargos, activado_en, desactivado_en, desactivado_motivo, actualizado_en'
    )
    .eq('alumno_id', alumnoId)
    .eq('activo', true)
    .order('ciclo_valor', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('obtenerAdeudoEgresadoActivoPorAlumno:', error.message)
    return null
  }
  if (!data) return null
  return {
    ...data,
    con_recargos: Boolean(data.con_recargos),
    activo: Boolean(data.activo),
  } as AlumnoPagoEgresadoRegistro
}

export async function alumnoTieneAdeudoEgresadoActivo(
  db: AppDatabaseClient,
  alumnoId: number
): Promise<boolean> {
  const reg = await obtenerAdeudoEgresadoActivoPorAlumno(db, alumnoId)
  return Boolean(reg?.activo)
}

/**
 * True si el alumno puede omitir recargos en el ciclo (flag activo + sin recargos).
 */
export async function omitirRecargosAdeudoEgresado(
  db: AppDatabaseClient,
  alumnoId: number,
  cicloValor: number
): Promise<boolean> {
  const reg = await obtenerRegistroAdeudoEgresado(db, alumnoId, cicloValor)
  return Boolean(reg?.activo && !reg.con_recargos)
}

export async function consultarEstadoAdeudoEgresado(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  _cicloValorIgnorado?: number
): Promise<EstadoAdeudoEgresado> {
  const cicloSugerido = cicloAdeudosSugerido(alumno)
  const activoReg = await obtenerAdeudoEgresadoActivoPorAlumno(db, alumno.alumno_id)
  const cicloValor = activoReg?.activo
    ? activoReg.ciclo_valor
    : cicloSugerido
  const reg =
    activoReg ??
    (cicloSugerido > 0
      ? await obtenerRegistroAdeudoEgresado(db, alumno.alumno_id, cicloSugerido)
      : null)
  const esEgresado = esAlumnoEgresadoOBaja(alumno)
  const activo = Boolean(activoReg?.activo)
  const conRecargos = activoReg ? Boolean(activoReg.con_recargos) : true

  return {
    alumnoId: alumno.alumno_id,
    alumnoRef: String(alumno.alumno_ref),
    nombre: nombreAlumno(alumno),
    nivel: Number(alumno.alumno_nivel) || 0,
    grado: Number(alumno.alumno_grado) || 0,
    gradoEtiqueta: getFullLevel(
      Number(alumno.alumno_nivel) || 0,
      Number(alumno.alumno_grado) || 0
    ),
    status: Number(alumno.alumno_status) || 0,
    statusEtiqueta: etiquetaEstatusAlumno(alumno.alumno_status),
    cicloFicha: Number(alumno.alumno_ciclo_escolar) || 0,
    cicloValor,
    cicloEtiqueta: etiquetaCicloEscolar(cicloValor) || String(cicloValor),
    cicloSugerido,
    cicloSugeridoEtiqueta:
      etiquetaCicloEscolar(cicloSugerido) || String(cicloSugerido),
    esEgresado,
    activo,
    conRecargos,
    puedeActivar: !activo,
    puedeDesactivar: activo,
    registro: reg,
  }
}

async function desactivarTodosLosCiclos(
  db: AppDatabaseClient,
  alumnoId: number,
  motivo: string
): Promise<void> {
  const ahora = new Date().toISOString()
  const { error } = await db
    .from('alumno_pago_egresado')
    .update({
      activo: false,
      desactivado_en: ahora,
      desactivado_motivo: motivo,
      actualizado_en: ahora,
    })
    .eq('alumno_id', alumnoId)
    .eq('activo', true)

  if (error) {
    console.error('desactivarTodosLosCiclos:', error.message)
    throw new Error(error.message)
  }
}

export async function activarAdeudoEgresado(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  _cicloValorIgnorado: number,
  conRecargos: boolean
): Promise<{ ok: true; estado: EstadoAdeudoEgresado } | { ok: false; error: string }> {
  const cicloValor = cicloAdeudosSugerido(alumno)
  if (!Number.isFinite(cicloValor) || cicloValor <= 0) {
    return { ok: false, error: 'No se pudo determinar el ciclo de adeudos de la ficha.' }
  }

  const ahora = new Date().toISOString()
  try {
    await desactivarTodosLosCiclos(
      db,
      alumno.alumno_id,
      'Reemplazado al activar otro ciclo de adeudos'
    )
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al limpiar accesos previos' }
  }

  const payload = {
    alumno_id: alumno.alumno_id,
    ciclo_valor: cicloValor,
    activo: true,
    con_recargos: Boolean(conRecargos),
    activado_en: ahora,
    desactivado_en: null,
    desactivado_motivo: null,
    actualizado_en: ahora,
  }

  const { error } = await db.from('alumno_pago_egresado').upsert(payload, {
    onConflict: 'alumno_id,ciclo_valor',
  })

  if (error) {
    console.error('activarAdeudoEgresado:', error.message)
    return { ok: false, error: error.message }
  }

  const estado = await consultarEstadoAdeudoEgresado(db, alumno)
  return { ok: true, estado }
}

export async function desactivarAdeudoEgresado(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  _cicloValorIgnorado?: number,
  motivo = 'Desactivado desde módulo Adeudos egresados'
): Promise<{ ok: true; estado: EstadoAdeudoEgresado } | { ok: false; error: string }> {
  const activo = await obtenerAdeudoEgresadoActivoPorAlumno(db, alumno.alumno_id)
  if (!activo) {
    return { ok: false, error: 'No hay acceso activo para desactivar.' }
  }

  try {
    await desactivarTodosLosCiclos(db, alumno.alumno_id, motivo)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al desactivar' }
  }

  const estado = await consultarEstadoAdeudoEgresado(db, alumno)
  return { ok: true, estado }
}

export async function actualizarRecargosAdeudoEgresado(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  _cicloValorIgnorado: number,
  conRecargos: boolean
): Promise<{ ok: true; estado: EstadoAdeudoEgresado } | { ok: false; error: string }> {
  const activo = await obtenerAdeudoEgresadoActivoPorAlumno(db, alumno.alumno_id)
  if (!activo) {
    return { ok: false, error: 'Activa el acceso antes de cambiar recargos.' }
  }

  const ahora = new Date().toISOString()
  const { error } = await db
    .from('alumno_pago_egresado')
    .update({
      con_recargos: Boolean(conRecargos),
      actualizado_en: ahora,
    })
    .eq('alumno_id', alumno.alumno_id)
    .eq('ciclo_valor', activo.ciclo_valor)

  if (error) {
    console.error('actualizarRecargosAdeudoEgresado:', error.message)
    return { ok: false, error: error.message }
  }

  const estado = await consultarEstadoAdeudoEgresado(db, alumno)
  return { ok: true, estado }
}
