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
  cicloValor: number
  cicloEtiqueta: string
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
  cicloValor: number
): Promise<EstadoAdeudoEgresado> {
  const reg = await obtenerRegistroAdeudoEgresado(db, alumno.alumno_id, cicloValor)
  const esEgresado = esAlumnoEgresadoOBaja(alumno)
  const activo = Boolean(reg?.activo)
  const conRecargos = reg ? Boolean(reg.con_recargos) : true

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
    esEgresado,
    activo,
    conRecargos,
    puedeActivar: !activo,
    puedeDesactivar: activo,
    registro: reg,
  }
}

export async function activarAdeudoEgresado(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  conRecargos: boolean
): Promise<{ ok: true; estado: EstadoAdeudoEgresado } | { ok: false; error: string }> {
  if (!Number.isFinite(cicloValor) || cicloValor <= 0) {
    return { ok: false, error: 'Ciclo inválido.' }
  }

  const ahora = new Date().toISOString()
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

  const estado = await consultarEstadoAdeudoEgresado(db, alumno, cicloValor)
  return { ok: true, estado }
}

export async function desactivarAdeudoEgresado(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  motivo = 'Desactivado desde módulo Adeudos egresados'
): Promise<{ ok: true; estado: EstadoAdeudoEgresado } | { ok: false; error: string }> {
  const reg = await obtenerRegistroAdeudoEgresado(db, alumno.alumno_id, cicloValor)
  if (!reg?.activo) {
    return { ok: false, error: 'No hay acceso activo para desactivar.' }
  }

  const ahora = new Date().toISOString()
  const { error } = await db
    .from('alumno_pago_egresado')
    .update({
      activo: false,
      desactivado_en: ahora,
      desactivado_motivo: motivo,
      actualizado_en: ahora,
    })
    .eq('alumno_id', alumno.alumno_id)
    .eq('ciclo_valor', cicloValor)

  if (error) {
    console.error('desactivarAdeudoEgresado:', error.message)
    return { ok: false, error: error.message }
  }

  const estado = await consultarEstadoAdeudoEgresado(db, alumno, cicloValor)
  return { ok: true, estado }
}

export async function actualizarRecargosAdeudoEgresado(
  db: AppDatabaseClient,
  alumno: AlumnoRegistro,
  cicloValor: number,
  conRecargos: boolean
): Promise<{ ok: true; estado: EstadoAdeudoEgresado } | { ok: false; error: string }> {
  const reg = await obtenerRegistroAdeudoEgresado(db, alumno.alumno_id, cicloValor)
  if (!reg?.activo) {
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
    .eq('ciclo_valor', cicloValor)

  if (error) {
    console.error('actualizarRecargosAdeudoEgresado:', error.message)
    return { ok: false, error: error.message }
  }

  const estado = await consultarEstadoAdeudoEgresado(db, alumno, cicloValor)
  return { ok: true, estado }
}
