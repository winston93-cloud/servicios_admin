/**
 * Envío de suspensiones: prueba vs producción.
 * Hasta SUSPENSIONES_PRODUCCION_DESDE todo va a CORREO_PRUEBA (ningún papá).
 * A partir de esa fecha los correos salen a tutores autorizados.
 *
 * Overrides opcionales:
 * - SUSPENSIONES_FORZAR_PRUEBA=1 → siempre prueba
 * - SUSPENSIONES_FORZAR_PRODUCCION=1 → siempre producción
 * - SUSPENSIONES_PRODUCCION_DESDE=AAAA-MM-DD → cambiar fecha de corte
 */
export const SUSPENSIONES_PRODUCCION_DESDE = '2026-07-16'

function hoyIsoUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function fechaProduccionSuspensiones(): string {
  return (
    process.env.SUSPENSIONES_PRODUCCION_DESDE?.trim() ||
    SUSPENSIONES_PRODUCCION_DESDE
  )
}

function suspensionesEnProduccion(): boolean {
  if (process.env.SUSPENSIONES_FORZAR_PRUEBA === '1') return false
  if (process.env.SUSPENSIONES_FORZAR_PRODUCCION === '1') return true
  return hoyIsoUtc() >= fechaProduccionSuspensiones()
}

/** true = correos solo a CORREO_PRUEBA; false = envío a papás/tutores. */
export const SUSPENSIONES_ENVIO_MODO_PRUEBA = !suspensionesEnProduccion()

function correoPruebaSuspensiones(): string {
  return (
    process.env.SUSPENSIONES_CORREO_PRUEBA?.trim() ||
    process.env.NEXT_PUBLIC_SUSPENSIONES_CORREO_PRUEBA?.trim() ||
    'sistemas.desarrollo@winston93.edu.mx'
  )
}

export const SUSPENSIONES_CORREO_PRUEBA = correoPruebaSuspensiones()
