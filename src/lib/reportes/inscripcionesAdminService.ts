import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { ESTATUS_ALUMNO_BLOQUEOS, esEstatusBloqueo } from '@/lib/alumnoStatus'
import {
  calcularDestinoCambioCiclo,
} from '@/lib/cambioCicloEscolarAdvance'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import {
  cicloEscolarEtiqueta,
  cicloFichaAlumnosParaInscripcion,
} from '@/lib/ciclosEscolares'
import { resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { parsearReferenciaPago } from '@/lib/pagoReferenciaColegiatura'
import { PAGE_ALUMNO } from './dbChunks'
import { fetchPagosPorConceptosCiclo } from './fetchDb'
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

export type AlumnoBloqueoInscripciones = {
  noCtrl: string
  nombre: string
  status: number
  /** Grado actual en ficha (aún no avanzaron). */
  nivelActual: number
  gradoActual: number
  nivelActualLabel: string
  /** Grado / ciclo en el que deberían estar. */
  nivelDestino: number
  gradoDestino: number
  nivelDestinoLabel: string
  cicloDestino: number
  cicloDestinoLabel: string
}

export type GrupoBloqueoInscripciones = {
  /** Etiqueta del grado destino (donde deberían estar). */
  nivelLabel: string
  nivel: number
  grado: number
  cicloDestino: number
  cicloDestinoLabel: string
  tituloGrupo: string
  alumnos: AlumnoBloqueoInscripciones[]
}

export type ResumenInscripcionesAdmin = {
  titulo: string
  cicloInscripcion: number
  cicloLabel: string
  modo: 'dif1' | 'dif2' | 'general'
  filas: FilaInscripcionesAdmin[]
  /** Estatus 4 o 5: bloqueo psicológico / académico, agrupados por grado destino. */
  bloqueos: GrupoBloqueoInscripciones[]
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

type AlumnoCeldaRow = {
  alumno_id: number
  alumno_nivel: number
  alumno_grado: number
  alumno_status: number
}

async function fetchAlumnosCicloNuevoIngreso(
  ciclo: number,
  nuevoIngreso: 0 | 1,
  modoStatus: 'dif1' | 'dif2' | 'general' | 'ni'
): Promise<AlumnoCeldaRow[]> {
  const db = createDbAdmin()
  const out: AlumnoCeldaRow[] = []
  let offset = 0

  while (true) {
    let q = db
      .from('alumno')
      .select('alumno_id, alumno_nivel, alumno_grado, alumno_status')
      .eq('alumno_ciclo_escolar', ciclo)
      .eq('alumno_nuevo_ingreso', nuevoIngreso)

    if (modoStatus === 'ni') {
      q = q.eq('alumno_status', 1)
    } else {
      // Legacy: alumno_status != 0 (filtros 2/5 de pagados RI se aplican en memoria).
      q = q.neq('alumno_status', 0)
    }

    const { data, error } = await q.range(offset, offset + PAGE_ALUMNO - 1)
    if (error) throw new Error(error.message)
    const chunk = data ?? []
    for (const a of chunk) {
      out.push({
        alumno_id: Number(a.alumno_id),
        alumno_nivel: Number(a.alumno_nivel),
        alumno_grado: Number(a.alumno_grado),
        alumno_status: Number(a.alumno_status),
      })
    }
    if (chunk.length < PAGE_ALUMNO) break
    offset += PAGE_ALUMNO
  }

  return out
}

function mapaDesdeAlumnos(
  alumnos: AlumnoCeldaRow[],
  pred?: (a: AlumnoCeldaRow) => boolean
): Map<string, number> {
  const m = new Map<string, number>()
  for (const a of alumnos) {
    if (pred && !pred(a)) continue
    const k = key(a.alumno_nivel, a.alumno_grado)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

function pagoVigente(cancelado: number | null | undefined): boolean {
  return cancelado === 0 || cancelado == null
}

function idsPagadosPorConceptos(
  pagos: Awaited<ReturnType<typeof fetchPagosPorConceptosCiclo>>,
  cicloInscripcion: number,
  conceptos: string[]
): Set<number> {
  const vistos = new Set<number>()
  for (const p of pagos) {
    if (!pagoVigente(p.pago_cancelado)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (parsed.cicloEscolar !== cicloInscripcion) continue
    if (!conceptos.includes(parsed.conceptoNo)) continue
    vistos.add(p.alumno_id)
  }
  return vistos
}

function mapaPagadosPorNivelGrado(
  alumnos: AlumnoCeldaRow[],
  pagados: Set<number>,
  pred?: (a: AlumnoCeldaRow) => boolean
): Map<string, number> {
  const m = new Map<string, number>()
  for (const a of alumnos) {
    if (pred && !pred(a)) continue
    if (!pagados.has(a.alumno_id)) continue
    const k = key(a.alumno_nivel, a.alumno_grado)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

function sumarMapas(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  const out = new Map(a)
  for (const [k, n] of b) {
    out.set(k, (out.get(k) ?? 0) + n)
  }
  return out
}

function mapaBloqueosPorDestino(grupos: GrupoBloqueoInscripciones[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const g of grupos) {
    m.set(key(g.nivel, g.grado), g.alumnos.length)
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

async function cargarBloqueosPsicoAcademico(
  cicloAlumnos: number,
  cicloInscripcion: number
): Promise<GrupoBloqueoInscripciones[]> {
  // Maternal A → 9° Sec: estatus 4 y 5 (bloqueo académico / psicológico).
  const ciclos = new Set<number>([cicloAlumnos, cicloInscripcion])
  if (cicloInscripcion > 1) ciclos.add(cicloInscripcion - 1)

  const cicloDestino = cicloInscripcion
  const cicloDestinoLabel = `${cicloEscolarEtiqueta(cicloDestino)} (${cicloDestino})`
  const gradosColegio = new Set(NIVELES_GRADOS.map((c) => key(c.nivel, c.grado)))

  const db = createDbAdmin()
  const chunksPorCiclo = await Promise.all(
    [...ciclos].map(async (ciclo) => {
      const rows: Record<string, unknown>[] = []
      let offset = 0
      while (true) {
        const { data, error } = await db
          .from('alumno')
          .select(
            'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_ciclo_escolar, alumno_status'
          )
          .eq('alumno_ciclo_escolar', ciclo)
          .in('alumno_status', [...ESTATUS_ALUMNO_BLOQUEOS])
          .range(offset, offset + PAGE_ALUMNO - 1)
        if (error) throw new Error(error.message)
        const chunk = data ?? []
        for (const r of chunk) rows.push(r as Record<string, unknown>)
        if (chunk.length < PAGE_ALUMNO) break
        offset += PAGE_ALUMNO
      }
      return rows
    })
  )

  const vistos = new Set<number>()
  const filas: AlumnoBloqueoInscripciones[] = []

  for (const chunk of chunksPorCiclo) {
    for (const r of chunk) {
      const id = Number(r.alumno_id)
      if (vistos.has(id)) continue
      const nivelActual = Number(r.alumno_nivel)
      const gradoActual = Number(r.alumno_grado)
      // Solo Maternal A … 9° Sec (excluye egresados grado 4).
      if (!gradosColegio.has(key(nivelActual, gradoActual))) continue
      vistos.add(id)

      const cicloFicha = Number(r.alumno_ciclo_escolar)
      const yaEnCicloDestino = cicloFicha === cicloDestino
      const dest = yaEnCicloDestino
        ? { nivel: nivelActual, grado: gradoActual, egresa: false }
        : calcularDestinoCambioCiclo(nivelActual, gradoActual)

      // Si el avance los mandaría a egresados, se reportan como 9° (tope del reporte).
      const nivelDestino = dest.egresa ? 4 : dest.nivel
      const gradoDestino = dest.egresa ? 3 : dest.grado
      const nivelDestinoLabel = dest.egresa
        ? etiquetaNivelInscripciones(4, 3)
        : etiquetaNivelInscripciones(nivelDestino, gradoDestino)

      filas.push({
        noCtrl: String(r.alumno_ref ?? '').trim(),
        nombre: construirNombreCompleto(
          r.alumno_nombre as string | null | undefined,
          r.alumno_app as string | null | undefined,
          r.alumno_apm as string | null | undefined
        ),
        status: Number(r.alumno_status),
        nivelActual,
        gradoActual,
        nivelActualLabel: etiquetaNivelInscripciones(nivelActual, gradoActual),
        nivelDestino,
        gradoDestino,
        nivelDestinoLabel,
        cicloDestino,
        cicloDestinoLabel,
      })
    }
  }

  const porDestino = new Map<string, AlumnoBloqueoInscripciones[]>()
  for (const f of filas) {
    const k = key(f.nivelDestino, f.gradoDestino)
    const list = porDestino.get(k) ?? []
    list.push(f)
    porDestino.set(k, list)
  }

  const grupos: GrupoBloqueoInscripciones[] = []
  for (const { nivel, grado } of NIVELES_GRADOS) {
    const alumnos = porDestino.get(key(nivel, grado))
    if (!alumnos?.length) continue
    alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    const nivelLabel = etiquetaNivelInscripciones(nivel, grado)
    grupos.push({
      nivelLabel,
      nivel,
      grado,
      cicloDestino,
      cicloDestinoLabel,
      tituloGrupo: nivelLabel,
      alumnos,
    })
  }
  return grupos
}

export async function cargarMatrizInscripciones(cicloInscripcion: number, modo: 'dif1' | 'dif2' | 'general') {
  // Tras cambio de ciclo las fichas ya están en el grado destino (= cen).
  // Antes: aún en origen (cen - 1).
  const cea = await resolverCicloEscolarSistemaValor()
  const cicloAlumnos = cicloFichaAlumnosParaInscripcion(cicloInscripcion, cea)
  const conceptos =
    modo === 'dif2' ? ['12', '13'] : ['11', '13']

  // Un solo barrido RI + NI + pagos del ciclo (por patrón de referencia) + bloqueos.
  const [riAlumnos, niAlumnos, pagos, bloqueos] = await Promise.all([
    fetchAlumnosCicloNuevoIngreso(cicloAlumnos, 0, modo),
    fetchAlumnosCicloNuevoIngreso(cicloInscripcion, 1, 'ni'),
    fetchPagosPorConceptosCiclo(conceptos, cicloInscripcion),
    cargarBloqueosPsicoAcademico(cicloAlumnos, cicloInscripcion),
  ])

  // RI estimados = activos/otros (sin 4/5) + bloqueos atribuidos al grado destino.
  const riEstBase = mapaDesdeAlumnos(
    riAlumnos,
    (a) => !esEstatusBloqueo(a.alumno_status)
  )
  const riEst = sumarMapas(riEstBase, mapaBloqueosPorDestino(bloqueos))

  const elegiblesRi =
    modo === 'dif1' || modo === 'general'
      ? riAlumnos.filter((a) => ![0, 2, 5].includes(a.alumno_status))
      : riAlumnos.filter((a) => a.alumno_status !== 0)
  const riPag = mapaPagadosPorNivelGrado(
    elegiblesRi,
    idsPagadosPorConceptos(pagos, cicloInscripcion, conceptos)
  )

  const niEst = mapaDesdeAlumnos(niAlumnos)
  const niPag = mapaPagadosPorNivelGrado(
    niAlumnos,
    idsPagadosPorConceptos(pagos, cicloInscripcion, ['13'])
  )

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

  const titulo = 'Inscripciones'

  return {
    titulo,
    cicloInscripcion,
    cicloLabel: etiquetaCicloReporte(cicloInscripcion),
    modo,
    filas: construirFilasConTotales(celdas),
    bloqueos,
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
