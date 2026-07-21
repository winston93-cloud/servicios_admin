import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { TUTOR_ID_MADRE, TUTOR_ID_PADRE } from '@/lib/alumnoFamiliarTutor'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { CHUNK_ALUMNO_ID_GENERAL, chunkArray } from './dbChunks'
import { fetchPagosPorAlumnos } from './fetchDb'
import { buscarFechaConcepto } from './pagoReporteHelpers'
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

export async function cargarNuevoIngreso(
  nivel: number,
  cicloAlumnos: number,
  cicloPago: number,
  modo: 'completo' | 'deben'
): Promise<ResumenNuevoIngreso> {
  const alumnos = await fetchNuevoIngresoNivel(nivel, cicloAlumnos)
  const pagos = await fetchPagosPorAlumnos(alumnos.map((a) => a.alumno_id))
  const pagosPorAlumno = new Map<number, typeof pagos>()
  for (const p of pagos) {
    const list = pagosPorAlumno.get(p.alumno_id) ?? []
    list.push(p)
    pagosPorAlumno.set(p.alumno_id, list)
  }

  const familiaresPorAlumno =
    modo === 'completo'
      ? await fetchFamiliaresPorAlumnos(alumnos.map((a) => a.alumno_id))
      : new Map<number, FamiliarNuevoIngreso[]>()

  const filas: FilaNuevoIngreso[] = []
  const contadores = new Map<number, { pendientes: number; pagados: number }>()

  for (const a of alumnos) {
    const fechaPago = buscarFechaConcepto(
      pagosPorAlumno.get(a.alumno_id) ?? [],
      a.alumno_ref,
      ['13'],
      cicloPago
    )
    const pagado = Boolean(fechaPago)
    if (modo === 'deben' && pagado) continue

    const prev = contadores.get(a.alumno_grado) ?? { pendientes: 0, pagados: 0 }
    if (pagado) prev.pagados += 1
    else prev.pendientes += 1
    contadores.set(a.alumno_grado, prev)

    filas.push({
      no: filas.length + 1,
      gradoNum: a.alumno_grado,
      grado: etiquetaGradoEscolar(nivel, a.alumno_grado),
      grupo: etiquetaGrupoEscolar(a.alumno_grupo),
      noCtrl: a.alumno_ref,
      alta: formatearAlta(a.alumno_alta),
      nombre: a.nombre,
      fechaPago,
      pagado,
      familiares: familiaresPorAlumno.get(a.alumno_id) ?? [],
    })
  }

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
    modo === 'deben'
      ? 'Nuevo ingreso — deben inscripción'
      : 'Nuevo ingreso — reporte completo'

  return {
    titulo,
    modo,
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
