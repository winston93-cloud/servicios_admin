import type { AppDatabaseClient } from '@/lib/dbTypes'
import { normalizarCurp } from './curp'
import { sexoAlumnoPorDefecto } from './alumnoSexo'
import {
  CONTACTO_TIPO_AUTORIZADA,
  CONTACTO_TIPO_EMERGENCIA,
} from './alumnoContactoService'
import { TUTOR_ID_MADRE, TUTOR_ID_PADRE } from './alumnoFamiliarTutor'
import { validarSolicitudInscripcion } from './portalInscripcionesValidacion'
import type { SolicitudInscripcionFormulario } from './portalInscripcionesSolicitudTypes'
import {
  SOLICITUD_ALUMNO_VACIO,
  SOLICITUD_CONTACTO_VACIO,
  SOLICITUD_FAMILIAR_VACIO,
  SOLICITUD_MEDICO_VACIO,
} from './portalInscripcionesSolicitudTypes'

const SELECT_DETALLE =
  'detalle_id, alumno_id, alumno_fecha_nac, alumno_lugar_nac, alumno_curp, alumno_sexo, alumno_calle, alumno_entre_calles, alumno_numero, alumno_numeroint, alumno_colonia, alumno_cp, estado_id, cuidad_id, alumno_escuela_procedente'

const SELECT_FAMILIAR =
  'familiar_id, tutor_id, familiar_app, familiar_apm, familiar_nombre, familiar_cel, familiar_email, familiar_fecha_nac, familiar_lugar_nac, familiar_curp, familiar_rfc, familiar_escolaridad, familiar_empresa_nombre, familiar_empresa_direccion, familiar_empresa_puesto, familiar_empresa_tel, familiar_vive'

function fechaIso(val: string | null | undefined): string {
  if (!val) return ''
  return String(val).slice(0, 10)
}

function mapFamiliar(
  reg: Record<string, unknown> | null
): SolicitudInscripcionFormulario['mama'] {
  if (!reg) return { ...SOLICITUD_FAMILIAR_VACIO }
  return {
    apellidoPaterno: String(reg.familiar_app ?? ''),
    apellidoMaterno: String(reg.familiar_apm ?? ''),
    nombre: String(reg.familiar_nombre ?? ''),
    vive: String(reg.familiar_vive ?? '1'),
    fechaNacimiento: fechaIso(reg.familiar_fecha_nac as string),
    lugarNacimiento: String(reg.familiar_lugar_nac ?? ''),
    curp: normalizarCurp(String(reg.familiar_curp ?? '')),
    rfc: String(reg.familiar_rfc ?? ''),
    escolaridad: String(reg.familiar_escolaridad ?? ''),
    empresaNombre: String(reg.familiar_empresa_nombre ?? ''),
    empresaDireccion: String(reg.familiar_empresa_direccion ?? ''),
    puesto: String(reg.familiar_empresa_puesto ?? ''),
    telefonoTrabajo: String(reg.familiar_empresa_tel ?? ''),
    email: String(reg.familiar_email ?? ''),
    celular: String(reg.familiar_cel ?? ''),
  }
}

