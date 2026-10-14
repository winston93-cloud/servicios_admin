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

/** Texto que la familia puede escribir en un campo obligatorio cuando no aplica. */
export const VALOR_NO_APLICA = '*'

function vacio(val: string | null | undefined): boolean {
  return (val ?? '').trim() === ''
}

function esNoAplica(val: string | null | undefined): boolean {
  return (val ?? '').trim() === VALOR_NO_APLICA
}

/**
 * Falta en un campo concreto del formulario. `campo` identifica el input en la UI
 * (p. ej. `papa.nombre`, `autorizados.0.telefono`); una falta de «teléfono o celular»
 * lleva ambos campos.
 */
export type FaltaSolicitud = { campos: string[]; mensaje: string }

function validarFamiliar(
  prefijo: 'mama' | 'papa',
  rol: string,
  f: SolicitudFamiliarCampos
): FaltaSolicitud[] {
  const faltas: FaltaSolicitud[] = []
  const req = (campo: keyof SolicitudFamiliarCampos, mensaje: string) => {
    if (vacio(f[campo])) faltas.push({ campos: [`${prefijo}.${campo}`], mensaje: `${rol}: ${mensaje}` })
  }
  req('apellidoPaterno', 'apellido paterno obligatorio.')
  req('apellidoMaterno', 'apellido materno obligatorio.')
  req('nombre', 'nombre obligatorio.')
  req('celular', 'celular obligatorio.')
  req('email', 'correo obligatorio.')
  if (!vacio(f.curp) && !esNoAplica(f.curp)) {
    const v = validarFormatoCurp(f.curp)
    if (!v.valido) faltas.push({ campos: [`${prefijo}.curp`], mensaje: `${rol}: ${v.mensaje}` })
  }
  // RFC de mamá/papá: opcional (en blanco o «*»); no se valida ni exige.
  return faltas
}

function validarContacto(prefijo: string, rol: string, c: SolicitudContactoCampos): FaltaSolicitud[] {
  const faltas: FaltaSolicitud[] = []
  if (vacio(c.nombre)) faltas.push({ campos: [`${prefijo}.nombre`], mensaje: `${rol}: nombre obligatorio.` })
  if (vacio(c.telefono) && vacio(c.celular)) {
    faltas.push({
      campos: [`${prefijo}.telefono`, `${prefijo}.celular`],
      mensaje: `${rol}: indica teléfono o celular.`,
    })
  }
  return faltas
}

export function faltasSeccionSolicitud(
  form: SolicitudInscripcionFormulario,
  seccion: SeccionSolicitudId
): FaltaSolicitud[] {
  const a = form.alumno
  const m = form.medico

  switch (seccion) {
    case 'alumno': {
      const faltas: FaltaSolicitud[] = []
      const req = (campo: keyof SolicitudInscripcionFormulario['alumno'], mensaje: string) => {
        if (vacio(a[campo])) faltas.push({ campos: [`alumno.${campo}`], mensaje: `Alumno: ${mensaje}` })
      }
      req('fechaNacimiento', 'fecha de nacimiento obligatoria.')
      req('lugarNacimiento', 'lugar de nacimiento obligatorio.')
      req('sexo', 'selecciona el sexo.')
      req('calle', 'calle obligatoria.')
      req('numeroExt', 'número exterior obligatorio.')
      req('colonia', 'colonia obligatoria.')
      req('cp', 'código postal obligatorio.')
      req('ciudad', 'ciudad obligatoria.')
      req('estado', 'estado obligatorio.')
      req('escuelaProcedente', 'escuela de procedencia obligatoria.')
      const curpVal = validarFormatoCurp(a.curp)
      if (!curpVal.valido) faltas.push({ campos: ['alumno.curp'], mensaje: `Alumno: ${curpVal.mensaje}` })
      return faltas
    }
    case 'salud': {
      const faltas: FaltaSolicitud[] = []
      const req = (campo: keyof SolicitudInscripcionFormulario['medico'], mensaje: string) => {
        if (vacio(m[campo])) faltas.push({ campos: [`medico.${campo}`], mensaje: `Salud: ${mensaje}` })
      }
      req('peso', 'peso obligatorio.')
      req('estatura', 'estatura obligatoria.')
      req('tipoSangre', 'tipo de sangre obligatorio.')
      req('alergias', 'indica si es alérgico.')
      req('tienePadecimiento', 'indica si padece alguna enfermedad.')
      req('requiereMedicina', 'indica si requiere medicina en horario escolar.')
      if (m.tienePadecimiento === '1') req('padecimiento', 'describe el padecimiento.')
      if (m.requiereMedicina === '1') req('medicina', 'indica la medicina requerida.')
      return faltas
    }
    case 'mama':
      return validarFamiliar('mama', 'Mamá', form.mama)
    case 'papa':
      return validarFamiliar('papa', 'Papá', form.papa)
    case 'contactos': {
      const faltas: FaltaSolicitud[] = []
      faltas.push(...validarContacto('emergencia', 'Contacto de emergencia', form.emergencia))
      const autorizadosConDatos = form.autorizados
        .map((c, idx) => ({ c, idx }))
        .filter(({ c }) => !vacio(c.nombre) || !vacio(c.telefono) || !vacio(c.celular))
      if (autorizadosConDatos.length === 0) {
        faltas.push({
          campos: ['autorizados.0.nombre', 'autorizados.0.telefono', 'autorizados.0.celular'],
          mensaje: 'Agrega al menos una persona autorizada para recoger al alumno.',
        })
      } else {
        autorizadosConDatos.forEach(({ c, idx }, i) => {
          faltas.push(...validarContacto(`autorizados.${idx}`, `Persona autorizada ${i + 1}`, c))
        })
      }
      return faltas
    }
  }
}

export function erroresSeccionSolicitud(
  form: SolicitudInscripcionFormulario,
  seccion: SeccionSolicitudId
): string[] {
  return faltasSeccionSolicitud(form, seccion).map((f) => f.mensaje)
}

/** Campos (ids de UI) con falta en la sección, en el orden en que aparecen. */
export function camposFaltantesSeccion(
  form: SolicitudInscripcionFormulario,
  seccion: SeccionSolicitudId
): string[] {
  return [...new Set(faltasSeccionSolicitud(form, seccion).flatMap((f) => f.campos))]
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
