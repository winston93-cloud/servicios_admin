export class SatDescargaError extends Error {
  readonly code: string
  readonly status: number
  /** Detalle técnico (sin contraseña) para depuración en red/consola. */
  readonly detail?: string

  constructor(
    message: string,
    code = 'SAT_ERROR',
    status = 400,
    detail?: string
  ) {
    super(message)
    this.name = 'SatDescargaError'
    this.code = code
    this.status = status
    this.detail = detail
  }
}

export function mensajeErrorSat(err: unknown): string {
  if (err instanceof SatDescargaError) return err.message
  if (err instanceof Error) {
    const msg = err.message.trim()
    if (/bad decrypt|password|contrase/i.test(msg)) {
      return 'Contraseña incorrecta de la clave privada (.key).'
    }
    if (/certificate|certificado|expired|vigencia/i.test(msg)) {
      return 'Certificado inválido o vencido. Verifique su e.firma (FIEL).'
    }
    return msg || 'Error al comunicarse con el SAT.'
  }
  return 'Error inesperado al procesar la solicitud.'
}