export async function cargarSolicitudInscripcion(
  supabase: AppDatabaseClient,
  alumnoId: number
): Promise<SolicitudInscripcionFormulario> {
  const { data: detalle } = await supabase
    .from('alumno_detalles')
    .select(SELECT_DETALLE)
    .eq('alumno_id', alumnoId)
    .maybeSingle()

  const { data: medico } = await supabase
    .from('alumno_dato_medico')
    .select('*')
    .eq('alumno_id', alumnoId)
    .maybeSingle()

  const { data: familiares } = await supabase
    .from('alumno_familiar')
    .select(SELECT_FAMILIAR)
    .eq('alumno_id', alumnoId)

  const mamaRow =
    (familiares as Record<string, unknown>[] | null)?.find(
      (f) => Number(f.tutor_id) === TUTOR_ID_MADRE
    ) ?? null
  const papaRow =
    (familiares as Record<string, unknown>[] | null)?.find(
      (f) => Number(f.tutor_id) === TUTOR_ID_PADRE
    ) ?? null

  const { data: contactos } = await supabase
    .from('alumno_contacto')
    .select('contacto_id, contacto_tipo, contacto_nombre, tutor_clase, contacto_tel, contacto_cel')
    .eq('alumno_id', alumnoId)
    .order('contacto_id', { ascending: true })

  const lista = (contactos ?? []) as Record<string, unknown>[]
  const emergenciaRow = lista.find((c) => Number(c.contacto_tipo) === CONTACTO_TIPO_EMERGENCIA)
  const autorizadosRows = lista.filter(
    (c) => Number(c.contacto_tipo) === CONTACTO_TIPO_AUTORIZADA
  )

  const d = detalle as Record<string, unknown> | null
  const med = medico as Record<string, unknown> | null

  return {
    detalleId: d?.detalle_id != null ? Number(d.detalle_id) : null,
    datoMedicoId: med?.dato_medico_id != null ? Number(med.dato_medico_id) : null,
    mamaFamiliarId: mamaRow?.familiar_id != null ? Number(mamaRow.familiar_id) : null,
    papaFamiliarId: papaRow?.familiar_id != null ? Number(papaRow.familiar_id) : null,
    alumno: d
      ? {
          fechaNacimiento: fechaIso(d.alumno_fecha_nac as string),
          lugarNacimiento: String(d.alumno_lugar_nac ?? ''),
          curp: normalizarCurp(String(d.alumno_curp ?? '')),
          sexo: String(d.alumno_sexo ?? ''),
          calle: String(d.alumno_calle ?? ''),
          entreCalles: String(d.alumno_entre_calles ?? ''),
          numeroExt: String(d.alumno_numero ?? ''),
          numeroInt: String(d.alumno_numeroint ?? ''),
          colonia: String(d.alumno_colonia ?? ''),
          cp: d.alumno_cp != null ? String(d.alumno_cp) : '',
          ciudad: String(d.cuidad_id ?? ''),
          estado: String(d.estado_id ?? ''),
          escuelaProcedente: String(d.alumno_escuela_procedente ?? ''),
        }
      : { ...SOLICITUD_ALUMNO_VACIO },
    medico: med
      ? {
          peso: String(med.alumno_peso ?? ''),
          estatura: String(med.alumno_estatura ?? ''),
          tipoSangre: String(med.alumno_sangre_tipo ?? ''),
          alergias: String(med.alumno_alergia ?? ''),
          tienePadecimiento: med.alumno_padecimiento ? '1' : '0',
          padecimiento: String(med.alumno_padecimiento ?? ''),
          requiereMedicina: med.alumno_medicina ? '1' : '0',
          medicina: String(med.alumno_medicina ?? ''),
          suministrar: String(med.alumno_suministrar ?? ''),
          medicamentos: String(med.alumno_medicamentos ?? ''),
          atencionInterna: String(med.alumno_atencion_interna ?? ''),
          afiliacion: String(med.alumno_afiliacion ?? ''),
          afiliacionExterna: String(med.alumno_afiliacion_externa ?? ''),
          servicioMedico: String(med.alumno_servicio_medico ?? ''),
        }
      : { ...SOLICITUD_MEDICO_VACIO },
    mama: mapFamiliar(mamaRow),
    papa: mapFamiliar(papaRow),
    emergencia: emergenciaRow
      ? {
          contactoId: Number(emergenciaRow.contacto_id),
          nombre: String(emergenciaRow.contacto_nombre ?? ''),
          parentesco: String(emergenciaRow.tutor_clase ?? ''),
          telefono: String(emergenciaRow.contacto_tel ?? ''),
          celular: String(emergenciaRow.contacto_cel ?? ''),
        }
      : { ...SOLICITUD_CONTACTO_VACIO },
    autorizados:
      autorizadosRows.length > 0
        ? autorizadosRows.map((c) => ({
            contactoId: Number(c.contacto_id),
            nombre: String(c.contacto_nombre ?? ''),
            parentesco: String(c.tutor_clase ?? ''),
            telefono: String(c.contacto_tel ?? ''),
            celular: String(c.contacto_cel ?? ''),
          }))
        : [{ ...SOLICITUD_CONTACTO_VACIO }],
  }
}

