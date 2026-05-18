import { TUTOR_ID_MADRE, TUTOR_ID_PADRE } from './alumnoFamiliarTutor'

export interface AlumnoFamiliarFormConfig {
  tutorId: number
  idPrefix: string
  legend: string
  ariaNombre: string
  labelEmail: string
  radioName: string
  textoCargando: string
  textoSinRegistro: string
  textoBotonGuardar: string
  textoGuardadoOk: string
  etiquetaRol: string
}

export const CONFIG_FAMILIAR_MADRE: AlumnoFamiliarFormConfig = {
  tutorId: TUTOR_ID_MADRE,
  idPrefix: 'madre',
  legend: 'Datos de la madre del alumno',
  ariaNombre: 'Nombre de la madre',
  labelEmail: 'E-mail de mamá',
  radioName: 'madre_recibir_email',
  textoCargando: 'Cargando datos de la madre…',
  textoSinRegistro:
    'No hay registro de la madre en este ciclo. Puedes capturar los datos y pulsar «Actualizar datos maternos» para crearlo.',
  textoBotonGuardar: 'Actualizar datos maternos',
  textoGuardadoOk: 'Los datos maternos se guardaron correctamente.',
  etiquetaRol: 'madre',
}

export const CONFIG_FAMILIAR_PADRE: AlumnoFamiliarFormConfig = {
  tutorId: TUTOR_ID_PADRE,
  idPrefix: 'padre',
  legend: 'Datos del padre del alumno',
  ariaNombre: 'Nombre del padre',
  labelEmail: 'E-mail de papá',
  radioName: 'padre_recibir_email',
  textoCargando: 'Cargando datos del padre…',
  textoSinRegistro:
    'No hay registro del padre en este ciclo. Puedes capturar los datos y pulsar «Actualizar datos paternos» para crearlo.',
  textoBotonGuardar: 'Actualizar datos paternos',
  textoGuardadoOk: 'Los datos paternos se guardaron correctamente.',
  etiquetaRol: 'padre',
}
