/** Catálogo Primaria Español — materias por bloque y grado (legacy boleta.php / prim_*). */

export type PrimariaEsGrado = 1 | 2 | 3 | 4 | 5 | 6

export type PrimariaEsBloque =
  | 'lenguajes'
  | 'saberes'
  | 'humano'
  | 'etica'
  | 'extra'
  | 'habilidades'

export type PrimariaEsMateria = {
  /** id_materia legacy dentro del bloque (prim_*) */
  id: number
  bloque: PrimariaEsBloque
  nombre: string
  orden: number
  /** Grados donde la materia es visible en captura (no se guarda "0" oculto). */
  grados: PrimariaEsGrado[]
}

/** Nivel alumno Winston: 3 = Primaria */
export const BOLETAS_NIVEL_PRIMARIA = 3

export const PRIMARIA_ES_GRADOS: { valor: PrimariaEsGrado; etiqueta: string }[] = [
  { valor: 1, etiqueta: '1°' },
  { valor: 2, etiqueta: '2°' },
  { valor: 3, etiqueta: '3°' },
  { valor: 4, etiqueta: '4°' },
  { valor: 5, etiqueta: '5°' },
  { valor: 6, etiqueta: '6°' },
]

/** Grupos A–C (legacy 1–3); D existe en DB pero captura primaria ES usa A–C. */
export const PRIMARIA_ES_GRUPOS = ['A', 'B', 'C'] as const

export const PRIMARIA_ES_BLOQUES: {
  id: PrimariaEsBloque
  etiqueta: string
  tono?: 'accent' | 'warn'
}[] = [
  { id: 'lenguajes', etiqueta: 'Lenguajes' },
  { id: 'saberes', etiqueta: 'Saberes y pensamiento científico' },
  { id: 'humano', etiqueta: 'De lo humano y lo comunitario' },
  { id: 'etica', etiqueta: 'Ética, naturaleza y sociedades' },
  { id: 'extra', etiqueta: 'Clases extracurriculares' },
  { id: 'habilidades', etiqueta: 'Habilidades conductuales', tono: 'warn' },
]

const G_ALL: PrimariaEsGrado[] = [1, 2, 3, 4, 5, 6]
const G_LE_2: PrimariaEsGrado[] = [1, 2]
const G_GE_3: PrimariaEsGrado[] = [3, 4, 5, 6]
const G_EQ_3: PrimariaEsGrado[] = [3]
const G_GE_4: PrimariaEsGrado[] = [4, 5, 6]

/**
 * materia_id = índice legacy 1-based en cada tabla prim_*.
 * Visibilidad según boleta.php (gradosdx).
 */
export const PRIMARIA_ES_MATERIAS: PrimariaEsMateria[] = [
  // prim_lenguajes
  { id: 1, bloque: 'lenguajes', nombre: 'ESPAÑOL', orden: 1, grados: G_ALL },
  { id: 2, bloque: 'lenguajes', nombre: 'INGLÉS', orden: 2, grados: G_ALL },
  { id: 3, bloque: 'lenguajes', nombre: 'ARTES', orden: 3, grados: G_ALL },
  // prim_saberes
  { id: 1, bloque: 'saberes', nombre: 'MATEMÁTICAS', orden: 1, grados: G_ALL },
  { id: 2, bloque: 'saberes', nombre: 'CIENCIAS NATURALES', orden: 2, grados: G_GE_3 },
  // prim_humano
  { id: 1, bloque: 'humano', nombre: 'EDUCACIÓN FÍSICA', orden: 1, grados: G_ALL },
  // prim_etica
  { id: 1, bloque: 'etica', nombre: 'CONOCIMIENTO DEL MEDIO', orden: 1, grados: G_LE_2 },
  { id: 2, bloque: 'etica', nombre: 'LA ENTIDAD DONDE VIVO', orden: 2, grados: G_EQ_3 },
  { id: 3, bloque: 'etica', nombre: 'FORMACIÓN CÍVICA Y ÉTICA', orden: 3, grados: G_EQ_3 },
  { id: 4, bloque: 'etica', nombre: 'GEOGRAFÍA', orden: 4, grados: G_GE_4 },
  { id: 5, bloque: 'etica', nombre: 'HISTORIA', orden: 5, grados: G_GE_4 },
  { id: 6, bloque: 'etica', nombre: 'FORMACIÓN CÍVICA Y ÉTICA', orden: 6, grados: G_GE_4 },
  // prim_extra
  { id: 1, bloque: 'extra', nombre: 'COMPUTACIÓN', orden: 1, grados: G_ALL },
  { id: 2, bloque: 'extra', nombre: 'ROBÓTICA', orden: 2, grados: G_ALL },
  { id: 3, bloque: 'extra', nombre: 'EDU. FINANCIERA', orden: 3, grados: G_ALL },
  // prim_habilidades
  { id: 1, bloque: 'habilidades', nombre: 'AUTOCONTROL', orden: 1, grados: G_ALL },
  { id: 2, bloque: 'habilidades', nombre: 'ESCUCHA ATENTAMENTE', orden: 2, grados: G_ALL },
  { id: 3, bloque: 'habilidades', nombre: 'SIGUE INSTRUCCIONES', orden: 3, grados: G_ALL },
  {
    id: 4,
    bloque: 'habilidades',
    nombre: 'TRABAJA CON BUENA PRESENTACIÓN Y LIMPIEZA',
    orden: 4,
    grados: G_ALL,
  },
  { id: 5, bloque: 'habilidades', nombre: 'MUESTRA ACTITUD POSITIVA', orden: 5, grados: G_ALL },
  { id: 6, bloque: 'habilidades', nombre: 'APRENDIZAJE COLABORATIVO', orden: 6, grados: G_ALL },
]

