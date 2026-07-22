import { createDbAdmin } from '@/lib/insforgeAdmin'
import { generarListaDeudoresSuspension } from '@/lib/suspensionesService'
import { etiquetaModalidadPlan } from '@/lib/suspensionesAdeudos'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { etiquetaCicloReporte } from './renderDocument'
import type { ResumenDeudoresReporte } from './deudoresSuspendidosDocument'

export async function cargarSuspendidosReporte(
  plantel: 1 | 2,
  cicloEscolar: number,
  tipo: 2 | 3 = 3
): Promise<ResumenDeudoresReporte> {
  const db = createDbAdmin()
  const res = await generarListaDeudoresSuspension(db, {
    plantel,
    tipo,
    cicloEscolar,
    fechaCartas: new Date().toISOString().slice(0, 10),
  })

  const plantelLabel = plantel === 1 ? 'Educativo (IEW)' : 'Winston (IWC)'
  const tipoLabel =
    tipo === 2 ? 'Deudores 1 mes' : tipo === 3 ? 'Suspendidos' : 'Deudores'

  return {
    titulo: `${tipoLabel} — ${plantelLabel}`,
    cicloLabel: etiquetaCicloReporte(cicloEscolar),
    tipo,
    plantel,
    filas: res.deudores.map((d, i) => ({
      no: i + 1,
      noCtrl: d.alumnoRef,
      nombre: d.nombre,
      nivel: etiquetaNivelEscolar(d.nivel),
      gradoEtiqueta: d.gradoEtiqueta,
      modalidad: etiquetaModalidadPlan(d.planMes),
      planMes: d.planMes,
      adeudos: d.adeudos,
      prorroga: d.prorroga ?? '',
    })),
    totalRevisados: res.totalAlumnosRevisados,
    excluidosBecados100: res.excluidosBecados100,
  }
}

export function suspendidosATabla(resumen: ResumenDeudoresReporte) {
  return {
    headers: ['#', 'No. Ctrl', 'Nombre', 'Nivel', 'Grado', 'Modalidad', 'Adeudos', 'Prórroga'],
    rows: resumen.filas.map((f) => [
      String(f.no),
      f.noCtrl,
      f.nombre,
      f.nivel,
      f.gradoEtiqueta,
      f.modalidad,
      f.adeudos,
      f.prorroga,
    ]),
  }
}

export async function cargarTalleres(cicloEscolar: number) {
  const db = createDbAdmin()

  const { error: probeErr } = await db.from('alumno_taller').select('alumno_id').limit(1)
  if (probeErr) {
    return {
      titulo: 'Talleres',
      cicloLabel: etiquetaCicloReporte(cicloEscolar),
      filas: [] as { taller: string; grado: string; grupo: string; noCtrl: string; nombre: string }[],
      aviso: 'Tablas de talleres no migradas a InsForge.',
    }
  }

  const { data: conceptos } = await db
    .from('concepto_taller')
    .select('taller_id, taller_clase, taller_ciclo_escolar')
    .eq('taller_ciclo_escolar', cicloEscolar)

  const conceptoMap = new Map(
    (conceptos ?? []).map((c) => [Number(c.taller_id), String(c.taller_clase ?? 'Taller')])
  )
  const tallerIds = [...conceptoMap.keys()]
  if (!tallerIds.length) {
    return { titulo: 'Talleres', cicloLabel: etiquetaCicloReporte(cicloEscolar), filas: [] }
  }

  const { data: joinData, error: joinErr } = await db
    .from('alumno_taller')
    .select('alumno_id, taller_id')
    .in('taller_id', tallerIds)

  if (joinErr) throw new Error(joinErr.message)

  const alumnoIds = [...new Set((joinData ?? []).map((r) => Number(r.alumno_id)))]
  if (!alumnoIds.length) {
    return { titulo: 'Talleres', cicloLabel: etiquetaCicloReporte(cicloEscolar), filas: [] }
  }

  const { data: alumnos, error: aErr } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo')
    .in('alumno_id', alumnoIds)
    .not('alumno_status', 'in', '(0,2)')

  if (aErr) throw new Error(aErr.message)

  const alumnoMap = new Map((alumnos ?? []).map((a) => [Number(a.alumno_id), a]))
  const filas: { taller: string; grado: string; grupo: string; noCtrl: string; nombre: string }[] = []

  for (const r of joinData ?? []) {
    const a = alumnoMap.get(Number(r.alumno_id))
    if (!a) continue
    filas.push({
      taller: conceptoMap.get(Number(r.taller_id)) ?? 'Taller',
      grado: String(a.alumno_grado),
      grupo: String(a.alumno_grupo),
      noCtrl: String(a.alumno_ref ?? ''),
      nombre: [a.alumno_nombre, a.alumno_app, a.alumno_apm].filter(Boolean).join(' '),
    })
  }

  filas.sort((x, y) => x.taller.localeCompare(y.taller, 'es') || x.nombre.localeCompare(y.nombre, 'es'))

  return { titulo: 'Talleres', cicloLabel: etiquetaCicloReporte(cicloEscolar), filas }
}

export function talleresATabla(resumen: Awaited<ReturnType<typeof cargarTalleres>>) {
  return {
    headers: ['Taller', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre'],
    rows: resumen.filas.map((f) => [f.taller, f.grado, f.grupo, f.noCtrl, f.nombre]),
  }
}

export async function cargarNuevoIngresoMes(
  cicloAlumnos: number,
  mes: number,
  anio: number,
  nivel?: number
) {
  const db = createDbAdmin()
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const ultimo = new Date(anio, mes, 0).getDate()
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`

  let q = db
    .from('alumno')
    .select('alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_alta')
    .eq('alumno_ciclo_escolar', cicloAlumnos)
    .eq('alumno_nuevo_ingreso', 1)
    .neq('alumno_status', 0)
    .gte('alumno_alta', desde)
    .lte('alumno_alta', hasta)
    .order('alumno_alta')

  if (nivel != null) q = q.eq('alumno_nivel', nivel)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  const filas = (data ?? []).map((r, i) => ({
    no: i + 1,
    alta: String(r.alumno_alta ?? '').slice(0, 10),
    nivel: etiquetaNivelEscolar(Number(r.alumno_nivel)),
    grado: String(r.alumno_grado),
    grupo: String(r.alumno_grupo),
    noCtrl: String(r.alumno_ref ?? ''),
    nombre: [r.alumno_nombre, r.alumno_app, r.alumno_apm].filter(Boolean).join(' '),
  }))

  return {
    titulo: `Nuevo ingreso por mes (${mes}/${anio})`,
    cicloLabel: etiquetaCicloReporte(cicloAlumnos),
    filas,
  }
}

export function nuevoIngresoMesATabla(resumen: Awaited<ReturnType<typeof cargarNuevoIngresoMes>>) {
  return {
    headers: ['#', 'Alta', 'Nivel', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre'],
    rows: resumen.filas.map((f) => [
      String(f.no),
      f.alta,
      f.nivel,
      f.grado,
      f.grupo,
      f.noCtrl,
      f.nombre,
    ]),
  }
}
