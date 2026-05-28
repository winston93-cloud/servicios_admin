/**
 * Modo prueba de envío de suspensiones.
 * Mientras esté activo, NINGÚN correo sale a papás/tutores: todo va a CORREO_PRUEBA.
 * Poner MODO_PRUEBA en false antes del envío real a familias.
 */
export const SUSPENSIONES_ENVIO_MODO_PRUEBA = true

function correoPruebaSuspensiones(): string {
  return (
    process.env.SUSPENSIONES_CORREO_PRUEBA?.trim() ||
    process.env.NEXT_PUBLIC_SUSPENSIONES_CORREO_PRUEBA?.trim() ||
    'sistemas.desarrollo@winston93.edu.mx'
  )
}

export const SUSPENSIONES_CORREO_PRUEBA = correoPruebaSuspensiones()
