import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { fetchPagosPorAlumnos } from './fetchDb'
import { pagosConceptoBloque, tieneConceptoEnCiclo } from './pagoReporteHelpers'
import { etiquetaCicloReporte } from './renderDocument'

export type FilaCambridge = {
  no: number
  grado: string
  grupo: string
  noCtrl: string
  nombre: string
  pagosCambridge: string
}

export async function cargarReporteCambridge(cicloEscolar: number) {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo')
    .eq('alumno_ciclo_escolar', cicloEscolar)
    .eq('alumno_nivel', 4)
    .lt('alumno_grado', 4)
    .not('alumno_status', 'in', '(0,2)')

  if (error) throw new Error(error.message)

  const alumnos = (data ?? []).filter((r) => {
    // filtro inscripción pagada 12/13 en PHP via join — aplicamos después con pagos
    return true
  })

  const ids = alumnos.map((r) => Number(r.alumno_id))
  const pagos = await fetchPagosPorAlumnos(ids)
  const pagosPorAlumno = new Map<number, typeof pagos>()
  for (const p of pagos) {
    const list = pagosPorAlumno.get(p.alumno_id) ?? []
    list.push(p)
    pagosPorAlumno.set(p.alumno_id, list)
  }

  const filas: FilaCambridge[] = []
  for (const r of alumnos) {
    const ref = String(r.alumno_ref ?? '').trim()
    const vigentes = pagosPorAlumno.get(Number(r.alumno_id)) ?? []
    const inscrito =
      tieneConceptoEnCiclo(vigentes, ref, ['12', '13'], cicloEscolar)
    if (!inscrito) continue

    const hits = pagosConceptoBloque(vigentes, ref, ['19', '20', '22'], cicloEscolar)
    const pagosTxt = hits.map((h) => `${h.concepto} ${h.fecha} $${h.importe}`).join('; ')

    filas.push({
      no: filas.length + 1,
      grado: etiquetaGradoEscolar(4, Number(r.alumno_grado)),
      grupo: etiquetaGrupoEscolar(Number(r.alumno_grupo)),
      noCtrl: ref,
      nombre: construirNombreCompleto(r.alumno_nombre, r.alumno_app, r.alumno_apm),
      pagosCambridge: pagosTxt,
    })
  }

  return {
    titulo: 'Reporte Cambridge',
    cicloLabel: etiquetaCicloReporte(cicloEscolar),
    filas,
  }
}

export function cambridgeATabla(resumen: Awaited<ReturnType<typeof cargarReporteCambridge>>) {
  return {
    headers: ['#', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', 'Pagos Cambridge'],
    rows: resumen.filas.map((f) => [
      String(f.no),
      f.grado,
      f.grupo,
      f.noCtrl,
      f.nombre,
      f.pagosCambridge,
    ]),
  }
}

export async function cargarReporteDoble(cicloEscolar: number) {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo')
    .eq('alumno_ciclo_escolar', cicloEscolar)
    .gte('alumno_nivel', 2)
    .not('alumno_status', 'in', '(0,2)')

  if (error) throw new Error(error.message)

  const pagos = await fetchPagosPorAlumnos((data ?? []).map((r) => Number(r.alumno_id)))
  const pagosPorAlumno = new Map<number, typeof pagos>()
  for (const p of pagos) {
    const list = pagosPorAlumno.get(p.alumno_id) ?? []
    list.push(p)
    pagosPorAlumno.set(p.alumno_id, list)
  }

  const filas: { no: number; nivel: string; grado: string; grupo: string; noCtrl: string; nombre: string; pagos: string }[] = []

  for (const r of data ?? []) {
    const ref = String(r.alumno_ref ?? '').trim()
    const vigentes = pagosPorAlumno.get(Number(r.alumno_id)) ?? []
    if (!tieneConceptoEnCiclo(vigentes, ref, ['12', '13'], cicloEscolar)) continue

    const hits = pagosConceptoBloque(vigentes, ref, ['23', '24', '25'], cicloEscolar)
    if (!hits.length) continue

    const nivel = Number(r.alumno_nivel)
    filas.push({
      no: filas.length + 1,
      nivel: nivel === 2 ? 'Kinder' : nivel === 3 ? 'Primaria' : nivel === 4 ? 'Secundaria' : String(nivel),
      grado: etiquetaGradoEscolar(nivel, Number(r.alumno_grado)),
      grupo: etiquetaGrupoEscolar(Number(r.alumno_grupo)),
      noCtrl: ref,
      nombre: construirNombreCompleto(r.alumno_nombre, r.alumno_app, r.alumno_apm),
      pagos: hits.map((h) => `${h.concepto} ${h.fecha}`).join('; '),
    })
  }

  return {
    titulo: 'Doble titulación',
    cicloLabel: etiquetaCicloReporte(cicloEscolar),
    filas,
  }
}

export function dobleATabla(resumen: Awaited<ReturnType<typeof cargarReporteDoble>>) {
  return {
    headers: ['#', 'Nivel', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', 'Pagos'],
    rows: resumen.filas.map((f) => [
      String(f.no),
      f.nivel,
      f.grado,
      f.grupo,
      f.noCtrl,
      f.nombre,
      f.pagos,
    ]),
  }
}
