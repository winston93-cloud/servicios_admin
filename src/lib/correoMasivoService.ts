import { BECA_ESTATUS_ACTIVA } from './becaEstatus'
import { construirNombreCompleto, grupoALetra } from './alumnoBusquedaServicios'
import { etiquetaGradoEscolar, gradoOpcionesPorNivel } from './gradoEscolar'
import { etiquetaNivelEscolar, NIVELES_ESCOLARES_OPCIONES } from './nivelEscolar'
import { supabase } from './supabase'

export type FiltroAdicionalCorreo =
  | 'sin-filtro'
  | 'becados'
  | 'nuevo-ingreso'
  | 'reinscritos'

export interface FiltrosCorreoMasivo {
  cicloEscolar: number
  nivel: number | null
  grado: number | null
  grupo: number | null
  filtroAdicional: FiltroAdicionalCorreo
}

export type EstadoEnvioCorreo =
  | 'pendiente'
  | 'enviado'
  | 'recibido'
  | 'error'
  | 'sin-correo'

export interface DestinatarioCorreoMasivo {
  alumno_id: number
  alumno_ref: string
  nombre_completo: string
  nivel: number
  grado: number
  grupo: number
  grupo_letra: string
  emails: string[]
  estado: EstadoEnvioCorreo
  mensaje_estado: string
  /** Solo con filtro «Becados». */
  beca_tipo?: string | null
  beca_porcentaje?: number | null
}

export interface GrupoDestinatariosCorreo {
  clave: string
  nivel: number
  grado: number
  grupo: number
  etiqueta_nivel: string
  etiqueta_grado: string
  etiqueta_grupo: string
  destinatarios: DestinatarioCorreoMasivo[]
}

const SELECT_ALUMNO =
  'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_nuevo_ingreso'

const PAGE_SIZE = 1000

export const FILTROS_ADICIONALES_OPCIONES: {
  valor: FiltroAdicionalCorreo
  etiqueta: string
}[] = [
  { valor: 'sin-filtro', etiqueta: 'Sin filtro adicional' },
  { valor: 'becados', etiqueta: 'Becados' },
  { valor: 'nuevo-ingreso', etiqueta: 'Nuevo ingreso' },
  { valor: 'reinscritos', etiqueta: 'Reinscritos' },
]

export function gruposOpcionesPorNivel(nivel: number | null): { valor: number; etiqueta: string }[] {
  if (nivel === 1 || nivel === 2) {
    return [
      { valor: 1, etiqueta: 'A' },
      { valor: 2, etiqueta: 'B' },
    ]
  }
  if (nivel === 3 || nivel === 4) {
    return [
      { valor: 1, etiqueta: 'A' },
      { valor: 2, etiqueta: 'B' },
      { valor: 3, etiqueta: 'C' },
      { valor: 4, etiqueta: 'D' },
    ]
  }
  return [
    { valor: 1, etiqueta: 'A' },
    { valor: 2, etiqueta: 'B' },
    { valor: 3, etiqueta: 'C' },
    { valor: 4, etiqueta: 'D' },
  ]
}

