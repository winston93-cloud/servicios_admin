/**
 * Códigos Estatus POST de Banorte 3D Secure (Solucion3DSecure.htm).
 * Fuente: manual 3DS / Payworks, comercio.php legacy y response_log.txt.
 */

export type CategoriaError3d = 'tarjeta' | 'datos' | 'banco' | 'sistema' | 'tiempo'

export interface DetalleError3dSecure {
  aprobado: boolean
  codigo: number | null
  titulo: string
  mensaje: string
  sugerencia: string
  categoria: CategoriaError3d
  /** Texto crudo de Banorte (MENSAJE), si difiere del mensaje mostrado. */
  detalleTecnico?: string
}

type PlantillaError = Omit<DetalleError3dSecure, 'aprobado' | 'codigo' | 'detalleTecnico'>

const PLANTILLA_RECHAZO_GENERICO: PlantillaError = {
  titulo: 'Verificación no aprobada',
  mensaje:
    'Su banco o el servicio 3D Secure no autorizó la verificación. El cargo no se realizó.',
  sugerencia:
    'Revise los datos de su tarjeta, intente de nuevo o use otra tarjeta. Si el problema continúa, contacte a su banco.',
  categoria: 'banco',
}

/** Catálogo por código (mensaje orientado al usuario). */
const POR_CODIGO: Record<number, PlantillaError> = {
  102: {
    titulo: 'Tarjeta no válida',
    mensaje: 'El número de tarjeta no es válido o no está habilitado para compras en línea.',
    sugerencia: 'Confirme los 16 dígitos o use otra tarjeta de crédito o débito.',
    categoria: 'tarjeta',
  },
  201: {
    titulo: 'Servicio temporalmente no disponible',
    mensaje:
      'Se detectó un error en la red de Visa o Mastercard. No se completó la verificación.',
    sugerencia: 'Espere unos minutos e intente de nuevo.',
    categoria: 'sistema',
  },
  421: {
    titulo: '3D Secure no disponible',
    mensaje: 'El servicio de verificación 3D Secure no está disponible en este momento.',
    sugerencia:
      'Intente más tarde. Si el error persiste después de varios intentos, contacte al plantel.',
    categoria: 'sistema',
  },
  422: {
    titulo: 'Autenticación rechazada por su banco',
    mensaje: 'Su banco emisor no aprobó la verificación 3D Secure.',
    sugerencia:
      'Comuníquese con su banco o intente con otra tarjeta. Asegúrese de completar el código o la app de su banco.',
    categoria: 'banco',
  },
  423: {
    titulo: 'Datos del titular incorrectos',
    mensaje:
      'La información del titular de la tarjeta no coincide con lo registrado en su banco.',
    sugerencia:
      'Verifique nombre, apellidos, dirección, código postal y correo. Si persiste, contacte a su banco.',
    categoria: 'datos',
  },
  430: {
    titulo: 'Falta el número de tarjeta',
    mensaje: 'No se recibió el número de tarjeta en la solicitud de verificación.',
    sugerencia: 'Regrese al portal e inicie el pago de nuevo.',
    categoria: 'datos',
  },
  431: {
    titulo: 'Falta la fecha de vencimiento',
    mensaje: 'No se recibió la fecha de vencimiento de la tarjeta.',
    sugerencia: 'Seleccione mes y año de vencimiento (formato MM/AA) e intente de nuevo.',
    categoria: 'datos',
  },
  436: {
    titulo: 'Número de tarjeta incompleto',
    mensaje: 'El número de tarjeta debe tener 16 dígitos.',
    sugerencia: 'Ingrese los 16 dígitos sin espacios ni guiones.',
    categoria: 'tarjeta',
  },
  437: {
    titulo: 'Fecha de vencimiento incorrecta',
    mensaje: 'El formato de vencimiento no es válido.',
    sugerencia: 'Use el formato MM/AA (por ejemplo 09/28).',
    categoria: 'datos',
  },
  438: {
    titulo: 'Tarjeta vencida',
    mensaje: 'La tarjeta está vencida según la fecha indicada.',
    sugerencia: 'Use una tarjeta vigente o actualice el plástico con su banco.',
    categoria: 'tarjeta',
  },
  441: {
    titulo: 'Tarjeta no aceptada',
    mensaje: 'La tarjeta no pudo validarse para este comercio.',
    sugerencia: 'Use otra tarjeta Visa o MasterCard habilitada para compras en línea.',
    categoria: 'tarjeta',
  },
  442: {
    titulo: 'Marca de tarjeta incorrecta',
    mensaje: 'La marca seleccionada no coincide con su tarjeta.',
    sugerencia: 'Elija VISA o MasterCard según el plástico que está usando.',
    categoria: 'datos',
  },
  443: {
    titulo: 'La tarjeta no es Visa',
    mensaje: 'Seleccionó Visa, pero el número de tarjeta no corresponde a esa marca.',
    sugerencia: 'Cambie la marca a MasterCard o verifique el número ingresado.',
    categoria: 'datos',
  },
  444: {
    titulo: 'La tarjeta no es MasterCard',
    mensaje: 'Seleccionó MasterCard, pero el número de tarjeta no corresponde a esa marca.',
    sugerencia: 'Cambie la marca a Visa o verifique el número ingresado.',
    categoria: 'datos',
  },
  424: {
    titulo: 'Autenticación no completada',
    mensaje: 'No ingresó correctamente la contraseña o validación 3D Secure de su banco.',
    sugerencia: 'Intente de nuevo y complete el paso en la app o página de su banco.',
    categoria: 'banco',
  },
  425: {
    titulo: 'Autenticación inválida',
    mensaje: 'La verificación 3D Secure no fue válida.',
    sugerencia: 'No reintente el mismo código fallido; use otra tarjeta o contacte a su banco.',
    categoria: 'banco',
  },
  426: {
    titulo: 'Afiliación no encontrada',
    mensaje: 'La afiliación del comercio no está registrada en 3D Secure.',
    sugerencia: 'Contacte al plantel; el cargo no puede procesarse en este momento.',
    categoria: 'sistema',
  },
  446: {
    titulo: 'Importe incorrecto',
    mensaje: 'El monto enviado a 3D Secure no es válido para Banorte.',
    sugerencia: 'Regrese al portal e inicie el pago de nuevo desde el concepto correcto.',
    categoria: 'datos',
  },
  447: {
    titulo: 'Referencia de pago faltante',
    mensaje: 'No se recibió la referencia 3D en la respuesta.',
    sugerencia: 'Cierre esta ventana, regrese al portal de pagos e inicie de nuevo.',
    categoria: 'sistema',
  },
  452: {
    titulo: 'Dato obligatorio faltante',
    mensaje: 'Falta un campo obligatorio en el formulario de verificación.',
    sugerencia: 'Complete todos los campos del paso 1 antes de continuar.',
    categoria: 'datos',
  },
  454: {
    titulo: 'Dato con formato inválido',
    mensaje: 'Algún campo no cumple el formato exigido por Banorte.',
    sugerencia: 'Revise correo, celular (solo números), calle y código postal.',
    categoria: 'datos',
  },
  455: {
    titulo: 'Servicio 3D Secure Plus inhabilitado',
    mensaje: 'El módulo 3D Secure no está habilitado para esta afiliación.',
    sugerencia: 'Contacte al plantel para revisar la configuración con Banorte.',
    categoria: 'sistema',
  },
  456: {
    titulo: 'Error de comunicación con el banco',
    mensaje: 'No se pudo completar la comunicación con el servicio de autenticación.',
    sugerencia: 'Intente de nuevo en unos minutos o use otra tarjeta.',
    categoria: 'sistema',
  },
  451: {
    titulo: 'Faltan datos obligatorios',
    mensaje: 'Faltan o son inválidos datos requeridos para la verificación (correo, celular, nombre, etc.).',
    sugerencia:
      'Complete todos los campos del formulario: nombre, apellidos, correo válido, celular solo con números (10 dígitos), ciudad, estado, calle y código postal.',
    categoria: 'datos',
  },
  453: {
    titulo: 'Error en los datos enviados',
    mensaje: 'Uno o más datos del formulario no cumplen el formato que exige Banorte.',
    sugerencia: 'Revise correo, celular numérico, longitud de la calle (máx. 60 caracteres) e intente de nuevo.',
    categoria: 'datos',
  },
  457: {
    titulo: 'Código postal no reconocido',
    mensaje: 'El código postal no fue encontrado en la base del banco emisor.',
    sugerencia: 'Verifique su código postal o contacte a su banco si es correcto.',
    categoria: 'datos',
  },
  459: {
    titulo: 'Datos de facturación incorrectos',
    mensaje:
      'Algún dato de contacto o dirección no es válido para 3D Secure (país, correo, celular, etc.).',
    sugerencia:
      'Use México como país (MX), correo válido, celular de 10 dígitos sin espacios y dirección completa.',
    categoria: 'datos',
  },
  498: {
    titulo: 'Tiempo de verificación agotado',
    mensaje: 'La transacción excedió el tiempo máximo de respuesta.',
    sugerencia: 'Inicie el pago de nuevo y complete la verificación con su banco sin demora.',
    categoria: 'tiempo',
  },
  499: {
    titulo: 'Tiempo agotado en el banco',
    mensaje: 'Tardó demasiado en confirmar el código o la notificación de su banco.',
    sugerencia: 'Intente de nuevo y apruebe la verificación en la app o SMS de su banco a tiempo.',
    categoria: 'tiempo',
  },
}

