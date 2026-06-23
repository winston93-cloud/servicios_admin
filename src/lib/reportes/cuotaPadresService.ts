import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { CHUNK_ALUMNO_ID_GENERAL, PAGE_PAGO_INTERNO, chunkArray } from './dbChunks'
import { etiquetaCicloReporte } from './renderDocument'

export async function cargarCuotaPadres(cicloEscolar: number, fecha?: string) {
  const db = createDbAdmin()
  const ids = new Set<number>()
  let offset = 0

  while (true) {
    let pagosQuery = db
      .from('pago_interno')
      .select('alumno_id')
      .eq('pago_ciclo_escolar', cicloEscolar)
      .lt('concepto_id', 3)

    if (fecha) {
      pagosQuery = pagosQuery.eq('pago_fecha', fecha)
    }

    const { data: pagos, error: pErr } = await pagosQuery.range(
      offset,
      offset + PAGE_PAGO_INTERNO - 1
    )
    if (pErr) throw new Error(pErr.message)

    const chunk = pagos ?? []
    for (const p of chunk) ids.add(Number(p.alumno_id))
    if (chunk.length < PAGE_PAGO_INTERNO) break
    offset += PAGE_PAGO_INTERNO
  }

  const idList = [...ids]
  if (!idList.length) {
    return {
      titulo: fecha ? 'Cuota de padres por fecha' : 'Cuota de padres general',
      cicloLabel: etiquetaCicloReporte(cicloEscolar),
      fecha: fecha ?? '',
      filas: [],
    }
  }

  const filas: {
    no: number
    nivel: string
    grado: string
    noCtrl: string
    nombre: string
  }[] = []

  for (const slice of chunkArray(idList, CHUNK_ALUMNO_ID_GENERAL)) {
    const { data, error } = await db
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado')
      .in('alumno_id', slice)
      .gt('alumno_nivel', 2)
      .neq('alumno_status', 0)
      .order('alumno_nivel')
      .order('alumno_grado')

    if (error) throw new Error(error.message)

    for (const r of data ?? []) {
      const niv = Number(r.alumno_nivel)
      filas.push({
        no: 0,
        nivel: etiquetaNivelEscolar(niv),
        grado: etiquetaGradoEscolar(niv, Number(r.alumno_grado)),
        noCtrl: String(r.alumno_ref ?? '').trim(),
        nombre: construirNombreCompleto(r.alumno_nombre, r.alumno_app, r.alumno_apm),
      })
    }
  }

  filas.sort((a, b) => a.nivel.localeCompare(b.nivel, 'es') || a.grado.localeCompare(b.grado, 'es') || a.nombre.localeCompare(b.nombre, 'es'))
  filas.forEach((f, i) => {
    f.no = i + 1
  })

  return {
    titulo: fecha ? 'Cuota de padres por fecha' : 'Cuota de padres general',
    cicloLabel: etiquetaCicloReporte(cicloEscolar),
    fecha: fecha ?? '',
    filas,
  }
}

export function cuotaPadresATabla(resumen: Awaited<ReturnType<typeof cargarCuotaPadres>>) {
  return {
    headers: ['#', 'Nivel', 'Grado', 'No. Ctrl', 'Nombre'],
    rows: resumen.filas.map((f) => [String(f.no), f.nivel, f.grado, f.noCtrl, f.nombre]),
  }
}
