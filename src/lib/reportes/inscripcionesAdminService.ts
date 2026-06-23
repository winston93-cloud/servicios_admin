import { createDbAdmin } from '@/lib/insforgeAdmin'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { parsearReferenciaPago } from '@/lib/pagoReferenciaColegiatura'
import { PAGE_ALUMNO } from './dbChunks'
import { fetchPagosPorAlumnos } from './fetchDb'
import { etiquetaCicloReporte } from './renderDocument'

type Celda = { nivel: number; grado: number }

function key(nivel: number, grado: number) {
  return `${nivel}:${grado}`
}

/** Etiqueta legacy del reporte PHP (una sola columna NIVEL). */
export function etiquetaNivelInscripciones(nivel: number, grado: number): string {
  if (nivel === 1) return grado === 1 ? 'Maternal A' : 'Maternal B'
  if (nivel === 2) return `Kinder-${grado}`
  if (nivel === 3) return `${grado}° Primaria`
  if (nivel === 4) return `${grado}° Secundaria`
  return etiquetaGradoEscolar(nivel, grado)
}

export type FilaInscripcionesAdmin = {
  nivelLabel: string
  riEst: number
  riPag: number
  niEst: number
  niPag: number
  esTotales?: boolean
}

export type ResumenInscripcionesAdmin = {
  titulo: string
  cicloInscripcion: number
  cicloLabel: string
  modo: 'dif1' | 'dif2' | 'general'
  filas: FilaInscripcionesAdmin[]
}

function sumarFilas(filas: FilaInscripcionesAdmin[]): FilaInscripcionesAdmin {
  return filas.reduce(
    (acc, f) => ({
      nivelLabel: 'TOTALES',
      riEst: acc.riEst + f.riEst,
      riPag: acc.riPag + f.riPag,
      niEst: acc.niEst + f.niEst,
      niPag: acc.niPag + f.niPag,
      esTotales: true,
    }),
    { nivelLabel: 'TOTALES', riEst: 0, riPag: 0, niEst: 0, niPag: 0, esTotales: true }
  )
}

function construirFilasConTotales(
  celdas: { nivel: number; grado: number; riEst: number; riPag: number; niEst: number; niPag: number }[]
): FilaInscripcionesAdmin[] {
  const bloques: { nivel: number; grado: number }[][] = [
    NIVELES_GRADOS.filter((c) => c.nivel <= 2),
    NIVELES_GRADOS.filter((c) => c.nivel === 3),
    NIVELES_GRADOS.filter((c) => c.nivel === 4),
  ]

  const mapa = new Map(celdas.map((c) => [key(c.nivel, c.grado), c]))
  const out: FilaInscripcionesAdmin[] = []

  for (const bloque of bloques) {
    const filasBloque: FilaInscripcionesAdmin[] = []
    for (const { nivel, grado } of bloque) {
      const d = mapa.get(key(nivel, grado))
      filasBloque.push({
        nivelLabel: etiquetaNivelInscripciones(nivel, grado),
        riEst: d?.riEst ?? 0,
        riPag: d?.riPag ?? 0,
        niEst: d?.niEst ?? 0,
        niPag: d?.niPag ?? 0,
      })
    }
    out.push(...filasBloque, sumarFilas(filasBloque))
  }

  return out
}

