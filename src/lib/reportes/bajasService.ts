import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { etiquetaCicloReporte } from './renderDocument'

export type FilaBaja = {
  no: number
  grado: string
  grupo: string
  noCtrl: string
  nombre: string
  fechaBaja: string
  email: string
}

export type ResumenBajas = {
  ciclo: number
  cicloLabel: string
  nivel: number
  nivelLabel: string
  filas: FilaBaja[]
}

function formatearFechaBaja(fecha: string | null): string {
  if (!fecha) return ''
  const d = fecha.slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return fecha
  return `${day}/${m}/${y}`
}

export async function cargarReporteBajas(
  nivel: number,
  cicloEscolar: number
): Promise<ResumenBajas> {
  const db = createDbAdmin()
  const PAGE = 500
  const out: FilaBaja[] = []
  let offset = 0

  while (true) {
    const { data, error } = await db
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_actualizacion'
      )
      .eq('alumno_nivel', nivel)
      .eq('alumno_ciclo_escolar', cicloEscolar)
      .eq('alumno_status', 0)
      .gt('alumno_grupo', 0)
      .order('alumno_grado', { ascending: true })
      .order('alumno_grupo', { ascending: true })
      .order('alumno_app', { ascending: true })
      .range(offset, offset + PAGE - 1)

    if (error) throw new Error(error.message)
    const chunk = data ?? []
    if (!chunk.length) break

    const ids = chunk.map((r) => Number(r.alumno_id))
    const emails = new Map<number, string>()

    const { data: familiares, error: famErr } = await db
      .from('alumno_familiar')
      .select('alumno_id, familiar_email')
      .in('alumno_id', ids)

    if (famErr) throw new Error(famErr.message)
    for (const f of familiares ?? []) {
      const id = Number(f.alumno_id)
      if (!emails.has(id) && f.familiar_email) {
        emails.set(id, String(f.familiar_email).trim())
      }
    }

    for (const r of chunk) {
      out.push({
        no: out.length + 1,
        grado: etiquetaGradoEscolar(Number(r.alumno_nivel), Number(r.alumno_grado)),
        grupo: etiquetaGrupoEscolar(Number(r.alumno_grupo)),
        noCtrl: String(r.alumno_ref ?? '').trim(),
        nombre: construirNombreCompleto(r.alumno_nombre, r.alumno_app, r.alumno_apm),
        fechaBaja: formatearFechaBaja(r.alumno_actualizacion as string | null),
        email: emails.get(Number(r.alumno_id)) ?? '',
      })
    }

    if (chunk.length < PAGE) break
    offset += PAGE
  }

  return {
    ciclo: cicloEscolar,
    cicloLabel: etiquetaCicloReporte(cicloEscolar),
    nivel,
    nivelLabel: etiquetaNivelEscolar(nivel),
    filas: out,
  }
}

export function bajasATabla(resumen: ResumenBajas) {
  return {
    headers: ['#', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', 'F. baja', 'Email'],
    rows: resumen.filas.map((f) => [
      String(f.no),
      f.grado,
      f.grupo,
      f.noCtrl,
      f.nombre,
      f.fechaBaja,
      f.email,
    ]),
  }
}
