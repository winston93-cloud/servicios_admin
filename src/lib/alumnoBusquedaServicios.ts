import { supabase } from './supabase'

const CANDIDATOS_POR_CONSULTA = 80
const RESULTADOS_MAX = 15
const MIN_CARACTERES = 2

export type CampoBusquedaAlumno = 'nombre' | 'app' | 'apm' | 'ref'

export interface AlumnoBusquedaRow {
  alumno_id: number
  alumno_ref: string
  alumno_nombre: string
  alumno_app: string
  alumno_apm: string
  alumno_nivel: number
  alumno_grado?: string | null
  alumno_grupo?: string | null
  alumno_ciclo_escolar?: string | number | null
}

function cicloNumerico(ciclo: string | number | null | undefined): number {
  if (ciclo == null || ciclo === '') return 0
  const n = typeof ciclo === 'number' ? ciclo : parseInt(String(ciclo), 10)
  return Number.isNaN(n) ? 0 : n
}

function fusionarCandidato(
  mapa: Map<number, AlumnoBusquedaRow>,
  refIndex: Map<string, number>,
  fila: AlumnoBusquedaRow
) {
  const ref = String(fila.alumno_ref ?? '').trim()
  const prevId = refIndex.get(ref)
  if (prevId !== undefined) {
    const prev = mapa.get(prevId)
    if (prev && cicloNumerico(fila.alumno_ciclo_escolar) <= cicloNumerico(prev.alumno_ciclo_escolar)) {
      return
    }
    mapa.delete(prevId)
  }
  mapa.set(fila.alumno_id, fila)
  if (ref) refIndex.set(ref, fila.alumno_id)
}

export interface AlumnoBusquedaResultado extends AlumnoBusquedaRow {
  nombre_completo: string
  puntuacion: number
  campos_coincidentes: CampoBusquedaAlumno[]
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

/** Grupo numérico en BD → letra (1 = A, 2 = B, 3 = C, …). */
export function grupoALetra(grupo: string | number | null | undefined): string | null {
  if (grupo == null || grupo === '') return null
  const n = typeof grupo === 'string' ? parseInt(grupo, 10) : grupo
  if (Number.isNaN(n)) return String(grupo)
  if (n >= 1 && n <= 26) return String.fromCharCode(64 + n)
  return String(n)
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

function puntuarCampoRef(termino: string, ref: string): number {
  const q = termino.replace(/\s/g, '')
  const r = String(ref ?? '').trim()
  if (!q || !r) return 0
  if (r === q) return 1150
  if (r.startsWith(q)) return 980
  if (r.includes(q)) return 85
  return puntuarCampo(termino, r)
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
): { puntuacion: number; campos: CampoBusquedaAlumno[] } {
  const tokens = tokensDeConsulta(consulta)
  const qCompleta = normalizar(consulta)
  const qRef = consulta.replace(/\s/g, '')
  const nombre = alumno.alumno_nombre ?? ''
  const app = alumno.alumno_app ?? ''
  const apm = alumno.alumno_apm ?? ''
  const ref = String(alumno.alumno_ref ?? '').trim()
  const completo = normalizar(construirNombreCompleto(nombre, app, apm))
  const campos: CampoBusquedaAlumno[] = []
  let puntuacion = 0

  const ptsRef = puntuarCampoRef(qRef, ref)
  if (ptsRef > 0) {
    puntuacion += ptsRef
    campos.push('ref')
  }

  if (completo === qCompleta) puntuacion += 1200
  else if (completo.startsWith(qCompleta)) puntuacion += 620
  else if (completo.includes(qCompleta)) puntuacion += 320

  const partes: { id: CampoBusquedaAlumno; valor: string }[] = [
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
      let mejor = Math.max(puntuarCampoRef(token.replace(/\s/g, ''), ref), 0)
      for (const { valor } of partes) {
        mejor = Math.max(mejor, puntuarCampo(token, valor))
      }
      if (mejor === 0) todosLosTokens = false
      else bonusTokens += mejor
    }
    puntuacion += todosLosTokens ? bonusTokens + 180 : Math.round(bonusTokens * 0.45)
  } else if (tokens.length === 1) {
    const token = tokens[0]
    const ptsRefToken = puntuarCampoRef(token.replace(/\s/g, ''), ref)
    if (ptsRefToken > 0 && !campos.includes('ref')) campos.push('ref')
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
  const refExacta = termino.trim()
  const orParts = [
    `alumno_nombre.ilike.${patron}`,
    `alumno_app.ilike.${patron}`,
    `alumno_apm.ilike.${patron}`,
  ]
  if (/^\d+$/.test(refExacta)) {
    orParts.push(`alumno_ref.eq.${refExacta}`)
  }
  const or = orParts.join(',')

  let query = supabase
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_ciclo_escolar'
    )
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
 * Búsqueda por nombre, apellidos o número de control (alumno_ref).
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
  const refIndex = new Map<string, number>()
  const terminosValidos = [...terminosBusqueda].filter((t) => t.length >= MIN_CARACTERES)

  const lotes = await Promise.all(
    terminosValidos.map((termino) => consultarCandidatos(termino, signal))
  )
  for (const filas of lotes) {
    for (const fila of filas) {
      fusionarCandidato(mapa, refIndex, fila)
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
