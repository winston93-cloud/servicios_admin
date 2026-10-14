import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_PRIMARIA,
  PRIMARIA_ESCALA,
  PRIMARIA_SECCIONES,
  esGradoPrimaria,
  grupoNumeroDesdeLetra,
  letraDesdeGrupoNumero,
  normalizarCalificacionPrimaria,
  normalizarEscalaPrimaria,
  type IdiomaPrimaria,
  type PrimariaGrado,
  type PrimariaSeccion,
} from './boletasPrimariaCatalog'

export * from './boletasPrimariaCatalog'

/** Primaria (nivel 3): alumnos, catálogo de materias por idioma y calificaciones (servidor). */

// ── Alumnos ────────────────────────────────────────────────────────────────

const STATUS_ACTIVOS = [1, 4, 5] as const

const COLS_ALUMNO =
  'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel, alumno_status'

export type PrimariaAlumno = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  app: string
  apm: string
  nombres: string
  alumno_grado: number
  alumno_grupo: number
  grupo_letra: string
  grado_ui: PrimariaGrado
}

function txt(v: unknown): string {
  return String(v ?? '').trim()
}

function mapAlumno(a: Record<string, unknown>): PrimariaAlumno {
  const grado = Number(a.alumno_grado)
  if (!esGradoPrimaria(grado)) throw new Error('Grado de primaria inválido.')
  const g = Number(a.alumno_grupo)
  const app = txt(a.alumno_app)
  const apm = txt(a.alumno_apm)
  const nombres = txt(a.alumno_nombre)
  return {
    alumno_id: Number(a.alumno_id),
    alumno_ref: a.alumno_ref != null ? Number(a.alumno_ref) : null,
    nombre: [app, apm, nombres].filter(Boolean).join(' '),
    app,
    apm,
    nombres,
    alumno_grado: grado,
    alumno_grupo: g,
    grupo_letra: letraDesdeGrupoNumero(g),
    grado_ui: grado,
  }
}

export function validarPeriodoPrimaria(bimestre: number, ciclo: number): void {
  if (!(bimestre >= 1 && bimestre <= 3)) throw new Error('Trimestre inválido (1–3)')
  if (!ciclo) throw new Error('Ciclo requerido')
}

export async function listarAlumnosPrimaria(input: {
  grado: number
  grupoLetra: string
  ciclo: number
}): Promise<PrimariaAlumno[]> {
  const grado = Number(input.grado)
  if (!esGradoPrimaria(grado)) throw new Error('Grado inválido (1° a 6°)')
  const grupoNum = grupoNumeroDesdeLetra(input.grupoLetra)
  if (!grupoNum) throw new Error('Grupo inválido (A–C)')
  const ciclo = Number(input.ciclo)
  if (!ciclo) throw new Error('Ciclo requerido')
  const { data, error } = await createBoletasDb()
    .from('alumno')
    .select(COLS_ALUMNO)
    .eq('alumno_nivel', BOLETAS_NIVEL_PRIMARIA)
    .eq('alumno_grado', grado)
    .eq('alumno_grupo', grupoNum)
    .eq('alumno_ciclo_escolar', ciclo)
    .in('alumno_status', [...STATUS_ACTIVOS])
    .order('alumno_app')
    .order('alumno_apm')
    .order('alumno_nombre')
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapAlumno)
}

/** Grupos de 1° a 6° con alumnos activos en el ciclo. */
export async function gruposConAlumnosPrimaria(
  ciclo: number
): Promise<{ grado: PrimariaGrado; grupo: string; alumnos: number }[]> {
  const { data, error } = await createBoletasDb()
    .from('alumno')
    .select('alumno_grado, alumno_grupo')
    .eq('alumno_ciclo_escolar', ciclo)
    .eq('alumno_nivel', BOLETAS_NIVEL_PRIMARIA)
    .in('alumno_status', [...STATUS_ACTIVOS])
    .limit(3000)
  if (error) throw new Error(error.message)
  const conteo = new Map<string, { grado: PrimariaGrado; grupo: string; alumnos: number }>()
  for (const a of data ?? []) {
    const grado = Number(a.alumno_grado)
    const grupo = letraDesdeGrupoNumero(Number(a.alumno_grupo))
    if (!esGradoPrimaria(grado) || !grupoNumeroDesdeLetra(grupo)) continue
    const k = `${grado}-${grupo}`
    const prev = conteo.get(k)
    if (prev) prev.alumnos++
    else conteo.set(k, { grado, grupo, alumnos: 1 })
  }
  return [...conteo.values()].sort((a, b) => a.grado - b.grado || a.grupo.localeCompare(b.grupo))
}

