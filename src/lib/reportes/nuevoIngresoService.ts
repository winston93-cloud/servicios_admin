import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { fetchPagosPorAlumnos } from './fetchDb'
import { buscarFechaConcepto } from './pagoReporteHelpers'
import { etiquetaCicloReporte } from './renderDocument'

const REF_EXCLUIDO = '20705'

export type FilaNuevoIngreso = {
  no: number
  grado: string
  grupo: string
  noCtrl: string
  alta: string
  nombre: string
  fechaPago: string
}

export type ResumenNuevoIngreso = {
  titulo: string
  cicloAlumnos: number
  cicloPago: number
  cicloLabel: string
  nivel: number
  nivelLabel: string
  filas: FilaNuevoIngreso[]
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

  const filas: FilaNuevoIngreso[] = []
  for (const a of alumnos) {
    const fechaPago = buscarFechaConcepto(
      pagosPorAlumno.get(a.alumno_id) ?? [],
      a.alumno_ref,
      ['13'],
      cicloPago
    )
    if (modo === 'deben' && fechaPago) continue
    filas.push({
      no: filas.length + 1,
      grado: etiquetaGradoEscolar(nivel, a.alumno_grado),
      grupo: etiquetaGrupoEscolar(a.alumno_grupo),
      noCtrl: a.alumno_ref,
      alta: formatearAlta(a.alumno_alta),
      nombre: a.nombre,
      fechaPago,
    })
  }

  const titulo =
    modo === 'deben'
      ? 'Nuevo ingreso — deben inscripción'
      : 'Nuevo ingreso — reporte completo'

  return {
    titulo,
    cicloAlumnos,
    cicloPago,
    cicloLabel: etiquetaCicloReporte(cicloAlumnos),
    nivel,
    nivelLabel: etiquetaNivelEscolar(nivel),
    filas,
  }
}

export function nuevoIngresoATabla(resumen: ResumenNuevoIngreso) {
  return {
    headers: ['#', 'Grado', 'Grupo', 'No. Ctrl', 'Alta', 'Nombre', 'F. pago'],
    rows: resumen.filas.map((f) => [
      String(f.no),
      f.grado,
      f.grupo,
      f.noCtrl,
      f.alta,
      f.nombre,
      f.fechaPago,
    ]),
  }
}
