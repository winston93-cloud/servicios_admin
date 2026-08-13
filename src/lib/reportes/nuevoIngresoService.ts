import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { TUTOR_ID_MADRE, TUTOR_ID_PADRE } from '@/lib/alumnoFamiliarTutor'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { mapaFechaAgendaPorAlumnoRef } from '@/lib/admissionInsforgeAdmin'
import { CHUNK_ALUMNO_ID_GENERAL, chunkArray } from './dbChunks'
import { fetchPagosPorAlumnos } from './fetchDb'
import { buscarFechaConcepto, buscarFechaConceptoEnRango } from './pagoReporteHelpers'
import { etiquetaCicloReporte } from './renderDocument'

const REF_EXCLUIDO = '20705'

export type FamiliarNuevoIngreso = {
  rol: 'Mamá' | 'Papá'
  nombre: string
  cel: string
  email: string
}

export type FilaNuevoIngreso = {
  no: number
  gradoNum: number
  grado: string
  grupo: string
  noCtrl: string
  alta: string
  nombre: string
  fechaPago: string
  pagado: boolean
  familiares: FamiliarNuevoIngreso[]
}

export type ResumenGradoNuevoIngreso = {
  gradoNum: number
  grado: string
  pendientes: number
  pagados: number
  total: number
}

export type ResumenNuevoIngreso = {
  titulo: string
  modo: 'completo' | 'deben'
  /** true = reporte mensual filtrado por fecha de cita/agenda. */
  porAgenda?: boolean
  cicloAlumnos: number
  cicloPago: number
  cicloLabel: string
  nivel: number
  nivelLabel: string
  filas: FilaNuevoIngreso[]
  resumenGrados: ResumenGradoNuevoIngreso[]
  totalPendientes: number
  totalPagados: number
}

function formatearAlta(alta: string | null): string {
  if (!alta) return ''
  return alta.slice(0, 10)
}

async function fetchNuevoIngresoNivel(
  nivel: number,
  cicloAlumnos: number
): Promise<
  {
    alumno_id: number
    alumno_ref: string
    nombre: string
    alumno_grado: number
    alumno_grupo: number
    alumno_alta: string | null
  }[]
