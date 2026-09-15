/** Catálogo de indicadores Kinder Español (legacy boletasek / boleta_calificacionpke). */

export type KinderEsGrado = 1 | 2 | 3

export type KinderEsIndicador = {
  /** Coincide con fk_materia legacy */
  id: number
  grado: KinderEsGrado
  nombre: string
  orden: number
}

/** Nivel alumno Winston: 2 = Kinder */
export const BOLETAS_NIVEL_KINDER = 2

export const KINDER_ES_GRADOS: { valor: KinderEsGrado; etiqueta: string }[] = [
  { valor: 1, etiqueta: 'K1' },
  { valor: 2, etiqueta: 'K2' },
  { valor: 3, etiqueta: 'K3' },
]

export const KINDER_ES_GRUPOS = ['A', 'B', 'C', 'D'] as const

const K1: Omit<KinderEsIndicador, 'grado' | 'orden'>[] = [
  { id: 1, nombre: 'IDENTIFICACION DE COLORES' },
  { id: 2, nombre: 'UBICACION ESPACIAL' },
  { id: 3, nombre: 'IDENTIFICACION DE LINEAS' },
  { id: 4, nombre: 'IDENTIFICACION DE FIGURAS GEOMETRICAS' },
  { id: 5, nombre: 'IDENTIFICACION DE NUMEROS' },
  { id: 6, nombre: 'IDENTIFICACION DE VOCALES' },
  { id: 7, nombre: 'RITMO Y SECUENCIA AL CONTAR' },
  { id: 8, nombre: 'PROYECTOS' },
  { id: 9, nombre: 'TRABAJO EN CLASE' },
  { id: 10, nombre: 'TAREAS' },
  { id: 11, nombre: 'CONDUCTA' },
  { id: 12, nombre: 'EXAMEN ESPAÑOL' },
  { id: 13, nombre: 'EXAMEN MATEMATICAS' },
  { id: 14, nombre: 'EDUCACION FISICA' },
]

const K2: Omit<KinderEsIndicador, 'grado' | 'orden'>[] = [
  { id: 15, nombre: 'IDENTIFICACION DE COLORES' },
  { id: 16, nombre: 'IDENTIFICACION DE VOCALES' },
  { id: 17, nombre: 'IDENTIFICACION DE LINEAS' },
  { id: 18, nombre: 'DIPTONGOS' },
  { id: 19, nombre: 'CONSONANTES' },
  { id: 20, nombre: 'SILABAS' },
  { id: 21, nombre: 'IDENTIFICACION DE NUMEROS' },
  { id: 22, nombre: 'PALABRAS SENCILLAS' },
  { id: 23, nombre: 'CONTEO' },
  { id: 24, nombre: 'UBICACION ESPACIAL' },
  { id: 25, nombre: 'FIGURAS GEOMETRICAS' },
  { id: 26, nombre: 'SUMAS' },
  { id: 27, nombre: 'RESTAS' },
  { id: 28, nombre: 'PROYECTOS' },
  { id: 29, nombre: 'LECTURA DE SILABAS Y PALABRAS SENCILLAS' },
  { id: 30, nombre: 'TAREAS' },
  { id: 31, nombre: 'EXAMEN ESPAÑOL' },
  { id: 32, nombre: 'EXAMEN MATEMATICAS' },
  { id: 33, nombre: 'TRABAJO EN CLASE' },
  { id: 34, nombre: 'CONDUCTA' },
  { id: 35, nombre: 'COMPUTACION' },
  { id: 36, nombre: 'EDUCACION FISICA' },
]

const K3: Omit<KinderEsIndicador, 'grado' | 'orden'>[] = [
  { id: 37, nombre: 'ESCRITURA (TRAZO)' },
  { id: 38, nombre: 'LECTURA (FLUIDEZ)' },
  { id: 39, nombre: 'LECTURA (COMPRENSION)' },
  { id: 40, nombre: 'IDENTIFICACION DEL ABECEDARIO' },
  { id: 41, nombre: 'DICTADO' },
  { id: 42, nombre: 'SUMAS' },
  { id: 43, nombre: 'RESTAS' },
  { id: 44, nombre: 'FIGURAS GEOMETRICAS' },
  { id: 45, nombre: 'PROBLEMAS RAZONADOS' },
  { id: 46, nombre: 'IDENTIFICACION DE NUMEROS' },
  { id: 47, nombre: 'UNIDADES-DECENAS' },
  { id: 48, nombre: 'NUMEROS ANTECESOR Y SUCESOR' },
  { id: 49, nombre: 'SECUENCIAS NUMERICAS' },
  { id: 50, nombre: 'PROYECTOS' },
  { id: 51, nombre: 'EXAMEN ESPAÑOL' },
  { id: 52, nombre: 'EXAMEN MATEMATICAS' },
  { id: 53, nombre: 'TAREAS' },
  { id: 54, nombre: 'TRABAJO EN CLASE' },
  { id: 55, nombre: 'CONDUCTA' },
  { id: 56, nombre: 'COMPUTACION' },
  { id: 57, nombre: 'ROBOTICA' },
  { id: 58, nombre: 'EDUCACION FISICA' },
]

function conMeta(
  grado: KinderEsGrado,
  rows: Omit<KinderEsIndicador, 'grado' | 'orden'>[]
): KinderEsIndicador[] {
  return rows.map((r, i) => ({ ...r, grado, orden: i + 1 }))
}

export const KINDER_ES_INDICADORES: KinderEsIndicador[] = [
  ...conMeta(1, K1),
  ...conMeta(2, K2),
  ...conMeta(3, K3),
]

export function indicadoresPorGrado(grado: KinderEsGrado): KinderEsIndicador[] {
  return KINDER_ES_INDICADORES.filter((i) => i.grado === grado)
}

export function grupoNumeroDesdeLetra(letra: string): number {
  const map: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 }
  return map[letra.toUpperCase()] ?? 0
}

export function letraDesdeGrupoNumero(n: number): string {
  return ({ 1: 'A', 2: 'B', 3: 'C', 4: 'D' } as Record<number, string>)[n] ?? String(n)
}
