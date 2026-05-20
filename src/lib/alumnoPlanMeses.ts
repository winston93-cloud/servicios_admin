/** Plan de colegiatura según `alumno.mes` (legacy). */
export function etiquetaPlanMeses(mes: number | null | undefined): string | null {
  const m = Number(mes)
  if (m === 1) return 'Pago a 10 meses'
  if (m === 2) return 'Pago a 11 meses'
  return null
}

export function clasePlanMeses(mes: number | null | undefined): string {
  const m = Number(mes)
  if (m === 1) return 'pc-plan--10'
  if (m === 2) return 'pc-plan--11'
  return 'pc-plan--otro'
}
