import { BECA_ESTATUS_ACTIVA, etiquetaBecaEstatus } from './becaEstatus'
import { construirNombreCompleto } from './alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from './gradoEscolar'
import { etiquetaNivelEscolar } from './nivelEscolar'
import { etiquetaGrupoEscolar } from './grupoEscolar'
import { createDbAdmin } from './insforgeAdmin'

const PAGE_SIZE = 500
const ALUMNO_CHUNK = 150

const SELECT_BECA =
  'alumno_beca_id, alumno_id, beca_id, beca_porcentaje, beca_estatus, beca_ciclo_escolar, beca_p'

const SELECT_ALUMNO =
  'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar'

export interface ReporteBecadoFila {
  alumnoId: number
  alumnoRef: string
  nombre: string
  nivel: number
  nivelLabel: string
  plantel: string
  grado: string
  gradoNum: number
  grupo: string
  becaId: number
  becaClase: string
  becaPorcentaje: number
  becaEstatus: number
  becaEstatusLabel: string
  /** Promedio español Kinder (MySQL). */
  promedioEs?: number | null
  /** Promedio inglés Kinder ponderado (MySQL). */
  promedioEn?: number | null
  /** Letra AVERAGE inglés (última disponible). */
  letraEn?: string | null
  /** Promedio combinado usado para el filtro ≥ 9. */
  promedio?: number | null
}

export interface ReporteBecadosResumen {
  ciclo: number
  total: number
  niveles: number
  filas: ReporteBecadoFila[]
  gruposPorNivel: { nivel: number; nivelLabel: string; plantel: string; filas: ReporteBecadoFila[] }[]
  /** true cuando el reporte incluye columnas de promedio. */
  conPromedio?: boolean
  umbralPromedio?: number
  nivelFiltro?: number
  nivelFiltroLabel?: string
  nota?: string
}

function plantelPorNivel(nivel: number): string {
  return nivel <= 2 ? 'Instituto Educativo Winston' : 'Instituto Winston Churchill'
}

async function cargarConceptosBeca(): Promise<Map<number, string>> {
  const db = createDbAdmin()
  const mapa = new Map<number, string>()
  const { data, error } = await db.from('concepto_beca').select('beca_id, beca_clase')
  if (error) throw new Error(error.message)
  for (const row of data ?? []) {
    mapa.set(Number(row.beca_id), String(row.beca_clase ?? '').trim() || `Beca ${row.beca_id}`)
  }
  return mapa
}

