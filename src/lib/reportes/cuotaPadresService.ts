import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { etiquetaCicloReporte } from './renderDocument'

export async function cargarCuotaPadres(cicloEscolar: number, fecha?: string) {
  const db = createDbAdmin()

  let pagosQuery = db
    .from('pago_interno')
    .select('alumno_id')
    .eq('pago_ciclo_escolar', cicloEscolar)
    .lt('concepto_id', 3)

  if (fecha) {
    pagosQuery = pagosQuery.eq('pago_fecha', fecha)
  }

  const { data: pagos, error: pErr } = await pagosQuery
  if (pErr) throw new Error(pErr.message)

  const ids = [...new Set((pagos ?? []).map((p) => Number(p.alumno_id)))]
  if (!ids.length) {
    return {
      titulo: fecha ? 'Cuota de padres por fecha' : 'Cuota de padres general',
      cicloLabel: etiquetaCicloReporte(cicloEscolar),
      fecha: fecha ?? '',
      filas: [],
    }
  }

  const { data, error } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado')
    .in('alumno_id', ids)
    .gt('alumno_nivel', 2)
    .neq('alumno_status', 0)
    .order('alumno_nivel')
    .order('alumno_grado')

  if (error) throw new Error(error.message)

  const filas = (data ?? []).map((r, i) => {
    const niv = Number(r.alumno_nivel)
    return {
      no: i + 1,
      nivel: etiquetaNivelEscolar(niv),
      grado: etiquetaGradoEscolar(niv, Number(r.alumno_grado)),
      noCtrl: String(r.alumno_ref ?? '').trim(),
      nombre: construirNombreCompleto(r.alumno_nombre, r.alumno_app, r.alumno_apm),
    }
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
