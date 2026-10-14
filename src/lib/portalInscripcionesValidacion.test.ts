// 2026-10-14 — Pruebas: solicitud de inscripción (no guarda en vacío, acepta «*», campos faltantes por pestaña).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizarCurp } from './curp'
import {
  SOLICITUD_ALUMNO_VACIO,
  SOLICITUD_CONTACTO_VACIO,
  SOLICITUD_FAMILIAR_VACIO,
  SOLICITUD_MEDICO_VACIO,
  type SolicitudInscripcionFormulario,
} from './portalInscripcionesSolicitudTypes'
import {
  SECCIONES_SOLICITUD_ORDEN,
  VALOR_NO_APLICA,
  camposFaltantesSeccion,
  erroresSeccionSolicitud,
  seccionSolicitudCompleta,
  solicitudFormularioCompleta,
} from './portalInscripcionesValidacion'

const CURP_ALUMNO = normalizarCurp('GOMA150101HDFRRN0')

const familiar = (nombre: string) => ({
  ...SOLICITUD_FAMILIAR_VACIO,
  apellidoPaterno: 'Pérez',
  apellidoMaterno: 'López',
  nombre,
  celular: '8180000000',
  email: 'familia@example.com',
})

const formCompleto = (): SolicitudInscripcionFormulario => ({
  detalleId: null,
  datoMedicoId: null,
  mamaFamiliarId: null,
  papaFamiliarId: null,
  alumno: {
    ...SOLICITUD_ALUMNO_VACIO,
    fechaNacimiento: '2015-01-01',
    lugarNacimiento: 'Monterrey',
    curp: CURP_ALUMNO,
    sexo: 'H',
    calle: 'Calle',
    numeroExt: '1',
    colonia: 'Centro',
    cp: '64000',
    ciudad: 'Monterrey',
    estado: 'Nuevo León',
    escuelaProcedente: 'Winston',
  },
  medico: {
    ...SOLICITUD_MEDICO_VACIO,
    peso: '30',
    estatura: '1.30',
    tipoSangre: 'O+',
    alergias: 'No',
    tienePadecimiento: '0',
    requiereMedicina: '0',
  },
  mama: familiar('Ana'),
  papa: familiar('Juan'),
  emergencia: { ...SOLICITUD_CONTACTO_VACIO, nombre: 'Abuela', celular: '8181111111' },
  autorizados: [{ ...SOLICITUD_CONTACTO_VACIO, nombre: 'Tía', telefono: '8182222222' }],
})

test('formulario completo pasa todas las pestañas', () => {
  const form = formCompleto()
  assert.ok(solicitudFormularioCompleta(form))
  for (const id of SECCIONES_SOLICITUD_ORDEN) assert.deepEqual(camposFaltantesSeccion(form, id), [])
})

test('formulario vacío no se puede guardar: ninguna pestaña completa', () => {
  const vacio: SolicitudInscripcionFormulario = {
    ...formCompleto(),
    alumno: { ...SOLICITUD_ALUMNO_VACIO },
    medico: { ...SOLICITUD_MEDICO_VACIO },
    mama: { ...SOLICITUD_FAMILIAR_VACIO },
    papa: { ...SOLICITUD_FAMILIAR_VACIO },
    emergencia: { ...SOLICITUD_CONTACTO_VACIO },
    autorizados: [{ ...SOLICITUD_CONTACTO_VACIO }],
  }
  for (const id of SECCIONES_SOLICITUD_ORDEN) {
    assert.equal(seccionSolicitudCompleta(vacio, id), false, id)
    assert.ok(camposFaltantesSeccion(vacio, id).length > 0, id)
  }
})

test('solo espacios cuenta como vacío', () => {
  const form = formCompleto()
  form.papa.nombre = '   '
  assert.deepEqual(camposFaltantesSeccion(form, 'papa'), ['papa.nombre'])
})

test('«*» se acepta como «no aplica» en los datos obligatorios de papá', () => {
  const form = formCompleto()
  form.papa = {
    ...SOLICITUD_FAMILIAR_VACIO,
    apellidoPaterno: VALOR_NO_APLICA,
    apellidoMaterno: VALOR_NO_APLICA,
    nombre: VALOR_NO_APLICA,
    celular: VALOR_NO_APLICA,
    email: VALOR_NO_APLICA,
    curp: VALOR_NO_APLICA,
  }
  assert.deepEqual(erroresSeccionSolicitud(form, 'papa'), [])
  assert.ok(solicitudFormularioCompleta(form))
})

test('el CURP del alumno no acepta «*»', () => {
  const form = formCompleto()
  form.alumno.curp = VALOR_NO_APLICA
  assert.deepEqual(camposFaltantesSeccion(form, 'alumno'), ['alumno.curp'])
})

test('campos faltantes de mamá en orden del formulario', () => {
  const form = formCompleto()
  form.mama.apellidoMaterno = ''
  form.mama.email = ''
  assert.deepEqual(camposFaltantesSeccion(form, 'mama'), ['mama.apellidoMaterno', 'mama.email'])
  assert.deepEqual(erroresSeccionSolicitud(form, 'mama'), [
    'Mamá: apellido materno obligatorio.',
    'Mamá: correo obligatorio.',
  ])
})

test('salud: padecimiento y medicina solo se exigen si responden «Sí»', () => {
  const form = formCompleto()
  form.medico.tienePadecimiento = '1'
  form.medico.requiereMedicina = '1'
  assert.deepEqual(camposFaltantesSeccion(form, 'salud'), ['medico.padecimiento', 'medico.medicina'])
})

test('contactos: sin autorizados marca la primera persona', () => {
  const form = formCompleto()
  form.autorizados = [{ ...SOLICITUD_CONTACTO_VACIO }]
  assert.deepEqual(camposFaltantesSeccion(form, 'contactos'), [
    'autorizados.0.nombre',
    'autorizados.0.telefono',
    'autorizados.0.celular',
  ])
})

test('contactos: marca el índice real del autorizado incompleto y teléfono o celular', () => {
  const form = formCompleto()
  form.emergencia.celular = ''
  form.autorizados = [
    { ...SOLICITUD_CONTACTO_VACIO },
    { ...SOLICITUD_CONTACTO_VACIO, nombre: 'Primo' },
  ]
  assert.deepEqual(camposFaltantesSeccion(form, 'contactos'), [
    'emergencia.telefono',
    'emergencia.celular',
    'autorizados.1.telefono',
    'autorizados.1.celular',
  ])
  assert.deepEqual(erroresSeccionSolicitud(form, 'contactos'), [
    'Contacto de emergencia: indica teléfono o celular.',
    'Persona autorizada 1: indica teléfono o celular.',
  ])
})