/** Clave estable para forms/API: bloque:id */
export function claveMateria(bloque: PrimariaEsBloque, id: number): string {
  return `${bloque}:${id}`
}

export function parseClaveMateria(
  clave: string
): { bloque: PrimariaEsBloque; id: number } | null {
  const [bloque, idRaw] = clave.split(':')
  const id = Number(idRaw)
  if (!bloque || !id) return null
  const ok: PrimariaEsBloque[] = [
    'lenguajes',
    'saberes',
    'humano',
    'etica',
    'extra',
    'habilidades',
  ]
  if (!ok.includes(bloque as PrimariaEsBloque)) return null
  return { bloque: bloque as PrimariaEsBloque, id }
}

export function materiasPorGrado(grado: PrimariaEsGrado): PrimariaEsMateria[] {
  return PRIMARIA_ES_MATERIAS.filter((m) => m.grados.includes(grado))
}

export function materiasPorGradoYBloque(
  grado: PrimariaEsGrado,
  bloque: PrimariaEsBloque
): PrimariaEsMateria[] {
  return materiasPorGrado(grado).filter((m) => m.bloque === bloque)
}

export function plantillaPdfPorGrado(grado: PrimariaEsGrado): 'boleta1.jpg' | 'boleta3.jpg' | 'boleta4.jpg' {
  if (grado < 3) return 'boleta1.jpg'
  if (grado === 3) return 'boleta3.jpg'
  return 'boleta4.jpg'
}

export function grupoNumeroDesdeLetra(letra: string): number {
  const map: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 }
  return map[letra.toUpperCase()] ?? 0
}

export function letraDesdeGrupoNumero(n: number): string {
  return ({ 1: 'A', 2: 'B', 3: 'C', 4: 'D' } as Record<number, string>)[n] ?? String(n)
}

/** Maestras Español por grado/grupo (legacy maestras_boleta_primaria.php). */
export function maestraEspanolPrimaria(grado: number, grupoNum: number): string {
  const map: Record<string, string> = {
    '1_1': 'INGRAM MARTINEZ MARIA BELEN',
    '1_2': 'INGRAM MARTINEZ MARIA BELEN',
    '2_1': 'DIAZ ESPINOSA LETICIA FARIDE',
    '2_2': 'DIAZ ESPINOSA LETICIA FARIDE',
    '2_3': 'ANGELES ZAYAS BEATRIZ ZOE',
    '3_1': 'BLANCO HERNANDEZ CHRISTIAN OLYMPIA',
    '3_2': 'BLANCO HERNANDEZ CHRISTIAN OLYMPIA',
    '4_1': 'REYES CARRASCO TANIA SINAITH',
    '4_2': 'REYES CARRASCO TANIA SINAITH',
    '4_3': 'SILVA RESENDIZ ROMANA ABIGAIL',
    '5_1': 'ANDRADE GUILLEN MARIA ELENA',
    '5_2': 'ANDRADE GUILLEN MARIA ELENA',
    '5_3': 'HERNANDEZ BARON QUETZALLI AMERICA',
    '6_1': 'CASTILLO RODRIGUEZ MARIA CRISTINA',
    '6_2': 'CASTILLO RODRIGUEZ MARIA CRISTINA',
    '6_3': 'SOLIS CHAVARRIA GLORIA LUZ',
  }
  return map[`${grado}_${grupoNum}`] ?? ''
}