function mapaDesdeFilas(filas: { alumno_nivel: number; alumno_grado: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const f of filas) {
    const k = key(Number(f.alumno_nivel), Number(f.alumno_grado))
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

async function contarAlumnos(
  ciclo: number,
  nuevoIngreso: 0 | 1,
  excluirStatus = true
): Promise<Map<string, number>> {
  const db = createDbAdmin()
  const filas: { alumno_nivel: number; alumno_grado: number }[] = []
  let offset = 0

  while (true) {
    let q = db
      .from('alumno')
      .select('alumno_nivel, alumno_grado')
      .eq('alumno_ciclo_escolar', ciclo)
      .eq('alumno_nuevo_ingreso', nuevoIngreso)

    if (excluirStatus) q = q.not('alumno_status', 'in', '(0,2)')

    const { data, error } = await q.range(offset, offset + PAGE_ALUMNO - 1)
    if (error) throw new Error(error.message)
    const chunk = data ?? []
    filas.push(...chunk.map((r) => ({
      alumno_nivel: Number(r.alumno_nivel),
      alumno_grado: Number(r.alumno_grado),
    })))
    if (chunk.length < PAGE_ALUMNO) break
    offset += PAGE_ALUMNO
  }

  return mapaDesdeFilas(filas)
}

async function contarReinscritosPagados(
  cicloAlumnos: number,
  cicloInscripcion: number,
  conceptos: string[]
): Promise<Map<string, number>> {
  const db = createDbAdmin()
  const alumnos: { alumno_id: number; alumno_nivel: number; alumno_grado: number }[] = []
  let offset = 0

  while (true) {
    const { data, error } = await db
      .from('alumno')
      .select('alumno_id, alumno_nivel, alumno_grado')
      .eq('alumno_ciclo_escolar', cicloAlumnos)
      .eq('alumno_nuevo_ingreso', 0)
      .not('alumno_status', 'in', '(0,2)')
      .range(offset, offset + PAGE_ALUMNO - 1)

    if (error) throw new Error(error.message)
    const chunk = data ?? []
    for (const a of chunk) {
      alumnos.push({
        alumno_id: Number(a.alumno_id),
        alumno_nivel: Number(a.alumno_nivel),
        alumno_grado: Number(a.alumno_grado),
      })
    }
    if (chunk.length < PAGE_ALUMNO) break
    offset += PAGE_ALUMNO
  }

  if (!alumnos.length) return new Map()

  const pagos = await fetchPagosPorAlumnos(alumnos.map((a) => a.alumno_id))

  const nivelGrado = new Map<number, { nivel: number; grado: number }>()
  for (const a of alumnos) {
    nivelGrado.set(a.alumno_id, { nivel: a.alumno_nivel, grado: a.alumno_grado })
  }

  const m = new Map<string, number>()
  const vistos = new Set<number>()

  for (const p of pagos) {
    if (p.pago_cancelado !== 0 && p.pago_cancelado != null) continue
    const alumnoId = p.alumno_id
    if (vistos.has(alumnoId)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (parsed.cicloEscolar !== cicloInscripcion) continue
    if (!conceptos.includes(parsed.conceptoNo)) continue
    const ng = nivelGrado.get(alumnoId)
    if (!ng) continue
    vistos.add(alumnoId)
    const k = key(ng.nivel, ng.grado)
    m.set(k, (m.get(k) ?? 0) + 1)
  }

  return m
}

async function contarNuevoIngresoPagado(cicloInscripcion: number): Promise<Map<string, number>> {
  const db = createDbAdmin()
  const alumnos: { alumno_id: number; alumno_nivel: number; alumno_grado: number }[] = []
  let offset = 0

  while (true) {
    const { data, error } = await db
      .from('alumno')
      .select('alumno_id, alumno_nivel, alumno_grado, alumno_ref')
      .eq('alumno_ciclo_escolar', cicloInscripcion)
      .eq('alumno_nuevo_ingreso', 1)
      .eq('alumno_status', 1)
      .range(offset, offset + PAGE_ALUMNO - 1)

    if (error) throw new Error(error.message)
    const chunk = data ?? []
    for (const a of chunk) {
      alumnos.push({
        alumno_id: Number(a.alumno_id),
        alumno_nivel: Number(a.alumno_nivel),
        alumno_grado: Number(a.alumno_grado),
      })
    }
    if (chunk.length < PAGE_ALUMNO) break
    offset += PAGE_ALUMNO
  }

  if (!alumnos.length) return new Map()

  const pagos = await fetchPagosPorAlumnos(alumnos.map((a) => a.alumno_id))
  const pagados = new Set<number>()

  for (const p of pagos) {
    if (p.pago_cancelado !== 0 && p.pago_cancelado != null) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (parsed.cicloEscolar !== cicloInscripcion || parsed.conceptoNo !== '13') continue
    pagados.add(p.alumno_id)
  }

  const m = new Map<string, number>()
  for (const a of alumnos) {
    if (!pagados.has(a.alumno_id)) continue
    const k = key(a.alumno_nivel, a.alumno_grado)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

const NIVELES_GRADOS: Celda[] = [
  { nivel: 1, grado: 1 },
  { nivel: 1, grado: 2 },
  { nivel: 2, grado: 1 },
  { nivel: 2, grado: 2 },
  { nivel: 2, grado: 3 },
  { nivel: 3, grado: 1 },
  { nivel: 3, grado: 2 },
  { nivel: 3, grado: 3 },
  { nivel: 3, grado: 4 },
  { nivel: 3, grado: 5 },
  { nivel: 3, grado: 6 },
  { nivel: 4, grado: 1 },
  { nivel: 4, grado: 2 },
  { nivel: 4, grado: 3 },
]

export async function cargarMatrizInscripciones(cicloInscripcion: number, modo: 'dif1' | 'dif2' | 'general') {
  const cicloAlumnos = cicloInscripcion - 1
  const conceptos =
    modo === 'dif2' ? ['12', '13'] : ['11', '13']

  const [riEst, riPag, niEst, niPag] = await Promise.all([
    contarAlumnos(cicloAlumnos, 0),
    contarReinscritosPagados(cicloAlumnos, cicloInscripcion, conceptos),
    contarAlumnos(cicloInscripcion, 1, false),
    contarNuevoIngresoPagado(cicloInscripcion),
  ])

  const celdas = NIVELES_GRADOS.map(({ nivel, grado }) => {
    const k = key(nivel, grado)
    return {
      nivel,
      grado,
      riEst: riEst.get(k) ?? 0,
      riPag: riPag.get(k) ?? 0,
      niEst: niEst.get(k) ?? 0,
      niPag: niPag.get(k) ?? 0,
    }
  })

  const titulo = 'Inscripciones Nuevo Ingreso'

  return {
    titulo,
    cicloInscripcion,
    cicloLabel: etiquetaCicloReporte(cicloInscripcion),
    modo,
    filas: construirFilasConTotales(celdas),
  }
}

const HEADERS_LEGACY = [
  'NIVEL',
  'RI ESTIMADOS',
  'RI INSCRITOS',
  'RI DIFERENCIA',
  'NI ESTIMADOS',
  'NI INSCRITOS',
  'NI DIFERENCIA',
  'TOTAL ESTIMADO',
  'TOTAL INSCRITOS',
] as const

/** @deprecated Usar construirHtmlReporteInscripciones / generarPdfReporteInscripciones */
export function matrizInscripcionesATabla(resumen: ResumenInscripcionesAdmin) {
  return {
    headers: [...HEADERS_LEGACY],
    rows: resumen.filas.map((f) => {
      const riDif = f.riEst - f.riPag
      const niDif = f.niEst - f.niPag
      return [
        f.nivelLabel,
        String(f.riEst),
        String(f.riPag),
        String(riDif),
        String(f.niEst),
        String(f.niPag),
        String(niDif),
        String(f.riEst + f.niEst),
        String(f.riPag + f.niPag),
      ]
    }),
  }
}