export async function cargarAlumnoPrimaria(alumnoId: number): Promise<PrimariaAlumno> {
  const { data, error } = await createBoletasDb()
    .from('alumno')
    .select(COLS_ALUMNO)
    .eq('alumno_id', alumnoId)
    .limit(1)
  if (error) throw new Error(error.message)
  const a = data?.[0] as Record<string, unknown> | undefined
  if (!a) throw new Error('Alumno no encontrado')
  if (Number(a.alumno_nivel) !== BOLETAS_NIVEL_PRIMARIA) throw new Error('El alumno no es de primaria')
  return mapAlumno(a)
}

// ── Catálogo de materias (editable por la directora) ───────────────────────

const TABLA_MATERIAS = 'boleta_primaria_materia'

export const TABLA_CALIF_PRIMARIA: Record<IdiomaPrimaria, string> = {
  es: 'boleta_calificacion_primaria_es',
  en: 'boleta_calificacion_primaria_en',
}

export type PrimariaMateria = {
  id: number
  grado: PrimariaGrado
  seccion: string
  nombre: string
  nombreAlt: string
  orden: number
  enPromedio: boolean
  semaforo: boolean
  activo: boolean
}

const COLS_MATERIA = 'grado, materia_id, seccion, nombre, nombre_alt, orden, en_promedio, semaforo, activo'

function mapMateria(r: Record<string, unknown>): PrimariaMateria {
  return {
    id: Number(r.materia_id),
    grado: Number(r.grado) as PrimariaGrado,
    seccion: String(r.seccion ?? ''),
    nombre: String(r.nombre ?? ''),
    nombreAlt: String(r.nombre_alt ?? ''),
    orden: Number(r.orden ?? 0),
    enPromedio: Boolean(r.en_promedio),
    semaforo: Boolean(r.semaforo),
    activo: Boolean(r.activo),
  }
}

export function seccionPrimaria(idioma: IdiomaPrimaria, id: string): PrimariaSeccion | undefined {
  return PRIMARIA_SECCIONES[idioma].find((s) => s.id === id)
}

