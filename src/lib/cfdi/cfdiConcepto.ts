import type { CfdiConceptoResuelto, CfdiEmisorClave } from './cfdiTypes'

/** Código de concepto en posiciones 6-7 de pago_referencia (12 chars). */
export function codigoConceptoDesdeReferencia(referencia: string): string {
  return referencia.trim().slice(5, 7)
}

const MAP_EDUCATIVO: Record<string, CfdiConceptoResuelto> = {
  '00': { descripcion: 'Cuota Extraodinaria', codigoProducto: '86121501' },
  '16': { descripcion: 'Cuota Extraodinaria', codigoProducto: '86121501' },
  '17': { descripcion: 'Cuota Extraodinaria', codigoProducto: '86121501' },
  '23': { descripcion: 'Certificado Educativo 1', codigoProducto: '60101600' },
  '24': { descripcion: 'Certificado Educativo 2', codigoProducto: '60101600' },
  '25': { descripcion: 'Certificado Educativo 3', codigoProducto: '60101600' },
  '01': { descripcion: 'Colegiatura Septiembre', codigoProducto: '86121500' },
  '02': { descripcion: 'Colegiatura Octubre', codigoProducto: '86121500' },
  '03': { descripcion: 'Colegiatura Noviembre', codigoProducto: '86121500' },
  '04': { descripcion: 'Colegiatura Diciembre', codigoProducto: '86121500' },
  '05': { descripcion: 'Colegiatura Enero', codigoProducto: '86121500' },
  '06': { descripcion: 'Colegiatura Febrero', codigoProducto: '86121500' },
  '07': { descripcion: 'Colegiatura Marzo', codigoProducto: '86121500' },
  '08': { descripcion: 'Colegiatura Abril', codigoProducto: '86121500' },
  '09': { descripcion: 'Colegiatura Mayo', codigoProducto: '86121500' },
  '10': { descripcion: 'Colegiatura Junio', codigoProducto: '86121500' },
  '26': { descripcion: 'Colegiatura Julio', codigoProducto: '86121500' },
  '11': { descripcion: 'Anticipo Inscripcion', codigoProducto: '86121500' },
  '12': { descripcion: 'Liquidacion Inscripcion', codigoProducto: '86121500' },
  '13': { descripcion: 'Inscripcion', codigoProducto: '86121500' },
}

const MAP_CHURCHILL: Record<string, CfdiConceptoResuelto> = {
  ...MAP_EDUCATIVO,
  '00': { descripcion: 'Cuota Extraodinaria', codigoProducto: '86121500' },
  '16': { descripcion: 'Cuota Extraodinaria', codigoProducto: '86121500' },
  '17': { descripcion: 'Cuota Extraodinaria', codigoProducto: '86121500' },
}

export function resolverConcepto(
  referencia: string,
  emisor: CfdiEmisorClave
): CfdiConceptoResuelto {
  const cod = codigoConceptoDesdeReferencia(referencia)
  const map = emisor === 'educativo' ? MAP_EDUCATIVO : MAP_CHURCHILL
  return (
    map[cod] ?? {
      descripcion: `Concepto ${cod}`,
      codigoProducto: emisor === 'educativo' ? '86121500' : '86121500',
    }
  )
}

export function formaPagoDesdeMetodo(metodo: string): '01' | '03' {
  return metodo.trim().toLowerCase() === 'efectivo' ? '01' : '03'
}
