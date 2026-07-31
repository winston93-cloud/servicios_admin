import { BECA_ESTATUS_ACTIVA, etiquetaBecaEstatus } from './becaEstatus'
import { construirNombreCompleto } from './alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from './gradoEscolar'
import { etiquetaNivelEscolar } from './nivelEscolar'
import { etiquetaGrupoEscolar } from './grupoEscolar'
import { createDbAdmin } from './insforgeAdmin'
import { BECAS_SEP_CICLO_DATOS, BECAS_SEP_OPEN_HOUSE } from './becasSepOpenHouse'
import { origenCalifsDesdeFicha } from './origenCalifsBecados'

const PAGE_SIZE = 500
const ALUMNO_CHUNK = 150

const SELECT_BECA =
  'alumno_beca_id, alumno_id, beca_id, beca_porcentaje, beca_estatus, beca_ciclo_escolar, beca_p'

const SELECT_ALUMNO =
  'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar'

export type OrigenBecaReporte = 'winston' | 'sep' | 'ambos'

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
  /** Etiqueta visible: `Winston (IMSS)`, `SEP`, o combinada. */
  becaClase: string
  becaPorcentaje: number
  becaEstatus: number
  becaEstatusLabel: string
  origenBeca?: OrigenBecaReporte
  tiposWinston?: string[]
  tieneSep?: boolean
  montoSep?: number | null
  promedioEs?: number | null
  promedioEn?: number | null
  letraEn?: string | null
  promedio?: number | null
}

export interface ReporteBecadosResumen {
  ciclo: number
  total: number
  niveles: number
  filas: ReporteBecadoFila[]
  gruposPorNivel: { nivel: number; nivelLabel: string; plantel: string; filas: ReporteBecadoFila[] }[]
  conPromedio?: boolean
  umbralPromedio?: number
  nivelFiltro?: number
  nivelFiltroLabel?: string
  nota?: string
  totalWinston?: number
  totalSep?: number
  totalAmbos?: number
}

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

type BecaSepFila = {
  alumno_ref: number
  monto_prorrateado: number
  porcentaje: number
}

function plantelPorNivel(nivel: number): string {
  return nivel <= 2 ? 'Instituto Educativo Winston' : 'Instituto Winston Churchill'
}

/** Normaliza clase de concepto_beca a tipo dentro de Winston (...). */
export function tipoBecaWinstonDesdeClase(clase: string): string | null {
  const c = String(clase ?? '').trim()
  if (!c || c === '*') return null
  if (/^winston$/i.test(c)) return null
  return c
}

/** `Winston`, `Winston (IMSS)` o `Winston (IMSS, CFE)`. */
export function formatearEtiquetaWinston(tipos: string[]): string {
  const unicos = [...new Set(tipos.map((t) => t.trim()).filter(Boolean))]
  if (unicos.length === 0) return 'Winston'
  return `Winston (${unicos.join(', ')})`
}

export function formatearEtiquetaBecaReporte(opts: {
  tiposWinston: string[]
  tieneWinston: boolean
  tieneSep: boolean
}): string {
  // SEP en open_house/gestion (insertar-becas-sep.php) prevalece sobre Winston residual.
  if (opts.tieneSep) return 'SEP'
  if (opts.tieneWinston) return formatearEtiquetaWinston(opts.tiposWinston)
  return '—'
}

/**
 * Si el alumno está en la lista SEP de open_house/gestion (hardcode),
 * esa es la beca vigente aunque conserve Winston en InsForge.
 */
