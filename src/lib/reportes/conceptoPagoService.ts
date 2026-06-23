import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { fetchPagosPorAlumnos } from './fetchDb'
import {
  buscarFechaConcepto,
  pagosAlumnoVigentes,
  tieneConceptoEnCiclo,
} from './pagoReporteHelpers'
import { etiquetaCicloReporte } from './renderDocument'

export type FilaConceptoPago = {
  no: number
  nivel: string
  grado: string
  grupo: string
  noCtrl: string
  nombre: string
  fechaPago: string
}

export type ResumenConceptoPago = {
  titulo: string
  cicloEscolar: number
  cicloInscripcion: number
  cicloLabel: string
  filas: FilaConceptoPago[]
}

function pagosVigentes(
  pagos: {
    pago_referencia: string | null
    pago_fecha: string | null
    pago_cancelado: number | null
  }[]
) {
  return pagosAlumnoVigentes(pagos)
}

/** Patrón EMS / concepto único con unión de pendientes. */
export async function cargarReporteConceptoUnion(
  opts: {
    titulo: string
    cicloEscolar: number
    cicloInscripcion: number
    conceptosPagados: string[]
    nivelMin?: number
    soloReinscritos?: boolean
    filtroNivel?: number
  }
): Promise<ResumenConceptoPago> {
  const db = createDbAdmin()
  let query = db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_nuevo_ingreso'
    )
    .eq('alumno_ciclo_escolar', opts.cicloEscolar)
    .not('alumno_status', 'in', '(0,2)')

  if (opts.filtroNivel != null) query = query.eq('alumno_nivel', opts.filtroNivel)
  if (opts.nivelMin != null) query = query.gte('alumno_nivel', opts.nivelMin)
  if (opts.soloReinscritos) query = query.eq('alumno_nuevo_ingreso', 0)

  const { data, error } = await query.order('alumno_nivel').order('alumno_grado')
  if (error) throw new Error(error.message)

  const alumnos = (data ?? []).map((r) => ({
    alumno_id: Number(r.alumno_id),
    alumno_ref: String(r.alumno_ref ?? '').trim(),
    nombre: construirNombreCompleto(r.alumno_nombre, r.alumno_app, r.alumno_apm),
    alumno_nivel: Number(r.alumno_nivel),
    alumno_grado: Number(r.alumno_grado),
    alumno_grupo: Number(r.alumno_grupo),
  }))

  const pagos = await fetchPagosPorAlumnos(alumnos.map((a) => a.alumno_id))
  const pagosPorAlumno = new Map<number, typeof pagos>()
  for (const p of pagos) {
    const list = pagosPorAlumno.get(p.alumno_id) ?? []
    list.push(p)
    pagosPorAlumno.set(p.alumno_id, list)
  }

  const filas: FilaConceptoPago[] = []
  const incluidos = new Set<number>()

  for (const a of alumnos) {
    const vigentes = pagosVigentes(pagosPorAlumno.get(a.alumno_id) ?? [])
    if (!vigentes.length) continue

    if (
      tieneConceptoEnCiclo(
        vigentes,
        a.alumno_ref,
        opts.conceptosPagados,
        opts.cicloInscripcion
      )
    ) {
      incluidos.add(a.alumno_id)
      filas.push({
        no: 0,
        nivel: etiquetaNivelEscolar(a.alumno_nivel),
        grado: etiquetaGradoEscolar(a.alumno_nivel, a.alumno_grado),
        grupo: etiquetaGrupoEscolar(a.alumno_grupo),
        noCtrl: a.alumno_ref,
        nombre: a.nombre,
        fechaPago: buscarFechaConcepto(
          vigentes,
          a.alumno_ref,
          opts.conceptosPagados,
          opts.cicloInscripcion
        ),
      })
    }
  }

  for (const a of alumnos) {
    if (incluidos.has(a.alumno_id)) continue
    const vigentes = pagosVigentes(pagosPorAlumno.get(a.alumno_id) ?? [])
    if (!vigentes.length) continue
    filas.push({
      no: 0,
      nivel: etiquetaNivelEscolar(a.alumno_nivel),
      grado: etiquetaGradoEscolar(a.alumno_nivel, a.alumno_grado),
      grupo: etiquetaGrupoEscolar(a.alumno_grupo),
      noCtrl: a.alumno_ref,
      nombre: a.nombre,
      fechaPago: '',
    })
  }

  filas.sort((x, y) => {
    const n = x.nivel.localeCompare(y.nivel, 'es')
    if (n !== 0) return n
    const g = x.grado.localeCompare(y.grado, 'es')
    if (g !== 0) return g
    return x.nombre.localeCompare(y.nombre, 'es')
  })
  filas.forEach((f, i) => {
    f.no = i + 1
  })

  return {
    titulo: opts.titulo,
    cicloEscolar: opts.cicloEscolar,
    cicloInscripcion: opts.cicloInscripcion,
    cicloLabel: etiquetaCicloReporte(opts.cicloInscripcion),
    filas,
  }
}

