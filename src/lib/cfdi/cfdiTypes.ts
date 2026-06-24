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
