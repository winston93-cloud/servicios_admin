import {
  alumnosListaATabla,
  cargarAlumnosLista,
} from '@/lib/reportes/alumnosListaService'
import { bajasATabla, cargarReporteBajas } from '@/lib/reportes/bajasService'
import {
  cambridgeATabla,
  cargarReporteCambridge,
  cargarReporteDoble,
  dobleATabla,
} from '@/lib/reportes/cambridgeDobleService'
import {
  cargarReporteConceptoUnion,
  cargarKinderSinPago,
  cargarReporteEms,
  conceptoPagoATabla,
} from '@/lib/reportes/conceptoPagoService'
import { curpATabla, cargarReporteCurp } from '@/lib/reportes/curpService'
import { cuotaPadresATabla, cargarCuotaPadres } from '@/lib/reportes/cuotaPadresService'
import { cargarFamiliasWinston, familiasATabla } from '@/lib/reportes/familiasService'
import {
  cargarMatrizInscripciones,
} from '@/lib/reportes/inscripcionesAdminService'
import {
  construirHtmlReporteInscripciones,
  generarPdfReporteInscripciones,
} from '@/lib/reportes/inscripcionesAdminDocument'
import {
  cargarNuevoIngreso,
  nuevoIngresoATabla,
} from '@/lib/reportes/nuevoIngresoService'
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
import {
  cargarNuevoIngresoMes,
  cargarSuspendidosReporte,
  cargarTalleres,
  nuevoIngresoMesATabla,
  suspendidosATabla,
  talleresATabla,
} from '@/lib/reportes/otrosReportesService'
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

function formatoParam(searchParams: URLSearchParams): ReporteFormato {
  return (searchParams.get('format') ?? 'html').toLowerCase() === 'pdf' ? 'pdf' : 'html'
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

function respuestaInscripcionesAdmin(
  slug: string,
  modo: 'dif1' | 'dif2' | 'general',
  searchParams: URLSearchParams
): Promise<ReporteHandlerResult> {
  const cicloIns = cicloInscripcionParam(searchParams)
  const format = formatoParam(searchParams)
  return cargarMatrizInscripciones(cicloIns, modo).then((resumen) => {
    const filename = `${slug}-ciclo-${cicloIns}.pdf`
    if (format === 'pdf') {
      return { filename, pdf: generarPdfReporteInscripciones(resumen) }
    }
    return { filename, html: construirHtmlReporteInscripciones(resumen) }
  })
}

function handlerNuevoIngreso(modo: 'completo' | 'deben', ambito: 'actual' | 'siguiente'): ReporteHandler {
  return async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const format = formatoParam(searchParams)
    const cicloPago =
      ambito === 'actual' ? cicloEscolarParam(searchParams) : cicloInscripcionParam(searchParams)
    const cicloAlumnos = cicloPago
    const resumen = await cargarNuevoIngreso(nivel, cicloAlumnos, cicloPago, modo)
    const tabla = nuevoIngresoATabla(resumen)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `${resumen.nivelLabel} · Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} alumno(s)`,
      ...tabla,
      slug: `ni-${modo}-${ambito}`,
      ciclo: cicloPago,
      format,
    })
  }
}