function origenDesdeFlags(tieneWinston: boolean, tieneSep: boolean): OrigenBecaReporte {
  if (tieneSep) return 'sep'
  if (tieneWinston) return 'winston'
  return 'winston'
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

/**
 * Becas SEP del ciclo: SOLO la lista hardcodeada de
 * `open_house/gestion/insertar-becas-sep.php` (espejo en becasSepOpenHouse.ts).
 * No usar MySQL `alumno_beca_sep` — tiene montos en 0 / datos viejos.
 */
export async function cargarBecasSepMysql(ciclo: number): Promise<BecaSepFila[]> {
  if (Number(ciclo) !== BECAS_SEP_CICLO_DATOS) return []
  return BECAS_SEP_OPEN_HOUSE.map((b) => ({
    alumno_ref: b.alumnoRef,
    monto_prorrateado: b.monto,
    porcentaje: 0,
  }))
}

async function cargarAlumnosPorIds(ids: number[]) {
  const db = createDbAdmin()
  const mapa = new Map<number, FilaAlumno>()

  for (let i = 0; i < ids.length; i += ALUMNO_CHUNK) {
    const slice = ids.slice(i, i + ALUMNO_CHUNK)
    const { data, error } = await db
      .from('alumno')
      .select(SELECT_ALUMNO)
      .in('alumno_id', slice)
      .eq('alumno_status', 1)

    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      mapa.set((row as FilaAlumno).alumno_id, row as FilaAlumno)
    }
  }

  return mapa
}

async function cargarAlumnosPorRefs(refs: number[]) {
  const db = createDbAdmin()
  const mapa = new Map<number, FilaAlumno>()
  const unicos = [...new Set(refs.filter((r) => Number.isInteger(r) && r > 0))]

  for (let i = 0; i < unicos.length; i += ALUMNO_CHUNK) {
    const slice = unicos.slice(i, i + ALUMNO_CHUNK)
    const { data, error } = await db
      .from('alumno')
      .select(SELECT_ALUMNO)
      .in('alumno_ref', slice)
      .eq('alumno_status', 1)

    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      const fila = row as FilaAlumno
      mapa.set(Number(fila.alumno_ref), fila)
    }
  }

  return mapa
}

function filaDesdeAlumno(
  alumno: FilaAlumno,
  extras: Partial<ReporteBecadoFila> & Pick<ReporteBecadoFila, 'becaClase' | 'becaPorcentaje'>
): ReporteBecadoFila {
  const nivel = Number(alumno.alumno_nivel)
  const gradoNum = Number(alumno.alumno_grado)
  return {
    alumnoId: alumno.alumno_id,
    alumnoRef: String(alumno.alumno_ref ?? '').trim(),
    nombre: construirNombreCompleto(alumno.alumno_nombre, alumno.alumno_app, alumno.alumno_apm),
    nivel,
    nivelLabel: etiquetaNivelEscolar(nivel),
    plantel: plantelPorNivel(nivel),
    grado: etiquetaGradoEscolar(nivel, gradoNum),
    gradoNum,
    grupo: etiquetaGrupoEscolar(alumno.alumno_grupo) || '—',
    becaId: extras.becaId ?? 0,
    becaClase: extras.becaClase,
    becaPorcentaje: extras.becaPorcentaje,
    becaEstatus: extras.becaEstatus ?? BECA_ESTATUS_ACTIVA,
    becaEstatusLabel: etiquetaBecaEstatus(extras.becaEstatus ?? BECA_ESTATUS_ACTIVA),
    origenBeca: extras.origenBeca,
    tiposWinston: extras.tiposWinston,
    tieneSep: extras.tieneSep,
    montoSep: extras.montoSep,
    promedioEs: extras.promedioEs,
    promedioEn: extras.promedioEn,
    letraEn: extras.letraEn,
    promedio: extras.promedio,
  }
}

