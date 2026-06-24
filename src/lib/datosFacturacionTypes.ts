/** Fila en InsForge / MySQL winston_general.datos_facturacion */
export interface DatosFacturacion {
  id?: number
  moneda: string
  rfc: string
  razsocial: string
  regfiscal: string
  usocfdi: string
  codpostal: string
  calle: string
  nexterior: string
  ninterior: string
  ncolonia: string
  nmunicipio: string
  nentidad: string
  email: string
  lada: string
  numero: string
  alumno_ref: number
  created_at?: string
  updated_at?: string
}

export type DatosFacturacionFormulario = Omit<DatosFacturacion, 'id' | 'created_at' | 'updated_at'>

export const DATOS_FACTURACION_VACIO: DatosFacturacionFormulario = {
  moneda: 'MXN',
  rfc: '',
  razsocial: '',
  regfiscal: '605',
  usocfdi: 'D10',
  codpostal: '',
  calle: '',
  nexterior: '',
  ninterior: '',
  ncolonia: '',
  nmunicipio: '',
  nentidad: '',
  email: '',
  lada: '',
  numero: '',
  alumno_ref: 0,
}

export function normalizarDatosFacturacion(
  input: Partial<DatosFacturacionFormulario>
): DatosFacturacionFormulario {
  return {
    moneda: String(input.moneda ?? 'MXN').trim().slice(0, 5) || 'MXN',
    rfc: String(input.rfc ?? '').trim().toUpperCase().slice(0, 15),
    razsocial: String(input.razsocial ?? '').trim().toUpperCase().slice(0, 75),
    regfiscal: String(input.regfiscal ?? '').trim().slice(0, 5),
    usocfdi: String(input.usocfdi ?? '').trim().toUpperCase().slice(0, 5),
    codpostal: String(input.codpostal ?? '').trim().slice(0, 5),
    calle: String(input.calle ?? '').trim().slice(0, 35),
    nexterior: String(input.nexterior ?? '').trim().slice(0, 8),
    ninterior: String(input.ninterior ?? '').trim().slice(0, 10),
    ncolonia: String(input.ncolonia ?? '').trim().slice(0, 50),
    nmunicipio: String(input.nmunicipio ?? '').trim().slice(0, 35),
    nentidad: String(input.nentidad ?? '').trim().slice(0, 45),
    email: String(input.email ?? '').trim().slice(0, 45),
    lada: String(input.lada ?? '').trim().slice(0, 15),
    numero: String(input.numero ?? '').replace(/\s/g, '').slice(0, 15),
    alumno_ref: Number(input.alumno_ref),
  }
}

export function validarDatosFacturacion(
  datos: DatosFacturacionFormulario
): string[] {
  const errores: string[] = []
  if (!datos.alumno_ref || Number.isNaN(datos.alumno_ref)) {
    errores.push('Referencia de alumno no válida.')
  }
  if (!datos.rfc) errores.push('RFC es obligatorio.')
  if (!datos.razsocial) errores.push('Razón social es obligatoria.')
  if (!datos.regfiscal) errores.push('Régimen fiscal es obligatorio.')
  if (!datos.usocfdi) errores.push('Uso de CFDI es obligatorio.')
  if (!datos.codpostal) errores.push('Código postal es obligatorio.')
  if (!datos.calle) errores.push('Calle es obligatoria.')
  if (!datos.ncolonia) errores.push('Colonia es obligatoria.')
  if (!datos.nmunicipio) errores.push('Municipio es obligatorio.')
  if (!datos.nentidad) errores.push('Entidad es obligatoria.')
  if (!datos.email) errores.push('Correo electrónico es obligatorio.')
  return errores
}
