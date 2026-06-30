/**
 * Envío de suspensiones: producción activa (correos a tutores autorizados).
 * Para volver a prueba temporalmente: SUSPENSIONES_FORZAR_PRUEBA=1 en Vercel.
 */
function suspensionesEnModoPrueba(): boolean {
  return process.env.SUSPENSIONES_FORZAR_PRUEBA === '1'
}

/** true = correos solo a CORREO_PRUEBA; false = envío a papás/tutores. */
export const SUSPENSIONES_ENVIO_MODO_PRUEBA = suspensionesEnModoPrueba()

function correoPruebaSuspensiones(): string {
  return (
    process.env.SUSPENSIONES_CORREO_PRUEBA?.trim() ||
    process.env.NEXT_PUBLIC_SUSPENSIONES_CORREO_PRUEBA?.trim() ||
    'sistemas.desarrollo@winston93.edu.mx'
  )
}

export const SUSPENSIONES_CORREO_PRUEBA = correoPruebaSuspensiones()