export async function cargarReporteBecados(ciclo: number): Promise<ReporteBecadosResumen> {
  const [becas, conceptos] = await Promise.all([cargarBecasCiclo(ciclo), cargarConceptosBeca()])
  const alumnoIds = [...new Set(becas.map((b) => b.alumno_id))]
  const alumnos = await cargarAlumnosPorIds(alumnoIds)

  const filas: ReporteBecadoFila[] = []

  for (const beca of becas) {
    const alumno = alumnos.get(beca.alumno_id)
    if (!alumno) continue

    const claseRaw = conceptos.get(Number(beca.beca_id)) ?? `Beca ${beca.beca_id}`
    const tipo = tipoBecaWinstonDesdeClase(claseRaw)
    const tipos = tipo ? [tipo] : []

    filas.push(
      filaDesdeAlumno(alumno, {
        becaId: Number(beca.beca_id),
        becaClase: formatearEtiquetaWinston(tipos),
        becaPorcentaje: Number(beca.beca_porcentaje),
        becaEstatus: Number(beca.beca_estatus),
        origenBeca: 'winston',
        tiposWinston: tipos,
        tieneSep: false,
      })
    )
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

type PromedioNivel = {
  promedioEs?: number | null
  promedioEn?: number | null
  letraEn?: string | null
  promedio?: number | null
}

/**
 * Becados Winston + SEP de un nivel con promedio ≥ 9.
 * Califs del ciclo elegido = grado anterior a la ficha (ej. 1° Primaria ← Kinder 3).
 */
export async function cargarReporteBecadosConPromedio(
  ciclo: number,
  nivelValor: number
): Promise<ReporteBecadosResumen> {
  if (nivelValor !== 2 && nivelValor !== 3 && nivelValor !== 4) {
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
      nota: 'Nivel no soportado en este reporte. Disponibles: Kinder, Primaria y Secundaria.',
    }
  }

  const [becasWinston, conceptos, becasSep] = await Promise.all([
    cargarBecasCiclo(ciclo),
    cargarConceptosBeca(),
    cargarBecasSepMysql(ciclo),
  ])

  const alumnoIdsWinston = [...new Set(becasWinston.map((b) => b.alumno_id))]
  const refsSep = becasSep.map((b) => b.alumno_ref)
  const [alumnosPorId, alumnosPorRef] = await Promise.all([
    cargarAlumnosPorIds(alumnoIdsWinston),
    cargarAlumnosPorRefs(refsSep),
  ])

  type Acum = {
    alumno: FilaAlumno
    tiposWinston: string[]
    pctWinston: number
    tieneWinston: boolean
    tieneSep: boolean
    montoSep: number | null
  }

  const porAlumno = new Map<number, Acum>()

  for (const beca of becasWinston) {
    const alumno = alumnosPorId.get(beca.alumno_id)
    if (!alumno) continue
    if (Number(alumno.alumno_nivel) !== nivelValor) continue

    const claseRaw = conceptos.get(Number(beca.beca_id)) ?? `Beca ${beca.beca_id}`
    const tipo = tipoBecaWinstonDesdeClase(claseRaw)
    const prev = porAlumno.get(alumno.alumno_id)
    if (!prev) {
      porAlumno.set(alumno.alumno_id, {
        alumno,
        tiposWinston: tipo ? [tipo] : [],
        pctWinston: Number(beca.beca_porcentaje),
        tieneWinston: true,
        tieneSep: false,
        montoSep: null,
      })
    } else {
      prev.tieneWinston = true
      if (tipo && !prev.tiposWinston.includes(tipo)) prev.tiposWinston.push(tipo)
      if (Number(beca.beca_porcentaje) > prev.pctWinston) {
        prev.pctWinston = Number(beca.beca_porcentaje)
      }
    }
  }

  for (const sep of becasSep) {
    const alumno = alumnosPorRef.get(sep.alumno_ref)
    if (!alumno) continue
    if (Number(alumno.alumno_nivel) !== nivelValor) continue

    const prev = porAlumno.get(alumno.alumno_id)
    if (!prev) {
      porAlumno.set(alumno.alumno_id, {
        alumno,
        tiposWinston: [],
        pctWinston: 0,
        tieneWinston: false,
        tieneSep: true,
        montoSep: sep.monto_prorrateado,
      })
    } else {
      prev.tieneSep = true
      prev.montoSep = sep.monto_prorrateado
    }
  }

  const candidatos = [...porAlumno.values()]
  const promediosPorAlumno = new Map<number, PromedioNivel>()

  type ConOrigen = {
    acum: (typeof candidatos)[number]
    origen: NonNullable<ReturnType<typeof origenCalifsDesdeFicha>>
  }
  const conOrigen: ConOrigen[] = []
  for (const c of candidatos) {
    const origen = origenCalifsDesdeFicha(nivelValor, Number(c.alumno.alumno_grado))
    if (origen) conOrigen.push({ acum: c, origen })
  }

  const idsKinder = [
    ...new Set(
      conOrigen.filter((x) => x.origen.fuente === 'kinder').map((x) => x.acum.alumno.alumno_id)
    ),
  ]
  const primInputs = conOrigen
    .filter((x) => x.origen.fuente === 'primaria')
    .map((x) => ({
      alumnoId: x.acum.alumno.alumno_id,
      alumnoRef: String(x.acum.alumno.alumno_ref ?? '').trim(),
      grado: x.origen.gradoOrigen,
    }))
  const idsSec = [
    ...new Set(
      conOrigen
        .filter((x) => x.origen.fuente === 'secundaria')
        .map((x) => x.acum.alumno.alumno_id)
    ),
  ]

  const cargas: Promise<void>[] = []

  if (idsKinder.length > 0) {
    cargas.push(
      (async () => {
        const { cargarPromediosKinderMysql } = await import('./kinderPromedioMysql')
        const promedios = await cargarPromediosKinderMysql(idsKinder)
        for (const [id, p] of promedios) {
          promediosPorAlumno.set(id, {
            promedioEs: p.promedioEs,
            promedioEn: p.promedioEn,
            letraEn: p.letraEn,
            promedio: p.promedio,
          })
        }
      })()
    )
  }

  if (primInputs.length > 0) {
    cargas.push(
      (async () => {
        const { cargarPromediosPrimariaMysql } = await import('./primariaPromedioMysql')
        const promedios = await cargarPromediosPrimariaMysql(primInputs)
        for (const [id, p] of promedios) {
          // Secundaria 7mo: una sola columna (promedio); Primaria/Kinder: ES+EN.
          if (nivelValor === 4) {
            promediosPorAlumno.set(id, {
              promedioEs: null,
              promedioEn: null,
              letraEn: null,
              promedio: p.promedio,
            })
          } else {
            promediosPorAlumno.set(id, {
              promedioEs: p.promedioEs,
              promedioEn: p.promedioEn,
              letraEn: null,
              promedio: p.promedio,
            })
          }
        }
      })()
    )
  }

  if (idsSec.length > 0) {
    cargas.push(
      (async () => {
        const { cargarPromediosSecundariaMysql } = await import('./secundariaPromedioMysql')
        const promedios = await cargarPromediosSecundariaMysql(idsSec, ciclo)
        for (const [id, p] of promedios) {
          promediosPorAlumno.set(id, {
            promedioEs: null,
            promedioEn: null,
            letraEn: null,
            promedio: p.promedio,
          })
        }
      })()
    )
  }

  await Promise.all(cargas)

  const filas: ReporteBecadoFila[] = []
  let totalWinston = 0
  let totalSep = 0
  let totalAmbos = 0

  for (const c of candidatos) {
    const p = promediosPorAlumno.get(c.alumno.alumno_id)
    const promedio = p?.promedio ?? null
    if (promedio == null || promedio < UMBRAL_PROMEDIO_BECADOS) continue

    const origen = origenDesdeFlags(c.tieneWinston, c.tieneSep)
    // Contamos “ambas” solo como dato interno: en UI/etiqueta la vigente es SEP.
    if (c.tieneWinston && c.tieneSep) totalAmbos++
    if (origen === 'winston') totalWinston++
    else totalSep++

    const muestraSep = origen === 'sep'
    filas.push(
      filaDesdeAlumno(c.alumno, {
        becaId: 0,
        becaClase: formatearEtiquetaBecaReporte({
          tiposWinston: c.tiposWinston,
          tieneWinston: c.tieneWinston && !muestraSep,
          tieneSep: muestraSep,
        }),
        // Con SEP vigente no mostramos % Winston; va el monto SEP.
        becaPorcentaje: muestraSep ? 0 : c.pctWinston,
        origenBeca: origen,
        tiposWinston: muestraSep ? [] : c.tiposWinston,
        tieneSep: muestraSep,
        montoSep: muestraSep ? c.montoSep : null,
        promedioEs: p?.promedioEs ?? null,
        promedioEn: p?.promedioEn ?? null,
        letraEn: p?.letraEn ?? null,
        promedio,
      })
    )
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
            nivel: nivelValor,
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
    nivelFiltro: nivelValor,
    nivelFiltroLabel: etiquetaNivelEscolar(nivelValor),
    totalWinston,
    totalSep,
    totalAmbos,
  }
}