export async function listarMateriasPrimaria(idioma: IdiomaPrimaria): Promise<PrimariaMateria[]> {
  const { data, error } = await createBoletasDb()
    .from(TABLA_MATERIAS)
    .select(COLS_MATERIA)
    .eq('idioma', idioma)
    .order('grado')
    .order('orden')
    .order('materia_id')
  if (error) throw new Error(`Catálogo de primaria: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapMateria)
}

/** Materias activas del grado, en el orden de las secciones y luego por `orden`. */
export async function materiasActivasPrimaria(idioma: IdiomaPrimaria, grado: PrimariaGrado): Promise<PrimariaMateria[]> {
  const { data, error } = await createBoletasDb()
    .from(TABLA_MATERIAS)
    .select(COLS_MATERIA)
    .eq('idioma', idioma)
    .eq('grado', grado)
    .eq('activo', true)
    .order('orden')
    .order('materia_id')
  if (error) throw new Error(`Catálogo de primaria: ${error.message}`)
  const posicion = new Map(PRIMARIA_SECCIONES[idioma].map((s, i) => [s.id, i]))
  return ((data ?? []) as Record<string, unknown>[])
    .map(mapMateria)
    .filter((m) => posicion.has(m.seccion))
    .sort((a, b) => (posicion.get(a.seccion) ?? 0) - (posicion.get(b.seccion) ?? 0) || a.orden - b.orden || a.id - b.id)
}

export async function guardarMateriaPrimaria(
  idioma: IdiomaPrimaria,
  input: {
    grado: unknown
    id?: unknown
    seccion: unknown
    nombre: unknown
    nombreAlt?: unknown
    orden?: unknown
    enPromedio?: unknown
    semaforo?: unknown
    activo?: unknown
  }
): Promise<PrimariaMateria> {
  const grado = Number(input.grado)
  if (!esGradoPrimaria(grado)) throw new Error('Grado inválido (1° a 6°).')
  const seccion = String(input.seccion ?? '')
  const sec = seccionPrimaria(idioma, seccion)
  if (!sec) throw new Error('Sección inválida.')
  const nombre = String(input.nombre ?? '').trim().replace(/\s+/g, ' ')
  const nombreAlt = String(input.nombreAlt ?? '').trim().replace(/\s+/g, ' ')
  if (!nombre) throw new Error('Escribe el nombre.')
  if (nombre.length > 120 || nombreAlt.length > 120) throw new Error('El nombre es muy largo (máximo 120).')
  const idPrevio = Number(input.id)
  const esNuevo = !(Number.isInteger(idPrevio) && idPrevio > 0)

  const db = createBoletasDb()
  let id = idPrevio
  if (esNuevo) {
    const { data, error } = await db
      .from(TABLA_MATERIAS)
      .select('materia_id')
      .eq('idioma', idioma)
      .order('materia_id', { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    id = Math.max(1000, Number((data?.[0] as Record<string, unknown> | undefined)?.materia_id ?? 0) + 1)
  } else {
    const { data } = await db
      .from(TABLA_MATERIAS)
      .select('grado')
      .eq('idioma', idioma)
      .eq('materia_id', idPrevio)
      .limit(1)
    if (Number((data?.[0] as Record<string, unknown> | undefined)?.grado) !== grado) {
      throw new Error('Esa materia ya no existe; recarga la página.')
    }
  }

  let orden = Number(input.orden)
  if (!(Number.isInteger(orden) && orden > 0)) {
    const { data } = await db
      .from(TABLA_MATERIAS)
      .select('orden')
      .eq('idioma', idioma)
      .eq('grado', grado)
      .order('orden', { ascending: false })
      .limit(1)
    orden = Number((data?.[0] as Record<string, unknown> | undefined)?.orden ?? 0) + 1
  }

  const fila = {
    idioma,
    grado,
    materia_id: id,
    seccion,
    nombre,
    nombre_alt: nombreAlt || null,
    orden: Math.min(orden, 999),
    en_promedio: sec.formato === 'decimal' && input.enPromedio !== false,
    semaforo: sec.formato === 'decimal' && input.semaforo === true,
    activo: input.activo !== false,
    updated_at: new Date().toISOString(),
  }
  const { error } = await db.from(TABLA_MATERIAS).upsert([fila], { onConflict: 'idioma,materia_id' })
  if (error) throw new Error(`Guardar materia: ${error.message}`)
  return mapMateria(fila)
}

/** Borra solo si nadie la ha calificado; si ya tiene calificaciones, hay que desactivarla. */
export async function eliminarMateriaPrimaria(
  idioma: IdiomaPrimaria,
  input: { grado: unknown; id: unknown }
): Promise<void> {
  const grado = Number(input.grado)
  const id = Number(input.id)
  if (!esGradoPrimaria(grado)) throw new Error('Grado inválido.')
  if (!Number.isInteger(id) || id <= 0) throw new Error('Materia inválida.')
  const db = createBoletasDb()
  const { data: usados, error: errUso } = await db
    .from(TABLA_CALIF_PRIMARIA[idioma])
    .select('alumno_id')
    .eq('materia_id', id)
    .neq('calificacion', '')
    .limit(1)
  if (errUso) throw new Error(errUso.message)
  if (usados?.length) throw new Error('Ya tiene calificaciones capturadas: desactívala en lugar de borrarla.')
  const { error } = await db.from(TABLA_MATERIAS).delete().eq('idioma', idioma).eq('grado', grado).eq('materia_id', id)
  if (error) throw new Error(`Borrar materia: ${error.message}`)
}

// ── Calificaciones ─────────────────────────────────────────────────────────

/** Calificaciones de un alumno por `${bimestre}-${materia_id}`. */
export async function mapaCalifsPrimaria(
  idioma: IdiomaPrimaria,
  alumnoId: number,
  ciclo: number,
  bimestres: number[],
  ids: number[]
): Promise<Map<string, string>> {
  if (!ids.length || !bimestres.length) return new Map()
  const { data, error } = await createBoletasDb()
    .from(TABLA_CALIF_PRIMARIA[idioma])
    .select('materia_id, bimestre, calificacion')
    .eq('alumno_id', alumnoId)
    .eq('ciclo', ciclo)
    .in('bimestre', bimestres)
    .in('materia_id', ids)
  if (error) throw new Error(error.message)
  return new Map(
    (data ?? []).map((r) => [`${Number(r.bimestre)}-${Number(r.materia_id)}`, String(r.calificacion ?? '')])
  )
}

/** Valida todo y luego escribe (para no dejar la boleta a medias). Devuelve cuántas guardó. */
export async function guardarCalifsPrimaria(input: {
  idioma: IdiomaPrimaria
  alumnoId: number
  bimestre: number
  ciclo: number
  materias: PrimariaMateria[]
  valores: Record<number, string>
}): Promise<number> {
  const { idioma, alumnoId, bimestre, ciclo } = input
  const porId = new Map(input.materias.map((m) => [m.id, m]))
  const ahora = new Date().toISOString()
  const filas: Record<string, unknown>[] = []
  for (const [rawId, rawVal] of Object.entries(input.valores ?? {})) {
    const m = porId.get(Number(rawId))
    if (!m) continue
    const escala = seccionPrimaria(idioma, m.seccion)?.formato === 'escala'
    const calificacion = escala ? normalizarEscalaPrimaria(idioma, rawVal) : normalizarCalificacionPrimaria(rawVal)
    if (calificacion == null) {
      throw new Error(
        escala
          ? `«${m.nombre}»: elige ${PRIMARIA_ESCALA[idioma].map((e) => e.letra).join(', ')}.`
          : `«${m.nombre}»: escribe una calificación de 5 a 10 (un decimal, ej. 9.5) o N/A.`
      )
    }
    filas.push({ alumno_id: alumnoId, materia_id: m.id, bimestre, ciclo, calificacion, updated_at: ahora })
  }
  if (!filas.length) return 0
  const { error } = await createBoletasDb()
    .from(TABLA_CALIF_PRIMARIA[idioma])
    .upsert(filas, { onConflict: 'alumno_id,materia_id,bimestre,ciclo' })
  if (error) throw new Error(error.message)
  return filas.length
}

/** Cuántas materias activas lleva cada alumno del mismo grado (N/A cuenta como capturada). */
export async function capturadasPorAlumnoPrimaria(
  idioma: IdiomaPrimaria,
  alumnoIds: number[],
  materias: PrimariaMateria[],
  bimestre: number,
  ciclo: number
): Promise<Map<number, number>> {
  const ids = new Set(materias.map((m) => m.id))
  const out = new Map<number, number>()
  if (!alumnoIds.length || !ids.size) return out
  const { data, error } = await createBoletasDb()
    .from(TABLA_CALIF_PRIMARIA[idioma])
    .select('alumno_id, materia_id')
    .in('alumno_id', alumnoIds)
    .eq('bimestre', bimestre)
    .eq('ciclo', ciclo)
    .neq('calificacion', '')
    .limit(10000)
  if (error) throw new Error(error.message)
  for (const r of data ?? []) {
    if (!ids.has(Number(r.materia_id))) continue
    const id = Number(r.alumno_id)
    out.set(id, (out.get(id) ?? 0) + 1)
  }
  return out
}
