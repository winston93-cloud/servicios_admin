import { supabase } from './supabase'

const CICLO_ESCOLAR = '22'
const CANDIDATOS_POR_CONSULTA = 80
const RESULTADOS_MAX = 15
const MIN_CARACTERES = 2

export type CampoNombreAlumno = 'nombre' | 'app' | 'apm'

export interface AlumnoBusquedaRow {
  alumno_id: number
  alumno_ref: string
  alumno_nombre: string
  alumno_app: string
  alumno_apm: string
  alumno_nivel: number
  alumno_grado?: string | null
  alumno_grupo?: string | null
}

export interface AlumnoBusquedaResultado extends AlumnoBusquedaRow {
  nombre_completo: string
  puntuacion: number
  campos_coincidentes: CampoNombreAlumno[]
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escaparIlike(termino: string): string {
  return termino.replace(/[%_\\]/g, '\\$&')
}

function tokensDeConsulta(consulta: string): string[] {
  return normalizar(consulta)
    .split(' ')
    .filter((t) => t.length >= 1)
}

export function construirNombreCompleto(
  nombre: string,
  app: string,
  apm: string
): string {
  return [nombre, app, apm].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

/** Distancia de edición para tolerar errores de tipeo. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const fila = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j]
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, prev + costo)
      prev = temp
    }
  }
  return fila[b.length]
}

function puntuarCampo(termino: string, valor: string): number {
  const q = normalizar(termino)
  const f = normalizar(valor)
  if (!q || !f) return 0
  if (f === q) return 100
  if (f.startsWith(q)) return 88
  if (f.includes(q)) return 62

  if (q.length >= 3 && f.length >= q.length - 1) {
    const ventana = f.slice(0, Math.min(f.length, q.length + 3))
    const dist = levenshtein(q, ventana)
    const similitud = 1 - dist / Math.max(q.length, ventana.length)
    if (similitud >= 0.72) return Math.round(45 * similitud)
  }
  return 0
}

function puntuarAlumno(
  alumno: AlumnoBusquedaRow,
  consulta: string
): { puntuacion: number; campos: CampoNombreAlumno[] } {
  const tokens = tokensDeConsulta(consulta)
  const qCompleta = normalizar(consulta)
  const nombre = alumno.alumno_nombre ?? ''
  const app = alumno.alumno_app ?? ''
  const apm = alumno.alumno_apm ?? ''
  const completo = normalizar(construirNombreCompleto(nombre, app, apm))
  const campos: CampoNombreAlumno[] = []
  let puntuacion = 0

  if (completo === qCompleta) puntuacion += 1200
  else if (completo.startsWith(qCompleta)) puntuacion += 620
  else if (completo.includes(qCompleta)) puntuacion += 320

  const partes: { id: CampoNombreAlumno; valor: string }[] = [
    { id: 'nombre', valor: nombre },
    { id: 'app', valor: app },
    { id: 'apm', valor: apm },
  ]

  for (const { id, valor } of partes) {
    const pts = puntuarCampo(qCompleta, valor)
    if (pts > 0) {
      puntuacion += pts
      if (!campos.includes(id)) campos.push(id)
    }
  }

  if (tokens.length >= 2) {
    let todosLosTokens = true
    let bonusTokens = 0
    for (const token of tokens) {
      let mejor = 0
      for (const { valor } of partes) {
        mejor = Math.max(mejor, puntuarCampo(token, valor))
      }
      if (mejor === 0) todosLosTokens = false
      else bonusTokens += mejor
    }
    puntuacion += todosLosTokens ? bonusTokens + 180 : Math.round(bonusTokens * 0.45)
  } else if (tokens.length === 1) {
    const token = tokens[0]
    for (const { id, valor } of partes) {
      const pts = puntuarCampo(token, valor)
      if (pts > 0 && !campos.includes(id)) campos.push(id)
    }
  }

  const [t1, t2] = tokens
  if (tokens.length === 2) {
    const apellidos = `${normalizar(app)} ${normalizar(apm)}`
    if (
      (apellidos.includes(t1) && normalizar(nombre).includes(t2)) ||
      (apellidos.includes(t2) && normalizar(nombre).includes(t1))
    ) {
      puntuacion += 95
    }
  }

  return { puntuacion, campos }
}

async function consultarCandidatos(
  termino: string,
  signal?: AbortSignal
): Promise<AlumnoBusquedaRow[]> {
  const esc = escaparIlike(termino)
  const patron = `%${esc}%`
  const or = [
    `alumno_nombre.ilike.${patron}`,
    `alumno_app.ilike.${patron}`,
    `alumno_apm.ilike.${patron}`,
  ].join(',')

  let query = supabase
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo'
    )
    .eq('alumno_ciclo_escolar', CICLO_ESCOLAR)
    .eq('alumno_status', 1)
    .or(or)
    .limit(CANDIDATOS_POR_CONSULTA)

  if (signal) {
    query = query.abortSignal(signal)
  }

  const { data, error } = await query
  if (error) {
    if (error.name === 'AbortError') throw error
    console.error('Error buscando alumnos:', error)
    return []
  }
  return (data ?? []) as AlumnoBusquedaRow[]
}

/**
 * Búsqueda por nombre, apellido paterno o apellido materno.
 * Devuelve hasta 15 coincidencias ordenadas por relevancia.
 */
export async function buscarAlumnosServicios(
  consulta: string,
  signal?: AbortSignal
): Promise<AlumnoBusquedaResultado[]> {
  const limpia = consulta.replace(/\s+/g, ' ').trim()
  if (limpia.length < MIN_CARACTERES) return []

  const tokens = tokensDeConsulta(limpia)
  const terminosBusqueda = new Set<string>([limpia, ...tokens])

  const mapa = new Map<number, AlumnoBusquedaRow>()
  const terminosValidos = [...terminosBusqueda].filter((t) => t.length >= MIN_CARACTERES)

  const lotes = await Promise.all(
    terminosValidos.map((termino) => consultarCandidatos(termino, signal))
  )
  for (const filas of lotes) {
    for (const fila of filas) {
      mapa.set(fila.alumno_id, fila)
    }
  }

  const rankeados = Array.from(mapa.values())
    .map((alumno) => {
      const { puntuacion, campos } = puntuarAlumno(alumno, limpia)
      return {
        ...alumno,
        nombre_completo: construirNombreCompleto(
          alumno.alumno_nombre,
          alumno.alumno_app,
          alumno.alumno_apm
        ),
        puntuacion,
        campos_coincidentes: campos,
      }
    })
    .filter((r) => r.puntuacion > 0)
    .sort((a, b) => {
      if (b.puntuacion !== a.puntuacion) return b.puntuacion - a.puntuacion
      return a.nombre_completo.localeCompare(b.nombre_completo, 'es')
    })

  return rankeados.slice(0, RESULTADOS_MAX)
}

export { MIN_CARACTERES, RESULTADOS_MAX }