async function upsertDetalle(
  supabase: AppDatabaseClient,
  alumnoId: number,
  detalleId: number | null,
  form: SolicitudInscripcionFormulario
): Promise<number | null> {
  const fila = {
    alumno_fecha_nac: form.alumno.fechaNacimiento || null,
    alumno_lugar_nac: form.alumno.lugarNacimiento.trim() || null,
    alumno_curp: normalizarCurp(form.alumno.curp) || null,
    alumno_sexo: sexoAlumnoPorDefecto(form.alumno.sexo) || null,
    alumno_calle: form.alumno.calle.trim() || null,
    alumno_entre_calles: form.alumno.entreCalles.trim() || null,
    alumno_numero: form.alumno.numeroExt.trim() || null,
    alumno_numeroint: form.alumno.numeroInt.trim() || null,
    alumno_colonia: form.alumno.colonia.trim() || null,
    alumno_cp: form.alumno.cp.trim() ? parseInt(form.alumno.cp, 10) : null,
    estado_id: form.alumno.estado.trim() || null,
    cuidad_id: form.alumno.ciudad.trim() || null,
    alumno_escuela_procedente: form.alumno.escuelaProcedente.trim() || null,
    detalle_registro: new Date().toISOString(),
  }

  if (detalleId != null) {
    const { error } = await supabase.from('alumno_detalles').update(fila).eq('detalle_id', detalleId)
    if (error) throw new Error(error.message)
    return detalleId
  }

  const { data, error } = await supabase
    .from('alumno_detalles')
    .insert({ alumno_id: alumnoId, ...fila })
    .select('detalle_id')
    .single()
  if (error) throw new Error(error.message)
  return data?.detalle_id ?? null
}

