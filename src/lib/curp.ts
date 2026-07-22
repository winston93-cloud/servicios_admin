export const CURP_LONGITUD = 18

export const SEGMENTOS_CURP = [
  { inicio: 0, fin: 4, etiqueta: 'Iniciales' },
  { inicio: 4, fin: 10, etiqueta: 'Fecha de nacimiento' },
  { inicio: 10, fin: 11, etiqueta: 'Sexo' },
  { inicio: 11, fin: 13, etiqueta: 'Entidad' },
  { inicio: 13, fin: 16, etiqueta: 'Consonantes internas' },
  { inicio: 16, fin: 18, etiqueta: 'Homoclave y dígito' },
] as const

const PATRON_CURP = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/
/** Primeros 17 caracteres (sin dígito verificador). */
const PATRON_CURP_17 = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]$/

/** Alfabeto oficial RENAPO para el dígito verificador (incluye Ñ). */
const DICCIONARIO_CURP = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'

function sanitizarCurp(valor: string): string {
  return valor
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CURP_LONGITUD)
}

/**
 * Dígito verificador RENAPO a partir de los 17 primeros caracteres.
 * Si el tramo no es válido, regresa null.
 */
export function digitoVerificadorCurp(curp17: string): string | null {
  const c = sanitizarCurp(curp17).slice(0, 17)
  if (c.length !== 17 || !PATRON_CURP_17.test(c)) return null
  let suma = 0
  for (let i = 0; i < 17; i++) {
    const idx = DICCIONARIO_CURP.indexOf(c.charAt(i))
    if (idx < 0) return null
    suma += idx * (18 - i)
  }
  const digito = 10 - (suma % 10)
  return digito === 10 ? '0' : String(digito)
}

/**
 * Si vienen 17 caracteres con formato válido, completa el dígito verificador.
 * Con 18 (o menos de 17) deja el valor sanitizado tal cual.
 */
export function completarCurpConDigito(valor: string): string {
  const c = sanitizarCurp(valor)
  if (c.length !== 17) return c
  const digito = digitoVerificadorCurp(c)
  return digito ? `${c}${digito}` : c
}

/** Normaliza y, si falta solo el dígito verificador, lo calcula. */
export function normalizarCurp(valor: string): string {
  return completarCurpConDigito(valor)
}

export function validarFormatoCurp(curp: string): { valido: boolean; mensaje?: string } {
  const crudo = sanitizarCurp(curp)
  if (!crudo) {
    return { valido: false, mensaje: 'Ingrese el CURP completo (18 caracteres).' }
  }

  const c = completarCurpConDigito(crudo)

  if (c.length < CURP_LONGITUD) {
    const faltan = CURP_LONGITUD - c.length
    return {
      valido: false,
      mensaje:
        faltan === 1
          ? `Falta el dígito verificador (último caracter). Lleva ${c.length}/${CURP_LONGITUD}.`
          : `Faltan ${faltan} caracteres (${c.length}/${CURP_LONGITUD}). El CURP debe tener 18.`,
    }
  }
  if (!PATRON_CURP.test(c)) {
    return {
      valido: false,
      mensaje:
        'Revise el formato: 4 letras, 6 dígitos de fecha, H o M, 2 letras de entidad, 3 letras, homoclave y dígito verificador.',
    }
  }
  return { valido: true }
}

export function segmentoCurp(curp: string, inicio: number, fin: number): string {
  const c = sanitizarCurp(curp)
  if (!c.length) return '—'
  const trozo = c.slice(inicio, fin)
  return trozo.padEnd(fin - inicio, '·')
}
