/** Mensajes legacy (comercio.php) + manual 3D Secure 2.0. */
export function mensajeError3dSecure(estatus: number | string | null | undefined): string {
  const code = Number(estatus)
  if (Number.isNaN(code)) {
    return 'La verificación 3D Secure no fue aprobada. Revise los datos de su tarjeta e intente de nuevo.'
  }

  const mapa: Record<number, string> = {
    102: 'Tarjeta inválida.',
    201: 'Error general en Visa o Mastercard. Espere unos minutos e intente de nuevo.',
    421: 'El servicio 3D Secure no está disponible. Intente más tarde o contacte a su banco.',
    422: 'Problema al autenticar con el banco emisor. Contacte a su banco o use otra tarjeta.',
    423: 'Datos del tarjetahabiente incorrectos. Verifique nombre, dirección y código postal.',
    430: 'Número de tarjeta vacío.',
    431: 'Fecha de expiración vacía.',
    436: 'El número de tarjeta debe tener 16 dígitos.',
    437: 'Formato de expiración incorrecto (use MM/AA).',
    438: 'La tarjeta está vencida.',
    442: 'Marca de tarjeta incorrecta (use VISA o MasterCard).',
    443: 'La tarjeta no corresponde a la marca VISA seleccionada.',
    444: 'La tarjeta no corresponde a la marca MasterCard seleccionada.',
    457: 'Código postal no encontrado en la base de datos del emisor.',
    498: 'La transacción expiró por tiempo de espera.',
    499: 'Tiempo de captura excedido en 3D Secure.',
  }

  return (
    mapa[code] ??
    `La verificación no fue aprobada (código ${code}). Intente de nuevo o use otra tarjeta.`
  )
}
