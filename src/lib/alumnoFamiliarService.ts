import { normalizarCurp } from './curp'
import { supabase } from './supabase'
import { TUTOR_ID_MADRE } from './alumnoFamiliarTutor'

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

export interface SnapshotDatosFamiliarMadre {
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

export function snapshotDatosFamiliarMadreDesdeRegistro(
  reg: AlumnoFamiliarRegistro | null
): SnapshotDatosFamiliarMadre {
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

export function snapshotsDatosFamiliarMadreIguales(
  a: SnapshotDatosFamiliarMadre,
  b: SnapshotDatosFamiliarMadre
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

export async function obtenerFamiliarMadrePorAlumnoId(
  alumnoId: number
): Promise<AlumnoFamiliarRegistro | null> {
  const { data, error } = await supabase
    .from('alumno_familiar')
    .select(SELECT_FAMILIAR)
    .eq('alumno_id', alumnoId)
    .eq('tutor_id', TUTOR_ID_MADRE)
    .order('familiar_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error al cargar datos de la madre:', error)
    return null
  }

  return data as AlumnoFamiliarRegistro | null
}

export interface GuardarDatosFamiliarMadrePayload extends SnapshotDatosFamiliarMadre {
  alumnoId: number
  familiarId: number | null
}

export type ResultadoGuardarFamiliarMadre =
  | { ok: true; familiarId: number }
  | { ok: false; mensaje: string }

export async function guardarDatosFamiliarMadre(
  payload: GuardarDatosFamiliarMadrePayload
): Promise<ResultadoGuardarFamiliarMadre> {
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
      console.error('Error al actualizar datos de la madre:', error)
      return { ok: false, mensaje: error.message }
    }

    return { ok: true, familiarId: payload.familiarId }
  }

  const { data, error } = await supabase
    .from('alumno_familiar')
    .insert({
      alumno_id: payload.alumnoId,
      tutor_id: TUTOR_ID_MADRE,
      ...fila,
      familiar_vive: 1,
      familiar_factura: 0,
    })
    .select('familiar_id')
    .single()

  if (error) {
    console.error('Error al crear registro de la madre:', error)
    return { ok: false, mensaje: error.message }
  }

  return { ok: true, familiarId: data.familiar_id }
}