export function conceptoPagoATabla(resumen: ResumenConceptoPago, conNivel = true) {
  const headers = conNivel
    ? ['#', 'Nivel', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', 'F. pago']
    : ['#', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', 'F. pago']
  const rows = resumen.filas.map((f) =>
    conNivel
      ? [String(f.no), f.nivel, f.grado, f.grupo, f.noCtrl, f.nombre, f.fechaPago]
      : [String(f.no), f.grado, f.grupo, f.noCtrl, f.nombre, f.fechaPago]
  )
  return { headers, rows }
}

export async function cargarReporteEms(cicloInscripcion: number) {
  return cargarReporteConceptoUnion({
    titulo: 'Herramientas, material y seguro (EMS)',
    cicloEscolar: cicloInscripcion - 1,
    cicloInscripcion,
    conceptosPagados: ['17'],
    soloReinscritos: true,
  })
}

export async function cargarKinderSinPago(cicloAlumnos: number, cicloPago: number) {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo'
    )
    .eq('alumno_nivel', 2)
    .eq('alumno_ciclo_escolar', cicloAlumnos)
    .eq('alumno_nuevo_ingreso', 0)
    .eq('alumno_status', 1)

  if (error) throw new Error(error.message)

  const alumnos = (data ?? []).map((r) => ({
    alumno_id: Number(r.alumno_id),
    alumno_ref: String(r.alumno_ref ?? '').trim(),
    nombre: construirNombreCompleto(r.alumno_nombre, r.alumno_app, r.alumno_apm),
    alumno_grado: Number(r.alumno_grado),
    alumno_grupo: Number(r.alumno_grupo),
  }))

  const pagos = await fetchPagosPorAlumnos(alumnos.map((a) => a.alumno_id))
  const pagosPorAlumno = new Map<number, typeof pagos>()
  for (const p of pagos) {
    const list = pagosPorAlumno.get(p.alumno_id) ?? []
    list.push(p)
    pagosPorAlumno.set(p.alumno_id, list)
  }

  const filas: FilaConceptoPago[] = []
  for (const a of alumnos) {
    const vigentes = pagosVigentes(pagosPorAlumno.get(a.alumno_id) ?? [])
    const pagado = tieneConceptoEnCiclo(vigentes, a.alumno_ref, ['13'], cicloPago)
    if (pagado) continue
    filas.push({
      no: filas.length + 1,
      nivel: 'Kinder',
      grado: etiquetaGradoEscolar(2, a.alumno_grado),
      grupo: etiquetaGrupoEscolar(a.alumno_grupo),
      noCtrl: a.alumno_ref,
      nombre: a.nombre,
      fechaPago: '',
    })
  }

  return {
    titulo: 'Reinscritos Kinder sin pago de inscripción',
    cicloEscolar: cicloAlumnos,
    cicloInscripcion: cicloPago,
    cicloLabel: etiquetaCicloReporte(cicloPago),
    filas,
  } satisfies ResumenConceptoPago
}
