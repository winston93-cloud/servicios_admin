/**
 * Errores Payworks / comercio electrónico (Anexo A y B del manual Banorte v2.1).
 */
import type { RespuestaPayw2 } from './banortePayw2'
import { CATALOGO_PAYW_ES } from './banortePaywCatalog'

export type CategoriaErrorPayw = 'tarjeta' | 'datos' | 'banco' | 'sistema' | 'autenticacion'

export interface DetalleErrorPayw2 {
  titulo: string
  mensaje: string
  sugerencia: string
  categoria: CategoriaErrorPayw
  paywCode: string | null
  authResult: string | null
  detalleTecnico?: string
}

const TEXTO_EN_A_ES: Record<string, string> = {
  'The Transaction does not contain valid information.':
    'La transacción no contiene información válida.',
  'Decline': 'El banco rechazó el cargo.',
  'Invalid transaction': 'Transacción no válida.',
  'Invalid amount': 'Importe no válido.',
  'Invalid account number': 'Número de cuenta o tarjeta no válido.',
  'Expired card': 'La tarjeta está vencida.',
  'Insufficient funds': 'Fondos insuficientes.',
  'Do not honor': 'El banco no autorizó el cargo.',
}

const AUTH_RESULT_ES: Record<string, string> = {
  '00': 'Aprobada',
  '01': 'Consulte a su banco',
  '05': 'Rechazada por el banco emisor',
  '12': 'Transacción no válida',
  '13': 'Importe no válido',
  '14': 'Número de tarjeta no válido',
  '30': 'Error de formato',
  '41': 'Tarjeta reportada como extraviada',
  '43': 'Tarjeta reportada como robada',
  '51': 'Fondos insuficientes',
  '54': 'Tarjeta vencida',
  '55': 'PIN incorrecto',
  '57': 'Transacción no permitida para esta tarjeta',
  '58': 'Transacción no permitida en este terminal',
  '61': 'Excede el límite de la tarjeta',
  '62': 'Tarjeta restringida',
  '65': 'Excede el límite de intentos',
  '91': 'Emisor no disponible; intente más tarde',
  '96': 'Fallo del sistema; intente más tarde',
}

const PLANTILLA_GENERICO = {
  titulo: 'Pago no autorizado',
  mensaje: 'El banco no autorizó el cargo con su tarjeta.',
  sugerencia:
    'Revise los datos de la tarjeta, el CVV y la fecha de vencimiento, o intente con otra tarjeta. Si el problema continúa, contacte a su banco.',
  categoria: 'banco' as CategoriaErrorPayw,
}

function decodificarTextoPayw(texto: string | null): string {
  if (!texto) return ''
  return texto.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim()
}

function pareceEspanol(texto: string): boolean {
  return /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(texto) || /\b(la|el|no se|tarjeta|transacción|falla|inválid)\b/i.test(texto)
}

function traducirTextoIngles(texto: string): string {
  const limpio = decodificarTextoPayw(texto)
  if (!limpio) return ''
  if (pareceEspanol(limpio)) return limpio
  const exacto = TEXTO_EN_A_ES[limpio]
  if (exacto) return exacto
  for (const [en, es] of Object.entries(TEXTO_EN_A_ES)) {
    if (limpio.toLowerCase().includes(en.toLowerCase())) return es
  }
  return limpio
}

function normalizarPaywCode(code: string | null): string | null {
  if (!code) return null
  const c = code.trim().toUpperCase()
  if (/^PAYW-\d{4}$/.test(c)) return c
  const m = c.match(/(\d{4})/)
  return m ? `PAYW-${m[1]}` : c
}

function categoriaPorCodigo(paywCode: string | null): CategoriaErrorPayw {
  if (!paywCode) return 'banco'
  const n = parseInt(paywCode.replace(/\D/g, ''), 10)
  if (n >= 7100 && n < 8000) return 'autenticacion'
  if (n >= 4000 && n < 5000) return 'tarjeta'
  if (n >= 2000 && n < 3000) return 'datos'
  if (n >= 3000 && n < 4000) return 'sistema'
  return 'banco'
}

function tituloPorCategoria(cat: CategoriaErrorPayw, paywCode: string | null): string {
  switch (cat) {
    case 'autenticacion':
      return paywCode === 'PAYW-7100' ? 'Datos de pago incompletos' : 'Verificación de pago incompleta'
    case 'tarjeta':
      return 'Tarjeta no aceptada'
    case 'datos':
      return 'Revise los datos ingresados'
    case 'sistema':
      return 'Servicio de pago no disponible'
    default:
      return 'Pago no autorizado'
  }
}

function sugerenciaPorCategoria(cat: CategoriaErrorPayw): string {
  switch (cat) {
    case 'autenticacion':
      return 'Confirme nombre en la tarjeta, número, vencimiento (MM/AA) y CVV. No debe repetir 3D Secure: corrija los datos y pulse «Realizar pago» otra vez.'
    case 'tarjeta':
      return 'Use otra tarjeta habilitada para compras en línea o contacte a su banco.'
    case 'datos':
      return 'Verifique nombre, vencimiento MM/AA y CVV.'
    case 'sistema':
      return 'Espere unos minutos e intente de nuevo. Si persiste, contacte al plantel.'
    default:
      return PLANTILLA_GENERICO.sugerencia
  }
}

export function mensajeAuthResult(authResult: string | null): string | null {
  if (!authResult) return null
  return AUTH_RESULT_ES[authResult.trim()] ?? null
}

export function obtenerDetalleErrorPayw2(resp: RespuestaPayw2): DetalleErrorPayw2 {
  const paywCode = normalizarPaywCode(resp.paywCode)
  const textoRaw = decodificarTextoPayw(resp.text)
  const delCatalogo = paywCode ? CATALOGO_PAYW_ES[paywCode] : undefined
  const delTexto = traducirTextoIngles(textoRaw)
  const delAuth = mensajeAuthResult(resp.authResult)

  let mensaje = delCatalogo || delTexto || delAuth || PLANTILLA_GENERICO.mensaje
  if (delCatalogo && delTexto && delTexto !== delCatalogo && pareceEspanol(delTexto)) {
    mensaje = delTexto
  }

  const categoria = categoriaPorCodigo(paywCode)
  const detalleTecnico =
    textoRaw && mensaje && textoRaw.toLowerCase() !== mensaje.toLowerCase()
      ? [textoRaw, paywCode, resp.authResult].filter(Boolean).join(' · ')
      : paywCode
        ? `Código ${paywCode}${resp.authResult ? ` · Procesador ${resp.authResult}` : ''}`
        : undefined

  return {
    titulo: tituloPorCategoria(categoria, paywCode),
    mensaje,
    sugerencia: sugerenciaPorCategoria(categoria),
    categoria,
    paywCode,
    authResult: resp.authResult,
    detalleTecnico,
  }
}

export function etiquetaCategoriaPayw(categoria: CategoriaErrorPayw): string {
  switch (categoria) {
    case 'tarjeta':
      return 'Tarjeta'
    case 'datos':
      return 'Datos del formulario'
    case 'banco':
      return 'Banco emisor'
    case 'autenticacion':
      return '3D Secure / cargo'
    default:
      return 'Servicio'
  }
}
