import { validarFormatoCurp } from './curp'
import type {
  SolicitudContactoCampos,
  SolicitudFamiliarCampos,
  SolicitudInscripcionFormulario,
} from './portalInscripcionesSolicitudTypes'

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

export function validarSolicitudInscripcion(
  form: SolicitudInscripcionFormulario
): string[] {
  const errs: string[] = []
  const a = form.alumno
  const m = form.medico

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

  if (vacio(m.peso)) errs.push('Salud: peso obligatorio.')
  if (vacio(m.estatura)) errs.push('Salud: estatura obligatoria.')
  if (vacio(m.tipoSangre)) errs.push('Salud: tipo de sangre obligatorio.')
  if (vacio(m.alergias)) errs.push('Salud: indica si es alérgico.')
  if (vacio(m.tienePadecimiento)) errs.push('Salud: indica si padece alguna enfermedad.')
  if (vacio(m.requiereMedicina)) errs.push('Salud: indica si requiere medicina en horario escolar.')
  if (m.tienePadecimiento === '1' && vacio(m.padecimiento)) {
    errs.push('Salud: describe el padecimiento.')
  }
  if (m.requiereMedicina === '1' && vacio(m.medicina)) {
    errs.push('Salud: indica la medicina requerida.')
  }

  errs.push(...validarFamiliar('Mamá', form.mama))
  errs.push(...validarFamiliar('Papá', form.papa))
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
