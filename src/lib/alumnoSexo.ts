/** Valores de `alumno_sexo` en `alumno_detalles` (H / M). */
export const SEXO_ALUMNO_OPCIONES = [
  { valor: 'H', etiqueta: 'Masculino' },
  { valor: 'M', etiqueta: 'Femenino' },
] as const

export type SexoAlumnoValor = (typeof SEXO_ALUMNO_OPCIONES)[number]['valor']

export function parseSexoAlumno(
  sexo: string | null | undefined
): SexoAlumnoValor | '' {
  const s = String(sexo ?? '').trim().toUpperCase()
  if (s === 'H' || s === 'M') return s
  return ''
}

export function sexoAlumnoPorDefecto(
  sexo: string | null | undefined
): SexoAlumnoValor | '' {
  return parseSexoAlumno(sexo)
}
