import type { AppDatabaseClient } from './dbTypes'
import {
  normalizarDatosFacturacion,
  validarDatosFacturacion,
  type DatosFacturacion,
  type DatosFacturacionFormulario,
} from './datosFacturacionTypes'

const SELECT_COLS =
  'id, moneda, rfc, razsocial, regfiscal, usocfdi, codpostal, calle, nexterior, ninterior, ncolonia, nmunicipio, nentidad, email, lada, numero, alumno_ref, created_at, updated_at'

export async function obtenerDatosFacturacionPorRef(
  db: AppDatabaseClient,
  alumnoRef: number
): Promise<DatosFacturacion | null> {
  const { data, error } = await db
    .from('datos_facturacion')
    .select(SELECT_COLS)
    .eq('alumno_ref', alumnoRef)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }
  return (data as DatosFacturacion | null) ?? null
}

export async function guardarDatosFacturacion(
  db: AppDatabaseClient,
  formulario: DatosFacturacionFormulario
): Promise<{ ok: true; datos: DatosFacturacion } | { ok: false; errores: string[] }> {
  const datos = normalizarDatosFacturacion(formulario)
  const errores = validarDatosFacturacion(datos)
  if (errores.length) return { ok: false, errores }

  const existente = await obtenerDatosFacturacionPorRef(db, datos.alumno_ref)
  const payload = {
    moneda: datos.moneda,
    rfc: datos.rfc,
    razsocial: datos.razsocial,
    regfiscal: datos.regfiscal,
    usocfdi: datos.usocfdi,
    codpostal: datos.codpostal,
    calle: datos.calle,
    nexterior: datos.nexterior || '',
    ninterior: datos.ninterior || '',
    ncolonia: datos.ncolonia,
    nmunicipio: datos.nmunicipio,
    nentidad: datos.nentidad,
    email: datos.email,
    lada: datos.lada || '',
    numero: datos.numero || '',
    alumno_ref: datos.alumno_ref,
  }

  if (existente?.id) {
    const { data, error } = await db
      .from('datos_facturacion')
      .update(payload)
      .eq('id', existente.id)
      .select(SELECT_COLS)
      .single()

    if (error) throw new Error(error.message)
    return { ok: true, datos: data as DatosFacturacion }
  }

  const { data, error } = await db
    .from('datos_facturacion')
    .insert(payload)
    .select(SELECT_COLS)
    .single()

  if (error) throw new Error(error.message)
  return { ok: true, datos: data as DatosFacturacion }
}
