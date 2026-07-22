import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { cicloFichaAlumnosParaInscripcion } from '@/lib/ciclosEscolares'
import { resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'
import {
  formatearAlumnoRefParaReferencia,
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'
import { fetchAlumnosReinscritos, fetchPagosPorAlumnos } from './fetchDb'
import { etiquetaCicloReporte } from './renderDocument'

export type ModoReinscritosPagos = '1-pago' | '2-pagos'

export type FilaReinscritosPagos = {
  no: number
  gradoNum: number
  grado: string
  grupo: string
  noCtrl: string
  nombre: string
  fechaDif1: string
  fechaDif2: string
  fechaPago: string
  plan: string
  /** Pagó el concepto objetivo del reporte (1er dif / 2do dif). */
  pagado: boolean
}

export type ResumenGradoReinscritos = {
  gradoNum: number
  grado: string
  pendientes: number
  pagados: number
  total: number
}

export type ResumenReinscritosPagos = {
  modo: ModoReinscritosPagos
  cicloEscolar: number
  cicloInscripcion: number
  cicloLabel: string
  cicloEscolarLabel: string
  nivel: number
  nivelLabel: string
  titulo: string
  filas: FilaReinscritosPagos[]
  resumenGrados: ResumenGradoReinscritos[]
  totalPendientes: number
  totalPagados: number
}

function pagoVigente(cancelado: number | null): boolean {
  return cancelado !== 1 && cancelado !== 2
}

function etiquetaPlanMeses(mes: number | null): string {
  if (mes === 1) return '10 meses'
  if (mes === 2) return '11 meses'
  return 'N/D'
}

function formatearFechaPago(fecha: string | null): string {
  if (!fecha) return ''
  const d = fecha.slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return fecha
  return `${day}/${m}/${y}`
}

function pagosAlumnoVigentes(
  pagos: {
    pago_referencia: string | null
    pago_fecha: string | null
    pago_cancelado: number | null
  }[]
) {
  return pagos.filter((p) => pagoVigente(p.pago_cancelado))
}

function buscarFechaConcepto(
  pagos: ReturnType<typeof pagosAlumnoVigentes>,
  alumnoRef: string,
  conceptos: string[],
  cicloInscripcion: number
): string {
  const ref5 = formatearAlumnoRefParaReferencia(alumnoRef)
  const hits = pagos
    .map((p) => {
      const parsed = parsearReferenciaPago(p.pago_referencia)
      if (!parsed) return null
      if (
        parsed.alumnoRef !== ref5 ||
        !conceptos.includes(normalizarConceptoNo(parsed.conceptoNo)) ||
        parsed.cicloEscolar !== cicloInscripcion
      ) {
        return null
      }
      return p.pago_fecha
    })
    .filter((f): f is string => Boolean(f))
    .sort()

  return hits.length ? formatearFechaPago(hits[0]) : ''
}

async function cargarReinscritosUnion(
  nivel: number,
  cicloEscolar: number,
  cicloInscripcion: number,
  titulo: string,
  modo: ModoReinscritosPagos
): Promise<ResumenReinscritosPagos> {
  const alumnos = await fetchAlumnosReinscritos(nivel, cicloEscolar)
  const pagos = await fetchPagosPorAlumnos(alumnos.map((a) => a.alumno_id))

  const pagosPorAlumno = new Map<number, typeof pagos>()
  for (const p of pagos) {
    const list = pagosPorAlumno.get(p.alumno_id) ?? []
    list.push(p)
    pagosPorAlumno.set(p.alumno_id, list)
  }

  const conceptosObjetivo = modo === '1-pago' ? ['11', '13'] : ['12', '13']
  const conceptosDif1 = ['11']
  const conceptosDif2 = ['12', '13']

  const filas: FilaReinscritosPagos[] = []
  const contadores = new Map<number, { pendientes: number; pagados: number }>()

  for (const a of alumnos) {
    const vigentes = pagosAlumnoVigentes(pagosPorAlumno.get(a.alumno_id) ?? [])
    const fechaDif1 = buscarFechaConcepto(
      vigentes,
      a.alumno_ref,
      conceptosDif1,
      cicloInscripcion
    )
    const fechaObjetivo = buscarFechaConcepto(
      vigentes,
      a.alumno_ref,
      conceptosObjetivo,
      cicloInscripcion
    )
    const fechaDif2 =
      modo === '2-pagos'
        ? buscarFechaConcepto(vigentes, a.alumno_ref, conceptosDif2, cicloInscripcion)
        : ''
    const pagado = Boolean(fechaObjetivo)

    const prev = contadores.get(a.alumno_grado) ?? { pendientes: 0, pagados: 0 }
    if (pagado) prev.pagados += 1
    else prev.pendientes += 1
    contadores.set(a.alumno_grado, prev)

    filas.push({
      no: 0,
      gradoNum: a.alumno_grado,
      grado: etiquetaGradoEscolar(a.alumno_nivel, a.alumno_grado),
      grupo: etiquetaGrupoEscolar(a.alumno_grupo),
      noCtrl: a.alumno_ref,
      nombre: a.nombre,
      fechaDif1,
      fechaDif2: modo === '2-pagos' ? fechaDif2 : '',
      fechaPago: modo === '1-pago' ? fechaObjetivo : '',
      plan: etiquetaPlanMeses(a.mes),
      pagado,
    })
  }

  filas.sort((x, y) => {
    if (x.gradoNum !== y.gradoNum) return x.gradoNum - y.gradoNum
    const gp = x.grupo.localeCompare(y.grupo, 'es')
    if (gp !== 0) return gp
    return x.nombre.localeCompare(y.nombre, 'es')
  })

  filas.forEach((f, i) => {
    f.no = i + 1
  })

  const resumenGrados: ResumenGradoReinscritos[] = [...contadores.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([gradoNum, c]) => ({
      gradoNum,
      grado: etiquetaGradoEscolar(nivel, gradoNum),
      pendientes: c.pendientes,
      pagados: c.pagados,
      total: c.pendientes + c.pagados,
    }))

  const totalPendientes = resumenGrados.reduce((s, g) => s + g.pendientes, 0)
  const totalPagados = resumenGrados.reduce((s, g) => s + g.pagados, 0)

  return {
    modo,
    cicloEscolar,
    cicloInscripcion,
    cicloLabel: etiquetaCicloReporte(cicloInscripcion),
    cicloEscolarLabel: etiquetaCicloReporte(cicloEscolar),
    nivel,
    nivelLabel: etiquetaNivelEscolar(nivel),
    titulo,
    filas,
    resumenGrados,
    totalPendientes,
    totalPagados,
  }
}

export function reinscritosPagosATabla(resumen: ResumenReinscritosPagos, dosPagos: boolean) {
  const headers = dosPagos
    ? ['#', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', '1er Dif', '2do Dif', 'Plan']
    : ['#', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', 'F. pago', 'Plan']

  const rows = resumen.filas.map((f) =>
    dosPagos
      ? [
          String(f.no),
          f.grado,
          f.grupo,
          f.noCtrl,
          f.nombre,
          f.fechaDif1 || 'SIN PAGO',
          f.fechaDif2 || 'SIN PAGO',
          f.plan,
        ]
      : [
          String(f.no),
          f.grado,
          f.grupo,
          f.noCtrl,
          f.nombre,
          f.fechaPago || 'SIN PAGO',
          f.plan,
        ]
  )

  return { headers, rows }
}

export function reinscritosResumenATabla(resumen: ResumenReinscritosPagos) {
  return {
    headers: ['Grado', 'Pendientes', 'Pagados', 'Total'],
    rows: [
      ...resumen.resumenGrados.map((g) => [
        g.grado,
        String(g.pendientes),
        String(g.pagados),
        String(g.total),
      ]),
      [
        'Total',
        String(resumen.totalPendientes),
        String(resumen.totalPagados),
        String(resumen.totalPendientes + resumen.totalPagados),
      ],
    ],
  }
}

export async function cargarReinscritos2Pagos(
  nivel: number,
  cicloInscripcion: number
): Promise<ResumenReinscritosPagos> {
  const cea = await resolverCicloEscolarSistemaValor()
  const cicloAlumnos = cicloFichaAlumnosParaInscripcion(cicloInscripcion, cea)
  return cargarReinscritosUnion(
    nivel,
    cicloAlumnos,
    cicloInscripcion,
    'Reinscritos — 2 pagos (diferidos)',
    '2-pagos'
  )
}

export async function cargarReinscritos1Pago(
  nivel: number,
  cicloInscripcion: number
): Promise<ResumenReinscritosPagos> {
  const cea = await resolverCicloEscolarSistemaValor()
  const cicloAlumnos = cicloFichaAlumnosParaInscripcion(cicloInscripcion, cea)
  return cargarReinscritosUnion(
    nivel,
    cicloAlumnos,
    cicloInscripcion,
    'Reinscritos — 1 pago',
    '1-pago'
  )
}