const ETIQUETAS_CAMPO: Record<string, string> = {
  billTo_country: 'país',
  billTo_email: 'correo electrónico',
  'CORREO\\EMAIL': 'correo electrónico',
  'NUMERO_CELULAR\\MOBILE_PHONE': 'número de celular',
  'NAME\\NOMBRE': 'nombre',
  'APELLIDO\\LAST_NAME': 'apellidos',
  'CIUDAD\\CITY': 'ciudad',
  'CALLE\\STREET': 'calle',
}

export function esEstatus3dAprobado(estatus: string | number | null | undefined): boolean {
  return String(estatus ?? '').trim() === '200'
}

/** Convierte MENSAJE técnico de Banorte a texto legible. */
export function humanizarMensajeBanorte3d(mensaje: string): string {
  let texto = mensaje.trim()
  if (!texto) return ''

  for (const [clave, etiqueta] of Object.entries(ETIQUETAS_CAMPO)) {
    texto = texto.replace(new RegExp(clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), etiqueta)
  }

  texto = texto
    .replace(/no es valido/gi, 'no es válido')
    .replace(/no es un numerico/gi, 'debe contener solo números')
    .replace(/es un campo obligatorio/gi, 'es obligatorio')
    .replace(/Tarjeta invalida/gi, 'La tarjeta no es válida')
    .replace(/excede la longitud permitida de '(\d+)' caracteres/gi, 'es demasiado largo (máximo $1 caracteres)')

  if (!/[.!?]$/.test(texto)) texto += '.'

  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function parsearCodigo(estatus: string | number | null | undefined): number | null {
  const code = parseInt(String(estatus ?? '').trim(), 10)
  return Number.isNaN(code) ? null : code
}

export function obtenerDetalleError3dSecure(
  estatus: string | number | null | undefined,
  mensajeBanorte?: string | null
): DetalleError3dSecure {
  const codigo = parsearCodigo(estatus)

  if (esEstatus3dAprobado(estatus)) {
    return {
      aprobado: true,
      codigo: 200,
      titulo: 'Verificación aprobada',
      mensaje: 'Su banco confirmó la identidad del titular. Puede continuar con el cargo.',
      sugerencia: '',
      categoria: 'sistema',
    }
  }

  const plantilla =
    codigo != null && POR_CODIGO[codigo] ? POR_CODIGO[codigo] : PLANTILLA_RECHAZO_GENERICO

  const mensajeRaw = String(mensajeBanorte ?? '').trim()
  const mensajeHumano = mensajeRaw ? humanizarMensajeBanorte3d(mensajeRaw) : ''

  return {
    aprobado: false,
    codigo,
    titulo: plantilla.titulo,
    mensaje: mensajeHumano || plantilla.mensaje,
    sugerencia: plantilla.sugerencia,
    categoria: plantilla.categoria,
    detalleTecnico:
      mensajeRaw && mensajeHumano && mensajeRaw.toLowerCase() !== mensajeHumano.toLowerCase()
        ? mensajeRaw
        : undefined,
  }
}

/** @deprecated Preferir obtenerDetalleError3dSecure */
export function mensajeError3dSecure(
  estatus: number | string | null | undefined,
  mensajeBanorte?: string | null
): string {
  return obtenerDetalleError3dSecure(estatus, mensajeBanorte).mensaje
}

export function etiquetaCategoria3d(categoria: CategoriaError3d): string {
  switch (categoria) {
    case 'tarjeta':
      return 'Tarjeta'
    case 'datos':
      return 'Datos del formulario'
    case 'banco':
      return 'Banco emisor'
    case 'tiempo':
      return 'Tiempo de espera'
    default:
      return 'Servicio'
  }
}
