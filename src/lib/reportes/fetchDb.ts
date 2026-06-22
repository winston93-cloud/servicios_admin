import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'

const PAGE = 500

export type AlumnoReporteRow = {
  alumno_id: number
  alumno_ref: string
  nombre: string
  alumno_nivel: number
  alumno_grado: number
  alumno_grupo: number
  alumno_status: number
  alumno_nuevo_ingreso: number
  mes: number | null
  alumno_ciclo_escolar: number
}

export type PagoReporteRow = {
  alumno_id: number
  pago_referencia: string | null
  pago_fecha: string | null
  pago_importe: number | null
  pago_cancelado: number | null
}

export async function fetchAlumnosReinscritos(
  nivel: number,
  cicloEscolar: number
): Promise<AlumnoReporteRow[]> {
  const db = createDbAdmin()
  const out: AlumnoReporteRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await db
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_nuevo_ingreso, mes, alumno_ciclo_escolar'
      )
      .eq('alumno_nivel', nivel)
      .eq('alumno_ciclo_escolar', cicloEscolar)
      .eq('alumno_nuevo_ingreso', 0)
      .not('alumno_status', 'in', '(0,2)')
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
        alumno_nivel: Number(r.alumno_nivel),
        alumno_grado: Number(r.alumno_grado),
        alumno_grupo: Number(r.alumno_grupo),
        alumno_status: Number(r.alumno_status),
        alumno_nuevo_ingreso: Number(r.alumno_nuevo_ingreso),
        mes: r.mes == null ? null : Number(r.mes),
        alumno_ciclo_escolar: Number(r.alumno_ciclo_escolar),
      })
    }
    if (chunk.length < PAGE) break
    offset += PAGE
  }

  return out
}

export async function fetchAlumnosActivosNivel(
  nivel: number,
  cicloEscolar: number
): Promise<AlumnoReporteRow[]> {
  const db = createDbAdmin()
  const out: AlumnoReporteRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await db
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_nuevo_ingreso, mes, alumno_ciclo_escolar'
      )
      .eq('alumno_nivel', nivel)
      .eq('alumno_ciclo_escolar', cicloEscolar)
      .not('alumno_status', 'in', '(0,2)')
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
        alumno_nivel: Number(r.alumno_nivel),
        alumno_grado: Number(r.alumno_grado),
        alumno_grupo: Number(r.alumno_grupo),
        alumno_status: Number(r.alumno_status),
        alumno_nuevo_ingreso: Number(r.alumno_nuevo_ingreso ?? 0),
        mes: r.mes == null ? null : Number(r.mes),
        alumno_ciclo_escolar: Number(r.alumno_ciclo_escolar),
      })
    }
    if (chunk.length < PAGE) break
    offset += PAGE
  }

  return out
}

export async function fetchPagosPorAlumnos(
  alumnoIds: number[]
): Promise<PagoReporteRow[]> {
  if (!alumnoIds.length) return []
  const db = createDbAdmin()
  const out: PagoReporteRow[] = []
  const chunkSize = 120

  for (let i = 0; i < alumnoIds.length; i += chunkSize) {
    const ids = alumnoIds.slice(i, i + chunkSize)
    const { data, error } = await db
      .from('pago_detalle')
      .select('alumno_id, pago_referencia, pago_fecha, pago_importe, pago_cancelado')
      .in('alumno_id', ids)

    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      out.push({
        alumno_id: Number(r.alumno_id),
        pago_referencia: r.pago_referencia as string | null,
        pago_fecha: r.pago_fecha as string | null,
        pago_importe: r.pago_importe == null ? null : Number(r.pago_importe),
        pago_cancelado: r.pago_cancelado == null ? null : Number(r.pago_cancelado),
      })
    }
  }

  return out
}