function parseNum(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0
  const n = typeof v === 'number' ? v : parseInt(String(v), 10)
  return Number.isNaN(n) ? 0 : n
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

async function mapaConceptosBeca(): Promise<Map<number, string>> {
  const mapa = new Map<number, string>()
  const { data, error } = await supabase.from('concepto_beca').select('beca_id, beca_clase')
  if (error) {
    console.error('Error conceptos beca correo masivo:', error)
    return mapa
  }
  for (const row of data ?? []) {
    mapa.set(Number(row.beca_id), String(row.beca_clase ?? '').trim() || `Beca ${row.beca_id}`)
  }
  return mapa
}

type BecaCorreoInfo = { beca_id: number; porcentaje: number }

/** Becas activas del ciclo → alumno_id (si hay varias, se queda la de mayor %). */
async function mapaBecasActivasCiclo(ciclo: number): Promise<Map<number, BecaCorreoInfo>> {
  const mapa = new Map<number, BecaCorreoInfo>()
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('alumno_beca')
      .select('alumno_id, beca_id, beca_porcentaje')
      .eq('beca_ciclo_escolar', ciclo)
      .eq('beca_estatus', BECA_ESTATUS_ACTIVA)
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('Error becas correo masivo:', error)
      break
    }
    const filas = data ?? []
    for (const f of filas) {
      const alumnoId = Number(f.alumno_id)
      const info: BecaCorreoInfo = {
        beca_id: Number(f.beca_id),
        porcentaje: Number(f.beca_porcentaje) || 0,
      }
      const prev = mapa.get(alumnoId)
      if (!prev || info.porcentaje > prev.porcentaje) {
        mapa.set(alumnoId, info)
      }
    }
    if (filas.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return mapa
}

/**
 * Becas quedan ligadas al ciclo de la beca; tras el avance de temporada la ficha
 * del alumno ya está en el ciclo vigente (mismo alumno_id). No exigir
 * alumno_ciclo_escolar = beca_ciclo_escolar.
 */
async function listarAlumnosBecados(
  filtros: FiltrosCorreoMasivo
): Promise<DestinatarioCorreoMasivo[]> {
  const [becasMap, conceptos] = await Promise.all([
    mapaBecasActivasCiclo(filtros.cicloEscolar),
    mapaConceptosBeca(),
  ])
  const becadosIds = [...becasMap.keys()]
  if (!becadosIds.length) return []

  const alumnos: {
    alumno_id: number
    alumno_ref: string
    alumno_nombre: string
    alumno_app: string
    alumno_apm: string
    alumno_nivel: number
    alumno_grado: string | number
    alumno_grupo: string | number
    alumno_nuevo_ingreso: number
  }[] = []

  const CHUNK = 150
  for (let i = 0; i < becadosIds.length; i += CHUNK) {
    const slice = becadosIds.slice(i, i + CHUNK)
    let q = supabase
      .from('alumno')
      .select(SELECT_ALUMNO)
      .in('alumno_id', slice)
      .eq('alumno_status', 1)

    if (filtros.nivel != null && filtros.nivel > 0) {
      q = q.eq('alumno_nivel', filtros.nivel)
    }
    if (filtros.grado != null && filtros.grado > 0) {
      q = q.eq('alumno_grado', filtros.grado)
    }
    if (filtros.grupo != null && filtros.grupo > 0) {
      q = q.eq('alumno_grupo', filtros.grupo)
    }

    const { data, error } = await q
    if (error) {
      console.error('Error alumnos becados correo masivo:', error)
      continue
    }
    for (const f of data ?? []) {
      alumnos.push(f as (typeof alumnos)[0])
    }
  }

  alumnos.sort((a, b) => {
    const na = parseNum(a.alumno_nivel)
    const nb = parseNum(b.alumno_nivel)
    if (na !== nb) return na - nb
    const ga = parseNum(a.alumno_grado)
    const gb = parseNum(b.alumno_grado)
    if (ga !== gb) return ga - gb
    const gra = parseNum(a.alumno_grupo)
    const grb = parseNum(b.alumno_grupo)
    if (gra !== grb) return gra - grb
    return construirNombreCompleto(
      a.alumno_nombre ?? '',
      a.alumno_app ?? '',
      a.alumno_apm ?? ''
    ).localeCompare(
      construirNombreCompleto(
        b.alumno_nombre ?? '',
        b.alumno_app ?? '',
        b.alumno_apm ?? ''
      ),
      'es'
    )
  })

  const lista = await mapearDestinatarios(alumnos)
  return lista.map((d) => {
    const beca = becasMap.get(d.alumno_id)
    if (!beca) return d
    return {
      ...d,
      beca_tipo: conceptos.get(beca.beca_id) ?? `Beca ${beca.beca_id}`,
      beca_porcentaje: beca.porcentaje,
    }
  })
}

async function cargarEmailsPorAlumno(alumnoIds: number[]): Promise<Map<number, string[]>> {
  const mapa = new Map<number, string[]>()
  if (!alumnoIds.length) return mapa

  const CHUNK = 150
  for (let i = 0; i < alumnoIds.length; i += CHUNK) {
    const slice = alumnoIds.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('alumno_familiar')
      .select('alumno_id, familiar_email, familiar_recibir_email')
      .in('alumno_id', slice)
      .eq('familiar_recibir_email', 1)

    if (error) {
      console.error('Error familiares correo masivo:', error)
      continue
    }

    for (const row of data ?? []) {
      const email = String(row.familiar_email ?? '').trim()
      if (!emailValido(email)) continue
      const prev = mapa.get(row.alumno_id) ?? []
      if (!prev.includes(email)) prev.push(email)
      mapa.set(row.alumno_id, prev)
    }
  }

  return mapa
}

async function mapearDestinatarios(
  alumnos: {
    alumno_id: number
    alumno_ref: string
    alumno_nombre: string
    alumno_app: string
    alumno_apm: string
    alumno_nivel: number
    alumno_grado: string | number
    alumno_grupo: string | number
  }[]
): Promise<DestinatarioCorreoMasivo[]> {
  const emailsMap = await cargarEmailsPorAlumno(alumnos.map((a) => a.alumno_id))

  return alumnos.map((a) => {
    const nivel = parseNum(a.alumno_nivel)
    const grado = parseNum(a.alumno_grado)
    const grupo = parseNum(a.alumno_grupo)
    const emails = emailsMap.get(a.alumno_id) ?? []
    const estado: EstadoEnvioCorreo = emails.length ? 'pendiente' : 'sin-correo'
    const mensaje_estado =
      emails.length > 0
        ? `${emails.length} correo(s) listo(s)`
        : 'Sin correo autorizado (padre/madre)'

    return {
      alumno_id: a.alumno_id,
      alumno_ref: String(a.alumno_ref ?? ''),
      nombre_completo: construirNombreCompleto(
        a.alumno_nombre ?? '',
        a.alumno_app ?? '',
        a.alumno_apm ?? ''
      ),
      nivel,
      grado,
      grupo,
      grupo_letra: grupoALetra(grupo) ?? '—',
      emails,
      estado,
      mensaje_estado,
    }
  })
}

/** Un o varios alumnos por id (envío individual / lookup directo). */
export async function obtenerDestinatariosPorAlumnoIds(
  alumnoIds: number[]
): Promise<DestinatarioCorreoMasivo[]> {
  const ids = [...new Set(alumnoIds.map((id) => Number(id)).filter((id) => id > 0))]
  if (!ids.length) return []

  const alumnos: {
    alumno_id: number
    alumno_ref: string
    alumno_nombre: string
    alumno_app: string
    alumno_apm: string
    alumno_nivel: number
    alumno_grado: string | number
    alumno_grupo: string | number
  }[] = []

  const CHUNK = 80
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const { data, error } = await supabase.from('alumno').select(SELECT_ALUMNO).in('alumno_id', slice)
    if (error) {
      console.error('Error alumnos por id correo masivo:', error)
      continue
    }
    for (const f of data ?? []) {
      alumnos.push(f as (typeof alumnos)[0])
    }
  }

  const orden = new Map(ids.map((id, idx) => [id, idx]))
  alumnos.sort(
    (a, b) => (orden.get(a.alumno_id) ?? 0) - (orden.get(b.alumno_id) ?? 0)
  )
  return mapearDestinatarios(alumnos)
}

