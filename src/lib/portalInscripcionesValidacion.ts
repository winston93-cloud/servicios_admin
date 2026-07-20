import { validarFormatoCurp } from './curp'
import type {
  SolicitudContactoCampos,
  SolicitudFamiliarCampos,
  SolicitudInscripcionFormulario,
} from './portalInscripcionesSolicitudTypes'

export type SeccionSolicitudId = 'alumno' | 'salud' | 'mama' | 'papa' | 'contactos'

export const SECCIONES_SOLICITUD_ORDEN: SeccionSolicitudId[] = [
  'alumno',
  'salud',
  'mama',
  'papa',
  'contactos',
]

export const ETIQUETA_SECCION_SOLICITUD: Record<SeccionSolicitudId, string> = {
  alumno: 'Alumno',
  salud: 'Salud',
  mama: 'Mamá',
  papa: 'Papá',
  contactos: 'Contactos',
}

function vacio(val: string | null | undefined): boolean {
  return (val ?? '').trim() === ''
}

function validarFamiliar(rol: string, f: SolicitudFamiliarCampos): string[] {
  const errs: string[] = []
  if (vacio(f.apellidoPaterno)) errs.push(`${rol}: apellido paterno obligatorio.`)
  if (vacio(f.apellidoMaterno)) errs.push(`${rol}: apellido materno obligatorio.`)
  if (vacio(f.nombre)) errs.push(`${rol}: nombre obligatorio.`)
  if (vacio(f.celular)) errs.push(`${rol}: celular obligatorio.`)
  if (vacio(f.email)) errs.push(`${rol}: correo obligatorio.`)
  if (!vacio(f.curp)) {
    const v = validarFormatoCurp(f.curp)
    if (!v.valido) errs.push(`${rol}: ${v.mensaje}`)
  }
  return errs
}

function validarContacto(rol: string, c: SolicitudContactoCampos): string[] {
  const errs: string[] = []
  if (vacio(c.nombre)) errs.push(`${rol}: nombre obligatorio.`)
  if (vacio(c.telefono) && vacio(c.celular)) {
    errs.push(`${rol}: indica teléfono o celular.`)
  }
  return errs
}

export function erroresSeccionSolicitud(
  form: SolicitudInscripcionFormulario,
  seccion: SeccionSolicitudId
): string[] {
  const a = form.alumno
  const m = form.medico

  switch (seccion) {
    case 'alumno': {
      const errs: string[] = []
      if (vacio(a.fechaNacimiento)) errs.push('Alumno: fecha de nacimiento obligatoria.')
      if (vacio(a.lugarNacimiento)) errs.push('Alumno: lugar de nacimiento obligatorio.')
      if (vacio(a.sexo)) errs.push('Alumno: selecciona el sexo.')
      if (vacio(a.calle)) errs.push('Alumno: calle obligatoria.')
      if (vacio(a.numeroExt)) errs.push('Alumno: número exterior obligatorio.')
      if (vacio(a.colonia)) errs.push('Alumno: colonia obligatoria.')
      if (vacio(a.cp)) errs.push('Alumno: código postal obligatorio.')
      if (vacio(a.ciudad)) errs.push('Alumno: ciudad obligatoria.')
      if (vacio(a.estado)) errs.push('Alumno: estado obligatorio.')
      if (vacio(a.escuelaProcedente)) errs.push('Alumno: escuela de procedencia obligatoria.')
      const curpVal = validarFormatoCurp(a.curp)
      if (!curpVal.valido) errs.push(`Alumno: ${curpVal.mensaje}`)
      return errs
    }
    case 'salud': {
      const errs: string[] = []
      if (vacio(m.peso)) errs.push('Salud: peso obligatorio.')
      if (vacio(m.estatura)) errs.push('Salud: estatura obligatoria.')
      if (vacio(m.tipoSangre)) errs.push('Salud: tipo de sangre obligatorio.')
      if (vacio(m.alergias)) errs.push('Salud: indica si es alérgico.')
      if (vacio(m.tienePadecimiento)) errs.push('Salud: indica si padece alguna enfermedad.')
      if (vacio(m.requiereMedicina)) {
        errs.push('Salud: indica si requiere medicina en horario escolar.')
      }
      if (m.tienePadecimiento === '1' && vacio(m.padecimiento)) {
        errs.push('Salud: describe el padecimiento.')
      }
      if (m.requiereMedicina === '1' && vacio(m.medicina)) {
        errs.push('Salud: indica la medicina requerida.')
      }
      return errs
    }
    case 'mama':
      return validarFamiliar('Mamá', form.mama)
    case 'papa':
      return validarFamiliar('Papá', form.papa)
    case 'contactos': {
      const errs: string[] = []
      errs.push(...validarContacto('Contacto de emergencia', form.emergencia))
      const autorizadosValidos = form.autorizados.filter(
        (c) => !vacio(c.nombre) || !vacio(c.telefono) || !vacio(c.celular)
      )
      if (autorizadosValidos.length === 0) {
        errs.push('Agrega al menos una persona autorizada para recoger al alumno.')
      } else {
        for (let i = 0; i < autorizadosValidos.length; i++) {
          errs.push(...validarContacto(`Persona autorizada ${i + 1}`, autorizadosValidos[i]))
        }
      }
      return errs
    }
  }
}

export function mapaErroresPorSeccion(
  form: SolicitudInscripcionFormulario
): Record<SeccionSolicitudId, string[]> {
  return {
    alumno: erroresSeccionSolicitud(form, 'alumno'),
    salud: erroresSeccionSolicitud(form, 'salud'),
    mama: erroresSeccionSolicitud(form, 'mama'),
    papa: erroresSeccionSolicitud(form, 'papa'),
    contactos: erroresSeccionSolicitud(form, 'contactos'),
  }
}

export function seccionSolicitudCompleta(
  form: SolicitudInscripcionFormulario,
  seccion: SeccionSolicitudId
): boolean {
  return erroresSeccionSolicitud(form, seccion).length === 0
}

/** Todas las pestañas con datos obligatorios cubiertos. */
export function solicitudFormularioCompleta(form: SolicitudInscripcionFormulario): boolean {
  return SECCIONES_SOLICITUD_ORDEN.every((id) => seccionSolicitudCompleta(form, id))
}

export function validarSolicitudInscripcion(form: SolicitudInscripcionFormulario): string[] {
  return SECCIONES_SOLICITUD_ORDEN.flatMap((id) => erroresSeccionSolicitud(form, id))
}

/** Texto corto para el portal: «Falta: Alumno, Salud, Mamá». */
export function resumenSeccionesFaltantes(form: SolicitudInscripcionFormulario): string | null {
  const faltan = SECCIONES_SOLICITUD_ORDEN.filter((id) => !seccionSolicitudCompleta(form, id)).map(
    (id) => ETIQUETA_SECCION_SOLICITUD[id]
  )
  if (faltan.length === 0) return null
  if (faltan.length === 1) return `Falta completar la sección ${faltan[0]}.`
  if (faltan.length === 2) return `Falta completar: ${faltan[0]} y ${faltan[1]}.`
  return `Falta completar: ${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}.`
}
