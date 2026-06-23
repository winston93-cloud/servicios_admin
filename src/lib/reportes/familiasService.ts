import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { CHUNK_ALUMNO_ID_GENERAL, PAGE_ALUMNO, chunkArray } from './dbChunks'
import { etiquetaCicloReporte } from './renderDocument'

export async function cargarFamiliasWinston(cicloEscolar: number, nivel?: number) {
  const db = createDbAdmin()
  const alumnos: {
    alumno_id: number
    alumno_ref: string | null
    alumno_app: string | null
    alumno_apm: string | null
    alumno_nombre: string | null
    alumno_nivel: number
    alumno_grado: number
    alumno_grupo: number
  }[] = []
  let offset = 0

  while (true) {
    let q = db
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo')
      .eq('alumno_ciclo_escolar', cicloEscolar)
      .not('alumno_status', 'in', '(0,2)')
      .order('alumno_nivel')
      .order('alumno_grado')
      .order('alumno_grupo')

    if (nivel != null) q = q.eq('alumno_nivel', nivel)

    const { data, error } = await q.range(offset, offset + PAGE_ALUMNO - 1)
    if (error) throw new Error(error.message)
    const chunk = data ?? []
    for (const r of chunk) {
      alumnos.push({
        alumno_id: Number(r.alumno_id),
        alumno_ref: r.alumno_ref as string | null,
        alumno_app: r.alumno_app as string | null,
        alumno_apm: r.alumno_apm as string | null,
        alumno_nombre: r.alumno_nombre as string | null,
        alumno_nivel: Number(r.alumno_nivel),
        alumno_grado: Number(r.alumno_grado),
        alumno_grupo: Number(r.alumno_grupo),
      })
    }
    if (chunk.length < PAGE_ALUMNO) break
    offset += PAGE_ALUMNO
  }

  const ids = alumnos.map((a) => a.alumno_id)
  const familiaPorAlumno = new Map<number, string>()

  for (const slice of chunkArray(ids, CHUNK_ALUMNO_ID_GENERAL)) {
    const { data: familiares } = await db
      .from('alumno_familiar')
      .select('alumno_id, familiar_cel, familiar_curp, tutor_id')
      .in('alumno_id', slice)
      .in('tutor_id', [1, 2])

    for (const f of familiares ?? []) {
      const id = Number(f.alumno_id)
      if (familiaPorAlumno.has(id)) continue
      const cel = String(f.familiar_cel ?? '').trim()
      const curp = String(f.familiar_curp ?? '').trim()
      familiaPorAlumno.set(id, cel || curp || `SIN_DATOS_${id}`)
    }
  }

  const alumnosPorFamilia = new Map<string, typeof alumnos>()
  for (const a of alumnos) {
    const fam = familiaPorAlumno.get(Number(a.alumno_id)) ?? `SIN_DATOS_${a.alumno_id}`
    const list = alumnosPorFamilia.get(fam) ?? []
    list.push(a)
    alumnosPorFamilia.set(fam, list)
  }

  const filas = alumnos.map((r, idx) => {
    const alumnoId = Number(r.alumno_id)
    const fam = familiaPorAlumno.get(alumnoId) ?? `SIN_DATOS_${alumnoId}`
    const hermanos = (alumnosPorFamilia.get(fam) ?? [])
      .filter((h) => Number(h.alumno_id) !== alumnoId)
      .map((h) => {
        const niv = Number(h.alumno_nivel)
        const nom = construirNombreCompleto(
          h.alumno_nombre ?? '',
          h.alumno_app ?? '',
          h.alumno_apm ?? ''
        )
        const gr = etiquetaGradoEscolar(niv, Number(h.alumno_grado))
        const gp = etiquetaGrupoEscolar(Number(h.alumno_grupo))
        return `${nom} (${gr} ${gp})`
      })
      .join('; ')

    const niv = Number(r.alumno_nivel)
    return {
      no: idx + 1,
      nivel: etiquetaNivelEscolar(niv),
      grado: etiquetaGradoEscolar(niv, Number(r.alumno_grado)),
      grupo: etiquetaGrupoEscolar(Number(r.alumno_grupo)),
      noCtrl: String(r.alumno_ref ?? '').trim(),
      nombre: construirNombreCompleto(
        r.alumno_nombre ?? '',
        r.alumno_app ?? '',
        r.alumno_apm ?? ''
      ),
      hermanos: hermanos || '-',
    }
  })

  return {
    titulo: 'Familias Winston',
    cicloLabel: etiquetaCicloReporte(cicloEscolar),
    filas,
  }
}

export function familiasATabla(resumen: Awaited<ReturnType<typeof cargarFamiliasWinston>>) {
  return {
    headers: ['#', 'Nivel', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', 'Hermanos'],
    rows: resumen.filas.map((f) => [
      String(f.no),
      f.nivel,
      f.grado,
      f.grupo,
      f.noCtrl,
      f.nombre,
      f.hermanos,
    ]),
  }
}