> {
  const db = createDbAdmin()
  const out: {
    alumno_id: number
    alumno_ref: string
    nombre: string
    alumno_grado: number
    alumno_grupo: number
    alumno_alta: string | null
  }[] = []
  let offset = 0
  const PAGE = 400

  while (true) {
    const { data, error } = await db
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_alta'
      )
      .eq('alumno_nivel', nivel)
      .eq('alumno_ciclo_escolar', cicloAlumnos)
      .eq('alumno_nuevo_ingreso', 1)
      .neq('alumno_status', 0)
      .neq('alumno_ref', REF_EXCLUIDO)
      .order('alumno_grado', { ascending: true })
      .order('alumno_grupo', { ascending: true })
      .order('alumno_app', { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (error) throw new Error(error.message)
    const chunk = data ?? []
    for (const r of chunk) {
      out.push({
        alumno_id: Number(r.alumno_id),
        alumno_ref: String(r.alumno_ref ?? '').trim(),
        nombre: construirNombreCompleto(r.alumno_nombre, r.alumno_app, r.alumno_apm),
        alumno_grado: Number(r.alumno_grado),
        alumno_grupo: Number(r.alumno_grupo),
        alumno_alta: r.alumno_alta as string | null,
      })
    }
    if (chunk.length < PAGE) break
    offset += PAGE
  }

  return out
}

async function fetchFamiliaresPorAlumnos(
  alumnoIds: number[]
): Promise<Map<number, FamiliarNuevoIngreso[]>> {
  const db = createDbAdmin()
  const porAlumno = new Map<number, FamiliarNuevoIngreso[]>()

  for (const slice of chunkArray(alumnoIds, CHUNK_ALUMNO_ID_GENERAL)) {
    const { data, error } = await db
      .from('alumno_familiar')
      .select(
        'alumno_id, tutor_id, familiar_nombre, familiar_app, familiar_apm, familiar_cel, familiar_email'
      )
      .in('alumno_id', slice)
      .in('tutor_id', [TUTOR_ID_MADRE, TUTOR_ID_PADRE])
      .order('tutor_id', { ascending: true })

    if (error) throw new Error(error.message)

    for (const r of data ?? []) {
      const id = Number(r.alumno_id)
      const tutorId = Number(r.tutor_id)
      const rol: FamiliarNuevoIngreso['rol'] =
        tutorId === TUTOR_ID_PADRE ? 'Papá' : 'Mamá'
      const nombre = construirNombreCompleto(
        r.familiar_nombre,
        r.familiar_app,
        r.familiar_apm
      ).trim()
      const cel = String(r.familiar_cel ?? '').trim()
      const email = String(r.familiar_email ?? '').trim()
      if (!nombre && !cel && !email) continue

      const list = porAlumno.get(id) ?? []
      if (list.some((f) => f.rol === rol)) continue
      list.push({ rol, nombre, cel, email })
      porAlumno.set(id, list)
    }
  }

  return porAlumno
}

const CONCEPTOS_INSCRIPCION_NUEVO = ['13'] as const

export async function cargarNuevoIngreso(
  nivel: number,
  cicloAlumnos: number,
  cicloPago: number,
  modo: 'completo' | 'deben',
  opts?: {
    /**
     * Solo alumnos con pago de inscripción (concepto 13) en el rango.
     * La columna Alta sigue siendo alumno_alta real.
     */
    rangoPago?: { desde: string; hasta: string }
    /**
     * Solo alumnos cuya fecha de agenda/alta (`alumno_alta`) cae en el rango.
     * No exige pago; la columna F. pago sigue mostrando si ya cubrieron inscripción.
     */
    rangoAgenda?: { desde: string; hasta: string }
    /** Título override (ej. reporte por mes). */
    titulo?: string
  }
): Promise<ResumenNuevoIngreso> {
  const alumnos = await fetchNuevoIngresoNivel(nivel, cicloAlumnos)
  const pagos = await fetchPagosPorAlumnos(alumnos.map((a) => a.alumno_id))
  const pagosPorAlumno = new Map<number, typeof pagos>()
  for (const p of pagos) {
    const list = pagosPorAlumno.get(p.alumno_id) ?? []
    list.push(p)
    pagosPorAlumno.set(p.alumno_id, list)
  }

  const agendaDesde = opts?.rangoAgenda?.desde?.slice(0, 10) ?? null
  const agendaHasta = opts?.rangoAgenda?.hasta?.slice(0, 10) ?? null
  const fechasAgenda =
    agendaDesde && agendaHasta
      ? await mapaFechaAgendaPorAlumnoRef({
          nivel,
          desde: agendaDesde,
          hasta: agendaHasta,
        })
      : null

  const filasBase: (Omit<FilaNuevoIngreso, 'no' | 'familiares'> & {
    alumno_id: number
  })[] = []
  const contadores = new Map<number, { pendientes: number; pagados: number }>()

  for (const a of alumnos) {
    const alta = formatearAlta(a.alumno_alta)
    const refNum = Number(a.alumno_ref)
    const fechaAgendaCita =
      fechasAgenda && Number.isFinite(refNum) ? fechasAgenda.get(refNum) ?? null : null

    // Por mes: preferir fecha de cita AgendaW; si no hay vínculo, usar alumno_alta.
    if (agendaDesde && agendaHasta) {
      if (fechasAgenda) {
        // Con AgendaW configurado: solo quienes agendaron cita en el mes.
        if (!fechaAgendaCita) continue
      } else if (!alta || alta < agendaDesde || alta > agendaHasta) {
        continue
      }
    }

    const pagosAlumno = pagosPorAlumno.get(a.alumno_id) ?? []
    const fechaPago = opts?.rangoPago
      ? buscarFechaConceptoEnRango(
          pagosAlumno,
          a.alumno_ref,
          [...CONCEPTOS_INSCRIPCION_NUEVO],
          cicloPago,
          opts.rangoPago
        )
      : buscarFechaConcepto(
          pagosAlumno,
          a.alumno_ref,
          [...CONCEPTOS_INSCRIPCION_NUEVO],
          cicloPago
        )

    // Por mes (modo pago legacy): solo quienes pagaron inscripción en ese mes.
    if (opts?.rangoPago && !fechaPago) continue

    const pagado = Boolean(fechaPago)
    if (modo === 'deben' && pagado) continue

    const prev = contadores.get(a.alumno_grado) ?? { pendientes: 0, pagados: 0 }
    if (pagado) prev.pagados += 1
    else prev.pendientes += 1
    contadores.set(a.alumno_grado, prev)

    filasBase.push({
      alumno_id: a.alumno_id,
      gradoNum: a.alumno_grado,
      grado: etiquetaGradoEscolar(nivel, a.alumno_grado),
      grupo: etiquetaGrupoEscolar(a.alumno_grupo),
      noCtrl: a.alumno_ref,
      // En reporte por mes mostrar la fecha de agenda cuando exista.
      alta: fechaAgendaCita || alta,
      nombre: a.nombre,
      fechaPago,
      pagado,
    })
  }

  const familiaresPorAlumno =
    modo === 'completo'
      ? await fetchFamiliaresPorAlumnos(filasBase.map((f) => f.alumno_id))
      : new Map<number, FamiliarNuevoIngreso[]>()

  const filas: FilaNuevoIngreso[] = filasBase.map(({ alumno_id, ...f }, i) => ({
    ...f,
    no: i + 1,
    familiares: familiaresPorAlumno.get(alumno_id) ?? [],
  }))

  const resumenGrados: ResumenGradoNuevoIngreso[] = [...contadores.entries()]
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

  const titulo =
    opts?.titulo ??
    (modo === 'deben'
      ? 'Nuevo ingreso — deben inscripción'
      : 'Nuevo ingreso — reporte completo')

  return {
    titulo,
    modo,
    porAgenda: Boolean(opts?.rangoAgenda),
    cicloAlumnos,
    cicloPago,
    cicloLabel: etiquetaCicloReporte(cicloAlumnos),
    nivel,
    nivelLabel: etiquetaNivelEscolar(nivel),
    filas,
    resumenGrados,
    totalPendientes,
    totalPagados,
  }
}

const MESES_ES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

/** Rango calendario del mes para filtrar pago_fecha. */
export function rangoMesCalendario(mes: number, anio: number): { desde: string; hasta: string } {
  const m = Math.min(12, Math.max(1, Math.floor(mes)))
  const y = Math.floor(anio)
  const desde = `${y}-${String(m).padStart(2, '0')}-01`
  const ultimo = new Date(y, m, 0).getDate()
  // Incluye todo el último día si pago_fecha es datetime.
  const hasta = `${y}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')} 23:59:59`
  return { desde, hasta }
}

export function etiquetaMesAnio(mes: number, anio: number): string {
  const m = Math.min(12, Math.max(1, Math.floor(mes)))
  return `${MESES_ES[m]} ${Math.floor(anio)}`
}

/**
 * Años calendario del ciclo escolar (N → N+2003 y N+2004).
 * Ej. ciclo 23 = 2026-2027 → [2026, 2027].
 */
export function aniosCalendarioDelCiclo(cicloValor: number): [number, number] {
  const inicio = Math.floor(cicloValor) + 2003
  return [inicio, inicio + 1]
}

/**
 * @deprecated Preferir año explícito del select (solo años del ciclo).
 * Año implícito por mes dentro del ciclo (ago→inicio, ene–jul→fin).
 */
export function anioCalendarioMesEnCiclo(mes: number, cicloValor: number): number {
  const m = Math.min(12, Math.max(1, Math.floor(mes)))
  const [inicio, fin] = aniosCalendarioDelCiclo(cicloValor)
  return m >= 8 ? inicio : fin
}

/** Tabla plana (compat); el render legacy usa construirHtml/PdfNuevoIngreso. */
export function nuevoIngresoATabla(resumen: ResumenNuevoIngreso) {
  if (resumen.modo === 'deben') {
    return {
      headers: ['#', 'Grado', 'No. Ctrl', 'Alta', 'Nombre'],
      rows: resumen.filas.map((f) => [
        String(f.no),
        f.grado,
        f.noCtrl,
        f.alta,
        f.nombre,
      ]),
    }
  }

  return {
    headers: [
      '#',
      'Grado',
      'No. Ctrl',
      'Alta',
      'Nombre',
      'F. pago',
      'Mamá',
      'Cel mamá',
      'Email mamá',
      'Papá',
      'Cel papá',
      'Email papá',
    ],
    rows: resumen.filas.map((f) => {
      const mama = f.familiares.find((x) => x.rol === 'Mamá')
      const papa = f.familiares.find((x) => x.rol === 'Papá')
      return [
        String(f.no),
        f.grado,
        f.noCtrl,
        f.alta,
        f.nombre,
        f.fechaPago,
        mama?.nombre ?? '',
        mama?.cel ?? '',
        mama?.email ?? '',
        papa?.nombre ?? '',
        papa?.cel ?? '',
        papa?.email ?? '',
      ]
    }),
  }
}

export function nuevoIngresoResumenATabla(resumen: ResumenNuevoIngreso) {
  if (resumen.modo === 'deben') {
    return {
      headers: ['Grado', 'Pendientes'],
      rows: [
        ...resumen.resumenGrados.map((g) => [g.grado, String(g.pendientes)]),
        ['Total', String(resumen.totalPendientes)],
      ],
    }
  }

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
