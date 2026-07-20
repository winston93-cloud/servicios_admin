import { normalizarCurp } from './curp'
import { supabase } from './supabase'
import { TUTOR_ID_MADRE, TUTOR_ID_PADRE } from './alumnoFamiliarTutor'

const SELECT_FAMILIAR =
  'familiar_id, alumno_id, tutor_id, familiar_app, familiar_apm, familiar_nombre, familiar_tel, familiar_cel, familiar_email, familiar_recibir_email, familiar_curp, familiar_empresa_tel'

export interface AlumnoFamiliarRegistro {
  familiar_id: number
  alumno_id: number
  tutor_id: number
  familiar_app?: string | null
  familiar_apm?: string | null
  familiar_nombre?: string | null
  familiar_tel?: string | null
  familiar_cel?: string | null
  familiar_email?: string | null
  familiar_recibir_email: number
  familiar_curp?: string | null
  familiar_empresa_tel?: string | null
}

export interface SnapshotDatosFamiliar {
  apellidoPaterno: string
  apellidoMaterno: string
  nombre: string
  email: string
  recibirEmail: number
  telefonoCasa: string
  celular: string
  telefonoTrabajo: string
  curp: string
}

/** @deprecated Usar SnapshotDatosFamiliar */
export type SnapshotDatosFamiliarMadre = SnapshotDatosFamiliar

export function snapshotDatosFamiliarDesdeRegistro(
  reg: AlumnoFamiliarRegistro | null
): SnapshotDatosFamiliar {
  if (!reg) {
    return {
      apellidoPaterno: '',
      apellidoMaterno: '',
      nombre: '',
      email: '',
      recibirEmail: 1,
      telefonoCasa: '',
      celular: '',
      telefonoTrabajo: '',
      curp: '',
    }
  }
  return {
    apellidoPaterno: reg.familiar_app ?? '',
    apellidoMaterno: reg.familiar_apm ?? '',
    nombre: reg.familiar_nombre ?? '',
    email: reg.familiar_email ?? '',
    recibirEmail: reg.familiar_recibir_email === 0 ? 0 : 1,
    telefonoCasa: reg.familiar_tel ?? '',
    celular: reg.familiar_cel ?? '',
    telefonoTrabajo: reg.familiar_empresa_tel ?? '',
    curp: normalizarCurp(reg.familiar_curp ?? ''),
  }
}

export const snapshotDatosFamiliarMadreDesdeRegistro = snapshotDatosFamiliarDesdeRegistro

export function snapshotsDatosFamiliarIguales(
  a: SnapshotDatosFamiliar,
  b: SnapshotDatosFamiliar
): boolean {
  return (
    a.apellidoPaterno === b.apellidoPaterno &&
    a.apellidoMaterno === b.apellidoMaterno &&
    a.nombre === b.nombre &&
    a.email === b.email &&
    a.recibirEmail === b.recibirEmail &&
    a.telefonoCasa === b.telefonoCasa &&
    a.celular === b.celular &&
    a.telefonoTrabajo === b.telefonoTrabajo &&
    a.curp === b.curp
  )
}

export const snapshotsDatosFamiliarMadreIguales = snapshotsDatosFamiliarIguales

export async function obtenerFamiliarPorAlumnoId(
  alumnoId: number,
  tutorId: number
): Promise<AlumnoFamiliarRegistro | null> {
  const { data, error } = await supabase
    .from('alumno_familiar')
    .select(SELECT_FAMILIAR)
    .eq('alumno_id', alumnoId)
    .eq('tutor_id', tutorId)
    .order('familiar_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error al cargar familiar:', error)
    return null
  }

  return data as AlumnoFamiliarRegistro | null
}

export async function obtenerFamiliarMadrePorAlumnoId(
  alumnoId: number
): Promise<AlumnoFamiliarRegistro | null> {
  return obtenerFamiliarPorAlumnoId(alumnoId, TUTOR_ID_MADRE)
}

