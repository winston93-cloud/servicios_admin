import {
  alumnosListaATabla,
  cargarAlumnosLista,
} from '@/lib/reportes/alumnosListaService'
import { bajasATabla, cargarReporteBajas } from '@/lib/reportes/bajasService'
import { curpATabla, cargarReporteCurp } from '@/lib/reportes/curpService'
import { nivelIdToValor, parseCicloParam } from '@/lib/reportes/params'
import {
  construirHtmlReporteTabla,
  generarPdfReporteTabla,
} from '@/lib/reportes/renderDocument'
import {
  cargarReinscritos1Pago,
  cargarReinscritos2Pagos,
  reinscritosPagosATabla,
} from '@/lib/reportes/reinscritosPagosService'
import { cargarReporteBecados } from '@/lib/reporteBecadosService'
import { construirHtmlReporteBecados } from '@/lib/reporteBecadosDocument'
import { generarPdfReporteBecados } from '@/lib/reporteBecadosPdf'
import {
  getCicloEscolarActual,
  getCicloInscripcion,
} from '@/lib/ciclosEscolares'
import { getCicloBecadosDefault } from '@/lib/reportesConfig'

export type ReporteFormato = 'html' | 'pdf'

export type ReporteHandlerResult = {
  html?: string
  pdf?: Buffer
  filename: string
}

type ReporteHandler = (searchParams: URLSearchParams) => Promise<ReporteHandlerResult>

function requiereNivel(searchParams: URLSearchParams): number {
  const nivel = nivelIdToValor(searchParams.get('nivel'))
  if (nivel == null) {
    throw new Error('Parámetro "nivel" requerido (maternal, kinder, primaria, secundaria).')
  }
  return nivel
}

function cicloEscolarParam(searchParams: URLSearchParams): number {
  return parseCicloParam(searchParams.get('ciclo')) ?? getCicloEscolarActual()
}

function cicloInscripcionParam(searchParams: URLSearchParams): number {
  return parseCicloParam(searchParams.get('ciclo')) ?? getCicloInscripcion()
}

function respuestaTabla(opts: {
  titulo: string
  subtitulo: string
  meta?: string
  headers: string[]
  rows: string[][]
  slug: string
  ciclo: number
  format: ReporteFormato
}): ReporteHandlerResult {
  const filename = `${opts.slug}-ciclo-${opts.ciclo}.pdf`
  if (opts.format === 'pdf') {
    return {
      filename,
      pdf: generarPdfReporteTabla({
        titulo: opts.titulo,
        subtitulo: opts.subtitulo,
        meta: opts.meta,
        headers: opts.headers,
        rows: opts.rows,
      }),
    }
  }
  return {
    filename,
    html: construirHtmlReporteTabla({
      titulo: opts.titulo,
      subtitulo: opts.subtitulo,
      meta: opts.meta,
      tablas: [{ tabla: { headers: opts.headers, rows: opts.rows } }],
    }),
  }
}

export const REPORTE_HANDLERS: Record<string, ReporteHandler> = {
  'alumnos-lista': async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const ciclo = cicloEscolarParam(searchParams)
    const format = (searchParams.get('format') ?? 'html').toLowerCase() as ReporteFormato
    const resumen = await cargarAlumnosLista(nivel, ciclo)
    const tabla = alumnosListaATabla(resumen)
    return respuestaTabla({
      titulo: 'Lista de alumnos',
      subtitulo: `${resumen.nivelLabel} · Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} alumno(s)`,
      ...tabla,
      slug: 'alumnos-lista',
      ciclo,
      format,
    })
  },

  curp: async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const ciclo = cicloEscolarParam(searchParams)
    const format = (searchParams.get('format') ?? 'html').toLowerCase() as ReporteFormato
    const resumen = await cargarReporteCurp(nivel, ciclo)
    const tabla = curpATabla(resumen)
    return respuestaTabla({
      titulo: 'Listado CURP',
      subtitulo: `${resumen.nivelLabel} · Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} registro(s)`,
      ...tabla,
      slug: 'curp',
      ciclo,
      format,
    })
  },

  bajas: async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const ciclo = cicloEscolarParam(searchParams)
    const format = (searchParams.get('format') ?? 'html').toLowerCase() as ReporteFormato
    const resumen = await cargarReporteBajas(nivel, ciclo)
    const tabla = bajasATabla(resumen)
    return respuestaTabla({
      titulo: 'Bajas por nivel',
      subtitulo: `${resumen.nivelLabel} · Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} baja(s)`,
      ...tabla,
      slug: 'bajas',
      ciclo,
      format,
    })
  },

  'reinscritos-1': async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const cicloIns = cicloInscripcionParam(searchParams)
    const format = (searchParams.get('format') ?? 'html').toLowerCase() as ReporteFormato
    const resumen = await cargarReinscritos1Pago(nivel, cicloIns)
    const tabla = reinscritosPagosATabla(resumen, false)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `${resumen.nivelLabel} · Inscripción ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} reinscrito(s)`,
      ...tabla,
      slug: 'reinscritos-1',
      ciclo: cicloIns,
      format,
    })
  },

  'reinscritos-2': async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const cicloIns = cicloInscripcionParam(searchParams)
    const format = (searchParams.get('format') ?? 'html').toLowerCase() as ReporteFormato
    const resumen = await cargarReinscritos2Pagos(nivel, cicloIns)
    const tabla = reinscritosPagosATabla(resumen, true)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `${resumen.nivelLabel} · Inscripción ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} reinscrito(s)`,
      ...tabla,
      slug: 'reinscritos-2',
      ciclo: cicloIns,
      format,
    })
  },

  becados: async (searchParams) => {
    const ciclo = parseCicloParam(searchParams.get('ciclo')) ?? getCicloBecadosDefault()
    const format = (searchParams.get('format') ?? 'html').toLowerCase() as ReporteFormato
    const resumen = await cargarReporteBecados(ciclo)
    if (format === 'pdf') {
      return {
        filename: `becados-ciclo-${ciclo}.pdf`,
        pdf: generarPdfReporteBecados(resumen),
      }
    }
    return {
      filename: `becados-ciclo-${ciclo}.pdf`,
      html: construirHtmlReporteBecados(resumen),
    }
  },
}

export const REPORTES_NATIVOS_DISPONIBLES = new Set(Object.keys(REPORTE_HANDLERS))