async function upsertMedico(
  supabase: AppDatabaseClient,
  alumnoId: number,
  datoMedicoId: number | null,
  form: SolicitudInscripcionFormulario
): Promise<void> {
  const fila = {
    alumno_peso: form.medico.peso.trim() || null,
    alumno_estatura: form.medico.estatura.trim() || null,
    alumno_sangre_tipo: form.medico.tipoSangre.trim() || null,
    alumno_alergia: form.medico.alergias.trim() || null,
    alumno_padecimiento:
      form.medico.tienePadecimiento === '1' ? form.medico.padecimiento.trim() || null : null,
    alumno_medicina:
      form.medico.requiereMedicina === '1' ? form.medico.medicina.trim() || null : null,
    alumno_suministrar: form.medico.suministrar.trim() || null,
    alumno_medicamentos: form.medico.medicamentos.trim() || null,
    alumno_atencion_interna: form.medico.atencionInterna
      ? parseInt(form.medico.atencionInterna, 10)
      : null,
    alumno_afiliacion: form.medico.afiliacion.trim() || null,
    alumno_afiliacion_externa: form.medico.afiliacionExterna.trim() || null,
    alumno_servicio_medico: form.medico.servicioMedico
      ? parseInt(form.medico.servicioMedico, 10)
      : null,
    dato_medico_actualizacion: new Date().toISOString().slice(0, 10),
  }

  if (datoMedicoId != null) {
    const { error } = await supabase
      .from('alumno_dato_medico')
      .update(fila)
      .eq('dato_medico_id', datoMedicoId)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase
    .from('alumno_dato_medico')
    .insert({ alumno_id: alumnoId, ...fila })
  if (error) throw new Error(error.message)
}

async function upsertFamiliar(
  supabase: AppDatabaseClient,
  alumnoId: number,
  tutorId: number,
  familiarId: number | null,
  f: SolicitudInscripcionFormulario['mama']
): Promise<void> {
  const fila = {
    familiar_app: f.apellidoPaterno.trim() || null,
    familiar_apm: f.apellidoMaterno.trim() || null,
    familiar_nombre: f.nombre.trim() || null,
    familiar_vive: f.vive === '0' ? 0 : 1,
    familiar_fecha_nac: f.fechaNacimiento || null,
    familiar_lugar_nac: f.lugarNacimiento.trim() || null,
    familiar_curp: normalizarCurp(f.curp) || null,
    familiar_rfc: f.rfc.trim() || null,
    familiar_escolaridad: f.escolaridad.trim() || null,
    familiar_empresa_nombre: f.empresaNombre.trim() || null,
    familiar_empresa_direccion: f.empresaDireccion.trim() || null,
    familiar_empresa_puesto: f.puesto.trim() || null,
    familiar_empresa_tel: f.telefonoTrabajo.trim() || null,
    familiar_email: f.email.trim() || null,
    familiar_cel: f.celular.trim() || null,
    familiar_recibir_email: 1,
    familiar_factura: 0,
    familiar_registro: new Date().toISOString().slice(0, 10),
  }

  if (familiarId != null) {
    const { error } = await supabase.from('alumno_familiar').update(fila).eq('familiar_id', familiarId)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase
    .from('alumno_familiar')
    .insert({ alumno_id: alumnoId, tutor_id: tutorId, ...fila })
  if (error) throw new Error(error.message)
}

async function upsertContacto(
  supabase: AppDatabaseClient,
  alumnoId: number,
  tipo: number,
  c: SolicitudInscripcionFormulario['emergencia']
): Promise<void> {
  const fila = {
    contacto_nombre: c.nombre.trim() || null,
    tutor_clase: c.parentesco.trim() || null,
    contacto_tel: c.telefono.trim() || null,
    contacto_cel: c.celular.trim() || null,
    contacto_tipo: tipo,
  }

  if (c.contactoId != null) {
    const { error } = await supabase
      .from('alumno_contacto')
      .update(fila)
      .eq('contacto_id', c.contactoId)
      .eq('alumno_id', alumnoId)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from('alumno_contacto').insert({
    alumno_id: alumnoId,
    ...fila,
    contacto_alta: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function guardarSolicitudInscripcion(
  supabase: AppDatabaseClient,
  alumnoId: number,
  form: SolicitudInscripcionFormulario
): Promise<{ ok: true; fechaRegistro: string } | { ok: false; errores: string[] }> {
  const errores = validarSolicitudInscripcion(form)
  if (errores.length > 0) return { ok: false, errores }

  try {
    await upsertDetalle(supabase, alumnoId, form.detalleId, form)
    await upsertMedico(supabase, alumnoId, form.datoMedicoId, form)
    await upsertFamiliar(supabase, alumnoId, TUTOR_ID_MADRE, form.mamaFamiliarId, form.mama)
    await upsertFamiliar(supabase, alumnoId, TUTOR_ID_PADRE, form.papaFamiliarId, form.papa)
    await upsertContacto(supabase, alumnoId, CONTACTO_TIPO_EMERGENCIA, form.emergencia)

    for (const autorizado of form.autorizados) {
      if (
        !autorizado.nombre.trim() &&
        !autorizado.telefono.trim() &&
        !autorizado.celular.trim()
      ) {
        continue
      }
      await upsertContacto(supabase, alumnoId, CONTACTO_TIPO_AUTORIZADA, autorizado)
    }

    const hoy = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('alumno')
      .update({ alumno_registro: hoy })
      .eq('alumno_id', alumnoId)

    if (error) throw new Error(error.message)

    return { ok: true, fechaRegistro: hoy }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al guardar la solicitud'
    return { ok: false, errores: [msg] }
  }
}