export async function obtenerFamiliarPadrePorAlumnoId(
  alumnoId: number
): Promise<AlumnoFamiliarRegistro | null> {
  return obtenerFamiliarPorAlumnoId(alumnoId, TUTOR_ID_PADRE)
}

export interface GuardarDatosFamiliarPayload extends SnapshotDatosFamiliar {
  alumnoId: number
  familiarId: number | null
  tutorId: number
}

export type ResultadoGuardarFamiliar =
  | { ok: true; familiarId: number }
  | { ok: false; mensaje: string }

export type ResultadoGuardarFamiliarMadre = ResultadoGuardarFamiliar

export async function guardarDatosFamiliar(
  payload: GuardarDatosFamiliarPayload
): Promise<ResultadoGuardarFamiliar> {
  const fila = {
    familiar_app: payload.apellidoPaterno.trim() || null,
    familiar_apm: payload.apellidoMaterno.trim() || null,
    familiar_nombre: payload.nombre.trim() || null,
    familiar_email: payload.email.trim() || null,
    familiar_recibir_email: payload.recibirEmail === 0 ? 0 : 1,
    familiar_tel: payload.telefonoCasa.trim() || null,
    familiar_cel: payload.celular.trim() || null,
    familiar_empresa_tel: payload.telefonoTrabajo.trim() || null,
    familiar_curp: normalizarCurp(payload.curp) || null,
  }

  if (payload.familiarId != null) {
    const { error } = await supabase
      .from('alumno_familiar')
      .update(fila)
      .eq('familiar_id', payload.familiarId)

    if (error) {
      console.error('Error al actualizar familiar:', error)
      return { ok: false, mensaje: error.message }
    }

    return { ok: true, familiarId: payload.familiarId }
  }

  const { data: existente } = await supabase
    .from('alumno_familiar')
    .select('familiar_id')
    .eq('alumno_id', payload.alumnoId)
    .eq('tutor_id', payload.tutorId)
    .order('familiar_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existente?.familiar_id != null) {
    const familiarId = Number(existente.familiar_id)
    const { error } = await supabase
      .from('alumno_familiar')
      .update(fila)
      .eq('familiar_id', familiarId)
    if (error) {
      console.error('Error al actualizar familiar existente:', error)
      return { ok: false, mensaje: error.message }
    }
    return { ok: true, familiarId }
  }

  const filaInsert = {
    alumno_id: payload.alumnoId,
    tutor_id: payload.tutorId,
    ...fila,
    familiar_vive: 1,
    familiar_factura: 0,
  }

  let { data, error } = await supabase
    .from('alumno_familiar')
    .insert(filaInsert)
    .select('familiar_id')
    .single()

  if (error && (error.code === '23505' || error.message?.includes('duplicate key'))) {
    const { data: maxRow } = await supabase
      .from('alumno_familiar')
      .select('familiar_id')
      .order('familiar_id', { ascending: false })
      .limit(1)
      .maybeSingle()
    const siguienteId = (maxRow?.familiar_id ?? 0) + 1
    const reintento = await supabase
      .from('alumno_familiar')
      .insert({ ...filaInsert, familiar_id: siguienteId })
      .select('familiar_id')
      .single()
    data = reintento.data
    error = reintento.error
  }

  if (error || data == null) {
    console.error('Error al crear familiar:', error)
    return { ok: false, mensaje: error?.message ?? 'No se pudo crear el familiar.' }
  }

  return { ok: true, familiarId: data.familiar_id }
}

export async function guardarDatosFamiliarMadre(
  payload: Omit<GuardarDatosFamiliarPayload, 'tutorId'> & { tutorId?: number }
): Promise<ResultadoGuardarFamiliar> {
  return guardarDatosFamiliar({ ...payload, tutorId: payload.tutorId ?? TUTOR_ID_MADRE })
}

export async function guardarDatosFamiliarPadre(
  payload: Omit<GuardarDatosFamiliarPayload, 'tutorId'> & { tutorId?: number }
): Promise<ResultadoGuardarFamiliar> {
  return guardarDatosFamiliar({ ...payload, tutorId: payload.tutorId ?? TUTOR_ID_PADRE })
}
