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

export function normalizarCurp(valor: string): string {
  return valor
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CURP_LONGITUD)
}

export function validarFormatoCurp(curp: string): { valido: boolean; mensaje?: string } {
  const c = normalizarCurp(curp)
  if (!c) {
    return { valido: false, mensaje: 'Ingrese el CURP completo (18 caracteres).' }
  }
  if (c.length < CURP_LONGITUD) {
    return {
      valido: false,
      mensaje: `Faltan ${CURP_LONGITUD - c.length} caracteres (${c.length}/${CURP_LONGITUD}).`,
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
  const c = normalizarCurp(curp)
  if (!c.length) return '—'
  const trozo = c.slice(inicio, fin)
  return trozo.padEnd(fin - inicio, '·')
}