export async function listarDestinatariosCorreoMasivo(
  filtros: FiltrosCorreoMasivo
): Promise<DestinatarioCorreoMasivo[]> {
  if (filtros.filtroAdicional === 'becados') {
    return listarAlumnosBecados(filtros)
  }

  const alumnos: {
    alumno_id: number
    alumno_ref: string
    alumno_nombre: string
    alumno_app: string
    alumno_apm: string
    alumno_nivel: number
    alumno_grado: string | number
    alumno_grupo: string | number
    alumno_nuevo_ingreso: number
  }[] = []

  let from = 0
  while (true) {
    let q = supabase
      .from('alumno')
      .select(SELECT_ALUMNO)
      .eq('alumno_ciclo_escolar', filtros.cicloEscolar)
      .eq('alumno_status', 1)

    if (filtros.nivel != null && filtros.nivel > 0) {
      q = q.eq('alumno_nivel', filtros.nivel)
    }
    if (filtros.grado != null && filtros.grado > 0) {
      q = q.eq('alumno_grado', filtros.grado)
    }
    if (filtros.grupo != null && filtros.grupo > 0) {
      q = q.eq('alumno_grupo', filtros.grupo)
    }

    if (filtros.filtroAdicional === 'nuevo-ingreso') {
      q = q.eq('alumno_nuevo_ingreso', 1)
    } else if (filtros.filtroAdicional === 'reinscritos') {
      q = q.eq('alumno_nuevo_ingreso', 0)
    }

    const { data, error } = await q
      .order('alumno_nivel', { ascending: true })
      .order('alumno_grado', { ascending: true })
      .order('alumno_grupo', { ascending: true })
      .order('alumno_nombre', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('Error alumnos correo masivo:', error)
      break
    }

    const filas = data ?? []
    for (const f of filas) {
      alumnos.push(f as (typeof alumnos)[0])
    }

    if (filas.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return mapearDestinatarios(alumnos)
}

export function agruparDestinatariosPorSeccion(
  lista: DestinatarioCorreoMasivo[]
): GrupoDestinatariosCorreo[] {
  const mapa = new Map<string, GrupoDestinatariosCorreo>()

  for (const d of lista) {
    const clave = `${d.nivel}|${d.grado}|${d.grupo}`
    let g = mapa.get(clave)
    if (!g) {
      g = {
        clave,
        nivel: d.nivel,
        grado: d.grado,
        grupo: d.grupo,
        etiqueta_nivel: etiquetaNivelEscolar(d.nivel) || `Nivel ${d.nivel}`,
        etiqueta_grado: etiquetaGradoEscolar(d.nivel, d.grado) || String(d.grado),
        etiqueta_grupo: d.grupo_letra,
        destinatarios: [],
      }
      mapa.set(clave, g)
    }
    g.destinatarios.push(d)
  }

  return [...mapa.values()].sort((a, b) => {
    if (a.nivel !== b.nivel) return a.nivel - b.nivel
    if (a.grado !== b.grado) return a.grado - b.grado
    return a.grupo - b.grupo
  })
}

export function resumenDestinatarios(lista: DestinatarioCorreoMasivo[]) {
  const conCorreo = lista.filter((d) => d.emails.length > 0).length
  return {
    total: lista.length,
    conCorreo,
    sinCorreo: lista.length - conCorreo,
  }
}

export function etiquetaEstadoEnvio(estado: EstadoEnvioCorreo): string {
  switch (estado) {
    case 'pendiente':
      return 'Pendiente'
    case 'enviado':
      return 'Enviado'
    case 'recibido':
      return 'Recibido'
    case 'error':
      return 'Error'
    case 'sin-correo':
      return 'Sin correo'
    default:
      return estado
  }
}

export function claseEstadoEnvio(estado: EstadoEnvioCorreo): string {
  return `cm-estado cm-estado--${estado}`
}

/** Niveles para el select (placeholder + opciones). */
export const NIVEL_CORREO_OPCIONES = [
  { valor: 0, etiqueta: 'Todos los niveles' },
  ...NIVELES_ESCOLARES_OPCIONES.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta })),
]

export const GRADO_TODOS = 0
export const GRUPO_TODOS = 0

export function gradoCorreoOpciones(nivel: number | null) {
  if (!nivel || nivel === 0) {
    return [{ valor: 0, etiqueta: 'Todos (elija nivel para filtrar)' }]
  }
  return [
    { valor: 0, etiqueta: 'Todos los grados' },
    ...gradoOpcionesPorNivel(nivel).map((g) => ({
      valor: g.valor,
      etiqueta: g.etiqueta,
    })),
  ]
}
