export interface SolicitudAlumnoCampos {
  fechaNacimiento: string
  lugarNacimiento: string
  curp: string
  sexo: string
  calle: string
  entreCalles: string
  numeroExt: string
  numeroInt: string
  colonia: string
  cp: string
  ciudad: string
  estado: string
  escuelaProcedente: string
}

export interface SolicitudMedicoCampos {
  peso: string
  estatura: string
  tipoSangre: string
  alergias: string
  tienePadecimiento: string
  padecimiento: string
  requiereMedicina: string
  medicina: string
  suministrar: string
  medicamentos: string
  atencionInterna: string
  afiliacion: string
  afiliacionExterna: string
  servicioMedico: string
}

export interface SolicitudFamiliarCampos {
  apellidoPaterno: string
  apellidoMaterno: string
  nombre: string
  vive: string
  fechaNacimiento: string
  lugarNacimiento: string
  curp: string
  rfc: string
  escolaridad: string
  empresaNombre: string
  empresaDireccion: string
  puesto: string
  telefonoTrabajo: string
  email: string
  celular: string
}

export interface SolicitudContactoCampos {
  contactoId: number | null
  nombre: string
  parentesco: string
  telefono: string
  celular: string
}

export interface SolicitudInscripcionFormulario {
  detalleId: number | null
  datoMedicoId: number | null
  mamaFamiliarId: number | null
  papaFamiliarId: number | null
  alumno: SolicitudAlumnoCampos
  medico: SolicitudMedicoCampos
  mama: SolicitudFamiliarCampos
  papa: SolicitudFamiliarCampos
  emergencia: SolicitudContactoCampos
  autorizados: SolicitudContactoCampos[]
}

export const SOLICITUD_ALUMNO_VACIO: SolicitudAlumnoCampos = {
  fechaNacimiento: '',
  lugarNacimiento: '',
  curp: '',
  sexo: '',
  calle: '',
  entreCalles: '',
  numeroExt: '',
  numeroInt: '',
  colonia: '',
  cp: '',
  ciudad: '',
  estado: '',
  escuelaProcedente: '',
}

export const SOLICITUD_MEDICO_VACIO: SolicitudMedicoCampos = {
  peso: '',
  estatura: '',
  tipoSangre: '',
  alergias: '',
  tienePadecimiento: '',
  padecimiento: '',
  requiereMedicina: '',
  medicina: '',
  suministrar: '',
  medicamentos: '',
  atencionInterna: '',
  afiliacion: '',
  afiliacionExterna: '',
  servicioMedico: '',
}

export const SOLICITUD_FAMILIAR_VACIO: SolicitudFamiliarCampos = {
  apellidoPaterno: '',
  apellidoMaterno: '',
  nombre: '',
  vive: '1',
  fechaNacimiento: '',
  lugarNacimiento: '',
  curp: '',
  rfc: '',
  escolaridad: '',
  empresaNombre: '',
  empresaDireccion: '',
  puesto: '',
  telefonoTrabajo: '',
  email: '',
  celular: '',
}

export const SOLICITUD_CONTACTO_VACIO: SolicitudContactoCampos = {
  contactoId: null,
  nombre: '',
  parentesco: '',
  telefono: '',
  celular: '',
}
