import { createDbAdmin } from '@/lib/insforgeAdmin'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import {
  formatearAlumnoRefParaReferencia,
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'
import { fetchAlumnosActivosNivel, fetchPagosPorAlumnos } from './fetchDb'
import { etiquetaCicloReporte } from './renderDocument'

export type FilaCurp = {
  no: number
  grado: string
  grupo: string
  noCtrl: string
  nombre: string
  curp: string
}

export type ResumenCurp = {
  ciclo: number
  cicloLabel: string
  nivel: number
  nivelLabel: string
  filas: FilaCurp[]
}

function tienePagoInscripcion(
  pagos: {
    pago_referencia: string | null
    pago_cancelado: number | null
  }[],
  alumnoRef: string,
  cicloEscolar: number
): boolean {
  const ref5 = formatearAlumnoRefParaReferencia(alumnoRef)
  return pagos.some((p) => {
    if (p.pago_cancelado === 1 || p.pago_cancelado === 2) return false
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) return false
    const concepto = normalizarConceptoNo(parsed.conceptoNo)
    return (
      parsed.alumnoRef === ref5 &&
      parsed.cicloEscolar === cicloEscolar &&
      (concepto === '12' || concepto === '13')
    )
  })
}

export async function cargarReporteCurp(
  nivel: number,
  cicloEscolar: number
): Promise<ResumenCurp> {
  const alumnos = await fetchAlumnosActivosNivel(nivel, cicloEscolar)
  const pagos = await fetchPagosPorAlumnos(alumnos.map((a) => a.alumno_id))

  const pagosPorAlumno = new Map<number, typeof pagos>()
  for (const p of pagos) {
    const list = pagosPorAlumno.get(p.alumno_id) ?? []
    list.push(p)
    pagosPorAlumno.set(p.alumno_id, list)
  }

  const elegibles = alumnos.filter((a) =>
    tienePagoInscripcion(pagosPorAlumno.get(a.alumno_id) ?? [], a.alumno_ref, cicloEscolar)
  )

  const db = createDbAdmin()
  const curpPorAlumno = new Map<number, string>()
  const ids = elegibles.map((a) => a.alumno_id)

  for (let i = 0; i < ids.length; i += 120) {
    const chunk = ids.slice(i, i + 120)
    const { data, error } = await db
      .from('alumno_detalles')
      .select('alumno_id, alumno_curp')
      .in('alumno_id', chunk)

    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      curpPorAlumno.set(Number(r.alumno_id), String(r.alumno_curp ?? '').trim())
    }
  }

  const filas: FilaCurp[] = elegibles.map((a, i) => ({
    no: i + 1,
    grado: etiquetaGradoEscolar(a.alumno_nivel, a.alumno_grado),
    grupo: etiquetaGrupoEscolar(a.alumno_grupo),
    noCtrl: a.alumno_ref,
    nombre: a.nombre,
    curp: curpPorAlumno.get(a.alumno_id) ?? '',
  }))

  return {
    ciclo: cicloEscolar,
    cicloLabel: etiquetaCicloReporte(cicloEscolar),
    nivel,
    nivelLabel: etiquetaNivelEscolar(nivel),
    filas,
  }
}

export function curpATabla(resumen: ResumenCurp) {
  return {
    headers: ['#', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', 'CURP'],
    rows: resumen.filas.map((f) => [
      String(f.no),
      f.grado,
      f.grupo,
      f.noCtrl,
      f.nombre,
      f.curp,
    ]),
  }
}
