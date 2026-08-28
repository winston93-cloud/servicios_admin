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

export function mensajeRechazoSat(codigo: number, mensajeSat: string): string {
  const msg = mensajeSat.trim() || 'Sin mensaje del SAT.'
  if (/no controlado/i.test(msg)) {
    return (
      'El SAT rechazó la solicitud (a veces por duplicado o carga interna). ' +
      'Si hace pocos minutos ya consultó el mismo periodo, espere 15–30 minutos antes de reintentar; ' +
      'el SAT suele procesar una solicitud a la vez por RFC.'
    )
  }
  if (codigo === 5002) {
    return 'Ya hay una solicitud de descarga en proceso en el SAT para este RFC. Espere a que termine.'
  }
  if (codigo === 301 || codigo === 302) {
    return 'Demasiadas solicitudes al SAT en poco tiempo. Intente de nuevo más tarde.'
  }
  return `El SAT rechazó la operación (código ${codigo}): ${msg}`
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
