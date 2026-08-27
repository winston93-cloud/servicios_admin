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
import {
  construirHtmlReporteNacimientoSexo,
  generarPdfReporteNacimientoSexo,
} from '@/lib/reportes/nacimientoSexoDocument'
import { cargarReporteNacimientoSexo } from '@/lib/reportes/nacimientoSexoService'
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
  construirHtmlReporteNuevoIngreso,
  generarPdfReporteNuevoIngreso,
} from '@/lib/reportes/nuevoIngresoDocument'
import {
  cargarNuevoIngreso,
  aniosCalendarioDelCiclo,
  etiquetaMesAnio,
  rangoMesCalendario,
} from '@/lib/reportes/nuevoIngresoService'
import { nivelIdToValor, parseCicloParam } from '@/lib/reportes/params'
import {
  construirHtmlReporteTabla,
  generarPdfReporteTabla,
} from '@/lib/reportes/renderDocument'
import {
  cargarReinscritos1Pago,
  cargarReinscritos2Pagos,
} from '@/lib/reportes/reinscritosPagosService'
import {
  construirHtmlReporteReinscritos,
  generarPdfReporteReinscritos,
} from '@/lib/reportes/reinscritosPagosDocument'
import {
  construirHtmlCuotaInicioCurso,
  generarPdfCuotaInicioCurso,
} from '@/lib/reportes/cuotaInicioCursoDocument'
import { cargarCuotaInicioCurso } from '@/lib/reportes/cuotaInicioCursoService'
import {
  cargarSuspendidosReporte,
  cargarTalleres,
  talleresATabla,
} from '@/lib/reportes/otrosReportesService'
import {
  construirHtmlDeudoresSuspendidos,
  generarPdfDeudoresSuspendidos,
} from '@/lib/reportes/deudoresSuspendidosDocument'
import { cargarReporteBecadosConPromedio, cargarReporteBecadosSexto } from '@/lib/reporteBecadosService'
import { construirHtmlReporteBecados } from '@/lib/reporteBecadosDocument'
import { generarPdfReporteBecados } from '@/lib/reporteBecadosPdf'
import {
  resolverCicloEscolarSistemaValor,
  resolverCicloInscripcionSistemaValor,
} from '@/lib/ciclosEscolaresService'

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

async function cicloEscolarParam(searchParams: URLSearchParams): Promise<number> {
  return (
    parseCicloParam(searchParams.get('ciclo')) ?? (await resolverCicloEscolarSistemaValor())
  )
}

async function cicloInscripcionParam(searchParams: URLSearchParams): Promise<number> {
  return (
    parseCicloParam(searchParams.get('ciclo')) ?? (await resolverCicloInscripcionSistemaValor())
  )
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

async function respuestaInscripcionesAdmin(
  slug: string,
  modo: 'dif1' | 'dif2' | 'general',
  searchParams: URLSearchParams
): Promise<ReporteHandlerResult> {
  const cicloIns = await cicloInscripcionParam(searchParams)
  const format = formatoParam(searchParams)
  const resumen = await cargarMatrizInscripciones(cicloIns, modo)
  const filename = `${slug}-ciclo-${cicloIns}.pdf`
  if (format === 'pdf') {
    return { filename, pdf: generarPdfReporteInscripciones(resumen) }
  }
  return { filename, html: construirHtmlReporteInscripciones(resumen) }
}

function handlerNuevoIngreso(modo: 'completo' | 'deben'): ReporteHandler {
  return async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const format = formatoParam(searchParams)
    // Ciclo del select = ficha NI y pago de inscripción (13) del mismo ciclo.
    const ciclo = await cicloEscolarParam(searchParams)
    const resumen = await cargarNuevoIngreso(nivel, ciclo, ciclo, modo)
    const filename = `ni-${modo}-ciclo-${ciclo}.pdf`
    if (format === 'pdf') {
      return { filename, pdf: generarPdfReporteNuevoIngreso(resumen) }
    }
    return { filename, html: construirHtmlReporteNuevoIngreso(resumen) }
  }
}

