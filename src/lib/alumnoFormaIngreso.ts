/** Valores de `alumno_nuevo_ingreso` en BD (0–1). */
export const FORMA_INGRESO_OPCIONES = [
  { valor: 0, etiqueta: 'Reinscrito' },
  { valor: 1, etiqueta: 'De nuevo ingreso' },
] as const

export type FormaIngresoValor = (typeof FORMA_INGRESO_OPCIONES)[number]['valor']

export function parseFormaIngreso(
  valor: string | number | null | undefined
): number | null {
  if (valor == null || valor === '') return null
  const n = typeof valor === 'number' ? valor : parseInt(String(valor), 10)
  return Number.isNaN(n) ? null : n
}

export function formaIngresoPorDefecto(
  valor: string | number | null | undefined
): FormaIngresoValor {
  const n = parseFormaIngreso(valor)
  if (n != null && FORMA_INGRESO_OPCIONES.some((o) => o.valor === n)) {
    return n as FormaIngresoValor
  }
  return 0
}