async function cargarBecasCiclo(ciclo: number) {
  const db = createDbAdmin()
  const filas: {
    alumno_beca_id: number
    alumno_id: number
    beca_id: number
    beca_porcentaje: number
    beca_estatus: number
    beca_ciclo_escolar: number
    beca_p: string
  }[] = []

  let offset = 0
  while (true) {
    const { data, error } = await db
      .from('alumno_beca')
      .select(SELECT_BECA)
      .eq('beca_ciclo_escolar', ciclo)
      .eq('beca_estatus', BECA_ESTATUS_ACTIVA)
      .order('alumno_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    const chunk = data ?? []
    filas.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return filas
}

async function cargarAlumnosPorIds(ids: number[]) {
  const db = createDbAdmin()
  type FilaAlumno = {
    alumno_id: number
    alumno_ref: string
    alumno_app: string
    alumno_apm: string
    alumno_nombre: string
    alumno_nivel: number
    alumno_grado: number
    alumno_grupo: number
    alumno_status: number
    alumno_ciclo_escolar: number
  }
  const mapa = new Map<number, FilaAlumno>()

  for (let i = 0; i < ids.length; i += ALUMNO_CHUNK) {
    const slice = ids.slice(i, i + ALUMNO_CHUNK)
    // Tras avance de temporada la ficha sigue con el mismo alumno_id pero otro ciclo.
    const { data, error } = await db
      .from('alumno')
      .select(SELECT_ALUMNO)
      .in('alumno_id', slice)
      .eq('alumno_status', 1)

    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      const fila = row as FilaAlumno
      mapa.set(fila.alumno_id, fila)
    }
  }

  return mapa
}

export async function cargarReporteBecados(ciclo: number): Promise<ReporteBecadosResumen> {
  const [becas, conceptos] = await Promise.all([cargarBecasCiclo(ciclo), cargarConceptosBeca()])
  const alumnoIds = [...new Set(becas.map((b) => b.alumno_id))]
  const alumnos = await cargarAlumnosPorIds(alumnoIds)

  const filas: ReporteBecadoFila[] = []

  for (const beca of becas) {
    const alumno = alumnos.get(beca.alumno_id)
    if (!alumno) continue

    const nivel = Number(alumno.alumno_nivel)
    const gradoNum = Number(alumno.alumno_grado)

    filas.push({
      alumnoId: alumno.alumno_id,
      alumnoRef: String(alumno.alumno_ref ?? '').trim(),
      nombre: construirNombreCompleto(alumno.alumno_nombre, alumno.alumno_app, alumno.alumno_apm),
      nivel,
      nivelLabel: etiquetaNivelEscolar(nivel),
      plantel: plantelPorNivel(nivel),
      grado: etiquetaGradoEscolar(nivel, gradoNum),
      gradoNum,
      grupo: etiquetaGrupoEscolar(alumno.alumno_grupo) || '—',
      becaId: Number(beca.beca_id),
      becaClase: conceptos.get(Number(beca.beca_id)) ?? `Beca ${beca.beca_id}`,
      becaPorcentaje: Number(beca.beca_porcentaje),
      becaEstatus: Number(beca.beca_estatus),
      becaEstatusLabel: etiquetaBecaEstatus(Number(beca.beca_estatus)),
    })
  }

  filas.sort((a, b) => {
    if (a.nivel !== b.nivel) return a.nivel - b.nivel
    if (a.gradoNum !== b.gradoNum) return a.gradoNum - b.gradoNum
    return a.nombre.localeCompare(b.nombre, 'es')
  })

  const porNivel = new Map<number, ReporteBecadoFila[]>()
  for (const fila of filas) {
    if (!porNivel.has(fila.nivel)) porNivel.set(fila.nivel, [])
    porNivel.get(fila.nivel)!.push(fila)
  }

  const gruposPorNivel = [...porNivel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([nivel, nivelFilas]) => ({
      nivel,
      nivelLabel: nivelFilas[0]?.nivelLabel ?? etiquetaNivelEscolar(nivel),
      plantel: nivelFilas[0]?.plantel ?? plantelPorNivel(nivel),
      filas: nivelFilas,
    }))

  return {
    ciclo,
    total: filas.length,
    niveles: gruposPorNivel.length,
    filas,
    gruposPorNivel,
  }
}

/** Legacy `becadosSextoPrimaria.php`: Primaria 6° con beca Winston activa. */
export async function cargarReporteBecadosSexto(
  ciclo: number
): Promise<ReporteBecadosResumen> {
  const resumen = await cargarReporteBecados(ciclo)
  const filas = resumen.filas.filter((f) => f.nivel === 3 && f.gradoNum === 6)
  const gruposPorNivel =
    filas.length === 0
      ? []
      : [
          {
            nivel: 3,
            nivelLabel: filas[0].nivelLabel,
            plantel: filas[0].plantel,
            filas,
          },
        ]

  return {
    ciclo,
    total: filas.length,
    niveles: gruposPorNivel.length,
    filas,
    gruposPorNivel,
  }
}

const UMBRAL_PROMEDIO_BECADOS = 9

/**
 * Becados Winston de un nivel con promedio ≥ 9.
 * Kinder: calificaciones MySQL (ES numérico + EN letras ponderadas).
 * Primaria/Secundaria: pendiente de extracción de boletas.
 */
export async function cargarReporteBecadosConPromedio(
  ciclo: number,
  nivelValor: number
): Promise<ReporteBecadosResumen> {
  const base = await cargarReporteBecados(ciclo)
  const delNivel = base.filas.filter((f) => f.nivel === nivelValor)

  if (nivelValor !== 2) {
    return {
      ciclo,
      total: 0,
      niveles: 0,
      filas: [],
      gruposPorNivel: [],
      conPromedio: true,
      umbralPromedio: UMBRAL_PROMEDIO_BECADOS,
      nivelFiltro: nivelValor,
      nivelFiltroLabel: etiquetaNivelEscolar(nivelValor),
      nota:
        'Primaria y Secundaria aún no tienen extracción de boletas en este reporte. Por ahora solo Kinder.',
    }
  }

  const { cargarPromediosKinderMysql } = await import('./kinderPromedioMysql')
  const promedios = await cargarPromediosKinderMysql(delNivel.map((f) => f.alumnoId))

  const filas: ReporteBecadoFila[] = []
  for (const fila of delNivel) {
    const p = promedios.get(fila.alumnoId)
    const promedio = p?.promedio ?? null
    if (promedio == null || promedio < UMBRAL_PROMEDIO_BECADOS) continue
    filas.push({
      ...fila,
      promedioEs: p?.promedioEs ?? null,
      promedioEn: p?.promedioEn ?? null,
      letraEn: p?.letraEn ?? null,
      promedio,
    })
  }

  filas.sort((a, b) => {
    if (a.gradoNum !== b.gradoNum) return a.gradoNum - b.gradoNum
    const pa = a.promedio ?? 0
    const pb = b.promedio ?? 0
    if (pb !== pa) return pb - pa
    return a.nombre.localeCompare(b.nombre, 'es')
  })

  const gruposPorNivel =
    filas.length === 0
      ? []
      : [
          {
            nivel: 2,
            nivelLabel: filas[0].nivelLabel,
            plantel: filas[0].plantel,
            filas,
          },
        ]

  return {
    ciclo,
    total: filas.length,
    niveles: gruposPorNivel.length,
    filas,
    gruposPorNivel,
    conPromedio: true,
    umbralPromedio: UMBRAL_PROMEDIO_BECADOS,
    nivelFiltro: 2,
    nivelFiltroLabel: etiquetaNivelEscolar(2),
  }
}