async function respuestaDeudoresSuspendidos(
  slug: string,
  plantel: 1 | 2,
  tipo: 2 | 3,
  searchParams: URLSearchParams
): Promise<ReporteHandlerResult> {
  const ciclo = await cicloEscolarParam(searchParams)
  const format = formatoParam(searchParams)
  const resumen = await cargarSuspendidosReporte(plantel, ciclo, tipo)
  const filename = `${slug}-ciclo-${ciclo}.pdf`
  if (format === 'pdf') {
    return { filename, pdf: generarPdfDeudoresSuspendidos(resumen) }
  }
  return { filename, html: construirHtmlDeudoresSuspendidos(resumen) }
}

export const REPORTE_HANDLERS: Record<string, ReporteHandler> = {
  'alumnos-lista': async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const ciclo = await cicloEscolarParam(searchParams)
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
    const ciclo = await cicloEscolarParam(searchParams)
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

  'nacimiento-sexo': async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const ciclo = await cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarReporteNacimientoSexo(nivel, ciclo)
    const filename = `nacimiento-sexo-${searchParams.get('nivel') ?? 'nivel'}-ciclo-${ciclo}.pdf`
    if (format === 'pdf') {
      return { filename, pdf: generarPdfReporteNacimientoSexo(resumen) }
    }
    return { filename, html: construirHtmlReporteNacimientoSexo(resumen) }
  },

  'ni-completo': handlerNuevoIngreso('completo'),
  'ni-deben': handlerNuevoIngreso('deben'),
  // Alias de URLs anteriores (ciclo en curso / próximo)
  'ni-completo-actual': handlerNuevoIngreso('completo'),
  'ni-deben-actual': handlerNuevoIngreso('deben'),
  'ni-completo-sig': handlerNuevoIngreso('completo'),
  'ni-deben-sig': handlerNuevoIngreso('deben'),

  'reinscritos-1': async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const cicloIns = await cicloInscripcionParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarReinscritos1Pago(nivel, cicloIns)
    const filename = `reinscritos-1-${searchParams.get('nivel') ?? 'nivel'}-c${cicloIns}.${format === 'pdf' ? 'pdf' : 'html'}`
    if (format === 'pdf') {
      return { filename, pdf: generarPdfReporteReinscritos(resumen) }
    }
    return { filename, html: construirHtmlReporteReinscritos(resumen) }
  },

  'reinscritos-2': async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const cicloIns = await cicloInscripcionParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarReinscritos2Pagos(nivel, cicloIns)
    const filename = `reinscritos-2-${searchParams.get('nivel') ?? 'nivel'}-c${cicloIns}.${format === 'pdf' ? 'pdf' : 'html'}`
    if (format === 'pdf') {
      return { filename, pdf: generarPdfReporteReinscritos(resumen) }
    }
    return { filename, html: construirHtmlReporteReinscritos(resumen) }
  },

  becados: async (searchParams) => {
    const ciclo = parseCicloParam(searchParams.get('ciclo')) ?? (await resolverCicloEscolarSistemaValor())
    const format = formatoParam(searchParams)
    const nivelId = searchParams.get('nivel') || 'kinder'
    const nivelValor = nivelIdToValor(nivelId) ?? 2
    const resumen = await cargarReporteBecadosConPromedio(ciclo, nivelValor)
    const nivelSlug = nivelId
    if (format === 'pdf') {
      return {
        filename: `becados-promedio-${nivelSlug}-ciclo-${ciclo}.pdf`,
        pdf: generarPdfReporteBecados(resumen),
      }
    }
    return {
      filename: `becados-promedio-${nivelSlug}-ciclo-${ciclo}.pdf`,
      html: construirHtmlReporteBecados(resumen),
    }
  },

  'becados-sexto': async (searchParams) => {
    const ciclo = parseCicloParam(searchParams.get('ciclo')) ?? (await resolverCicloEscolarSistemaValor())
    const format = formatoParam(searchParams)
    const resumen = await cargarReporteBecadosSexto(ciclo)
    if (format === 'pdf') {
      return {
        filename: `becados-sexto-ciclo-${ciclo}.pdf`,
        pdf: generarPdfReporteBecados(resumen, { titulo: 'Becados de 6° de Primaria' }),
      }
    }
    return {
      filename: `becados-sexto-ciclo-${ciclo}.pdf`,
      html: construirHtmlReporteBecados(resumen, {
        titulo: 'Becados de 6° de Primaria',
        etiquetaTotal: 'Becados 6°',
      }),
    }
  },

  bajas: async (searchParams) => {
    const nivel = requiereNivel(searchParams)
    const ciclo = await cicloEscolarParam(searchParams)
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
    const ciclo = await cicloEscolarParam(searchParams)
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
    const ciclo = await cicloEscolarParam(searchParams)
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

  'suspendidos-iwc': (searchParams) =>
    respuestaDeudoresSuspendidos('suspendidos-iwc', 2, 3, searchParams),

  'suspendidos-iew': (searchParams) =>
    respuestaDeudoresSuspendidos('suspendidos-iew', 1, 3, searchParams),

  inscripciones: (searchParams) => respuestaInscripcionesAdmin('inscripciones', 'general', searchParams),

  'cuota-fecha': async (searchParams) => {
    const ciclo = await cicloEscolarParam(searchParams)
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

  'deudores-iew-1mes': (searchParams) =>
    respuestaDeudoresSuspendidos('deudores-iew-1mes', 1, 2, searchParams),

  'deudores-iwch-1mes': (searchParams) =>
    respuestaDeudoresSuspendidos('deudores-iwch-1mes', 2, 2, searchParams),

  'reinscritos-kinder-pend': async (searchParams) => {
    const cicloIns = await cicloInscripcionParam(searchParams)
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
    const ciclo = await cicloEscolarParam(searchParams)
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
    const cicloIns = await cicloInscripcionParam(searchParams)
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
    const ciclo = await cicloEscolarParam(searchParams)
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
    const nivel = requiereNivel(searchParams)
    const ciclo = await cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
    const now = new Date()
    const mesRaw = parseInt(searchParams.get('mes') ?? String(now.getMonth() + 1), 10)
    const mes = Number.isFinite(mesRaw) ? Math.min(12, Math.max(1, mesRaw)) : now.getMonth() + 1
    const [anioInicio, anioFin] = aniosCalendarioDelCiclo(ciclo)
    const anioRaw = parseInt(searchParams.get('anio') ?? String(now.getFullYear()), 10)
    // Solo años del ciclo (ej. 23 → 2026 o 2027). Ene–dic son de ese año calendario.
    const anio =
      Number.isFinite(anioRaw) && (anioRaw === anioInicio || anioRaw === anioFin)
        ? anioRaw
        : anioInicio
    const rango = rangoMesCalendario(mes, anio)
    const mesLabel = etiquetaMesAnio(mes, anio)
    const resumen = await cargarNuevoIngreso(nivel, ciclo, ciclo, 'completo', {
      rangoMes: rango,
      titulo: `Nuevo ingreso — ${mesLabel}`,
    })
    const filename = `ni-mes-${mes}-${anio}-ciclo-${ciclo}.pdf`
    if (format === 'pdf') {
      return { filename, pdf: generarPdfReporteNuevoIngreso(resumen) }
    }
    return { filename, html: construirHtmlReporteNuevoIngreso(resumen) }
  },

  'cuota-inicio-curso': async (searchParams) => {
    const ciclo = await cicloEscolarParam(searchParams)
    const format = formatoParam(searchParams)
    const resumen = await cargarCuotaInicioCurso(ciclo)
    const filename = `cuota-inicio-todos-niveles-ciclo-${ciclo}.pdf`
    if (format === 'pdf') {
      return { filename, pdf: generarPdfCuotaInicioCurso(resumen) }
    }
    return { filename, html: construirHtmlCuotaInicioCurso(resumen) }
  },

  'familias-winston': async (searchParams) => {
    const ciclo = await cicloEscolarParam(searchParams)
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
