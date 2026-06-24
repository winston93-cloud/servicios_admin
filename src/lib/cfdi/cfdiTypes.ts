export type CfdiEmisorClave = 'churchill' | 'educativo'

export type FormaPagoCfdi = '01' | '03'

export interface CfdiConceptoResuelto {
  descripcion: string
  codigoProducto: string
}

export interface CfdiInstitucionEducativa {
  nombreAlumno: string
  curp: string
  nivelEducativo: string
  claveInstitucion: string
}

export interface CfdiTimbradoResultado {
  ok: boolean
  referencia: string
  codigo?: string
  mensaje: string
  uuid?: string
  emisor: CfdiEmisorClave
  errorTecnico?: string
}

export interface CfdiTimbradoLoteResultado {
  procesados: number
  exitosos: number
  fallidos: number
  resultados: CfdiTimbradoResultado[]
}

export type CfdiMotivoCancelacion = '01' | '02' | '03' | '04'

export interface CfdiCancelacionResultado {
  ok: boolean
  uuid: string
  codigo: string
  mensaje: string
  emisor: CfdiEmisorClave
  errorTecnico?: string
}

export interface CfdiNotaCreditoResultado {
  ok: boolean
  referencia: string
  codigo: string
  mensaje: string
  uuid?: string
  emisor: CfdiEmisorClave
  errorTecnico?: string
}
