/**
 * Número de ciclo escolar usado en referencias de pago (legacy getCurrentSchoolYearNumberAdmin).
 * Antes del 10 de julio se considera aún el ciclo del año calendario anterior.
 */
export function numeroCicloEscolarAdmin(fecha: Date = new Date()): number {
  const dia = fecha.getDate()
  const mes = fecha.getMonth() + 1
  let anio = fecha.getFullYear()
  if (mes < 7 || (mes === 7 && dia < 10)) {
    anio -= 1
  }
  return anio - 2003
}