export const REPORTE_HANDLERS: Record<string, ReporteHandler> = {
  'alumnos-lista': async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const ciclo = cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
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
    const format = formatoParam(searchParams)
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

  'ni-completo-actual': handlerNuevoIngreso('completo', 'actual'),
  'ni-deben-actual': handlerNuevoIngreso('deben', 'actual'),
  'ni-completo-sig': handlerNuevoIngreso('completo', 'siguiente'),
  'ni-deben-sig': handlerNuevoIngreso('deben', 'siguiente'),

  'reinscritos-1': async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const cicloIns = cicloInscripcionParam(searchParams)
    const format = formatoParam(searchParams)
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
    const format = formatoParam(searchParams)
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
    const format = formatoParam(searchParams)
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

  bajas: async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const ciclo = cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
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

  cambridge: async (searchParams) => {
    const ciclo = cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarReporteCambridge(ciclo)
    const tabla = cambridgeATabla(resumen)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `Secundaria · Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} alumno(s)`,
      ...tabla,
      slug: 'cambridge',
      ciclo,
      format,
    })
  },

  talleres: async (searchParams) => {
    const ciclo = cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarTalleres(ciclo)
    const tabla = talleresATabla(resumen)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `Ciclo ${resumen.cicloLabel}`,
      meta: resumen.aviso ?? `${resumen.filas.length} inscripción(es)`,
      ...tabla,
      slug: 'talleres',
      ciclo,
      format,
    })
  },

  'suspendidos-iwc': async (searchParams) => {
    const ciclo = cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarSuspendidosReporte(2, ciclo, 3)
    const tabla = suspendidosATabla(resumen)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} deudor(es) · ${resumen.totalRevisados} revisados`,
      ...tabla,
      slug: 'suspendidos-iwc',
      ciclo,
      format,
    })
  },

  'suspendidos-iew': async (searchParams) => {
    const ciclo = cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarSuspendidosReporte(1, ciclo, 3)
    const tabla = suspendidosATabla(resumen)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} deudor(es) · ${resumen.totalRevisados} revisados`,
      ...tabla,
      slug: 'suspendidos-iew',
      ciclo,
      format,
    })
  },

  inscripciones: (searchParams) => respuestaInscripcionesAdmin('inscripciones', 'general', searchParams),

  'cuota-fecha': async (searchParams) => {
    const ciclo = cicloEscolarParam(searchParams)
    const fecha = searchParams.get('fecha')?.trim() || new Date().toISOString().slice(0, 10)
    const format = formatoParam(searchParams)
    const resumen = await cargarCuotaPadres(ciclo, fecha)
    const tabla = cuotaPadresATabla(resumen)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `Ciclo ${resumen.cicloLabel} · ${fecha}`,
      meta: `${resumen.filas.length} pago(s)`,
      ...tabla,
      slug: 'cuota-fecha',
      ciclo,
      format,
    })
  },

  'deudores-iew-1mes': async (searchParams) => {
    const ciclo = cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarSuspendidosReporte(1, ciclo, 2)
    const tabla = suspendidosATabla(resumen)
    return respuestaTabla({
      titulo: 'Deudores 1 mes — IEW',
      subtitulo: `Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} deudor(es)`,
      ...tabla,
      slug: 'deudores-iew-1mes',
      ciclo,
      format,
    })
  },

  'deudores-iwch-1mes': async (searchParams) => {
    const ciclo = cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarSuspendidosReporte(2, ciclo, 2)
    const tabla = suspendidosATabla(resumen)
    return respuestaTabla({
      titulo: 'Deudores 1 mes — IWCH',
      subtitulo: `Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} deudor(es)`,
      ...tabla,
      slug: 'deudores-iwch-1mes',
      ciclo,
      format,
    })
  },

  'reinscritos-kinder-pend': async (searchParams) => {
    const cicloIns = cicloInscripcionParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarKinderSinPago(cicloIns - 1, cicloIns)
    const tabla = conceptoPagoATabla(resumen, false)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `Kinder · Inscripción ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} alumno(s)`,
      ...tabla,
      slug: 'reinscritos-kinder-pend',
      ciclo: cicloIns,
      format,
    })
  },

  'cuota-padres-general': async (searchParams) => {
    const ciclo = cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarCuotaPadres(ciclo)
    const tabla = cuotaPadresATabla(resumen)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} registro(s)`,
      ...tabla,
      slug: 'cuota-padres-general',
      ciclo,
      format,
    })
  },

  'insc-admin-dif1': (searchParams) =>
    respuestaInscripcionesAdmin('insc-admin-dif1', 'dif1', searchParams),

  'insc-admin-dif2': (searchParams) =>
    respuestaInscripcionesAdmin('insc-admin-dif2', 'dif2', searchParams),

  ems: async (searchParams) => {
    const cicloIns = cicloInscripcionParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarReporteEms(cicloIns)
    const tabla = conceptoPagoATabla(resumen)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `Inscripción ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} alumno(s)`,
      ...tabla,
      slug: 'ems',
      ciclo: cicloIns,
      format,
    })
  },

  'doble-titulacion': async (searchParams) => {
    const ciclo = cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarReporteDoble(ciclo)
    const tabla = dobleATabla(resumen)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} alumno(s)`,
      ...tabla,
      slug: 'doble-titulacion',
      ciclo,
      format,
    })
  },

  'nuevo-ingreso-mes': async (searchParams) => {
    const ciclo = cicloEscolarParam(searchParams)
    const now = new Date()
    const mes = parseInt(searchParams.get('mes') ?? String(now.getMonth() + 1), 10)
    const anio = parseInt(searchParams.get('anio') ?? String(now.getFullYear()), 10)
    const nivel = nivelIdToValor(searchParams.get('nivel'))
    const format = formatoParam(searchParams)
    const resumen = await cargarNuevoIngresoMes(ciclo, mes, anio, nivel ?? undefined)
    const tabla = nuevoIngresoMesATabla(resumen)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} alumno(s)`,
      ...tabla,
      slug: 'nuevo-ingreso-mes',
      ciclo,
      format,
    })
  },

  'familias-winston': async (searchParams) => {
    const ciclo = cicloEscolarParam(searchParams)
    const nivel = nivelIdToValor(searchParams.get('nivel'))
    const format = formatoParam(searchParams)
    const resumen = await cargarFamiliasWinston(ciclo, nivel ?? undefined)
    const tabla = familiasATabla(resumen)
    return respuestaTabla({
      titulo: resumen.titulo,
      subtitulo: `Ciclo ${resumen.cicloLabel}`,
      meta: `${resumen.filas.length} alumno(s)`,
      ...tabla,
      slug: 'familias-winston',
      ciclo,
      format,
    })
  },
}

export const REPORTES_NATIVOS_DISPONIBLES = new Set(Object.keys(REPORTE_HANDLERS))
