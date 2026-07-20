import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import {
  cicloFichaAlumnosParaInscripcion,
} from '@/lib/ciclosEscolares'
import { resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'
import {
  formatearAlumnoRefParaReferencia,
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'
import { fetchAlumnosReinscritos, fetchPagosPorAlumnos } from './fetchDb'
import { etiquetaCicloReporte } from './renderDocument'

export type FilaReinscritosPagos = {
  no: number
  grado: string
  grupo: string
  noCtrl: string
  nombre: string
  fechaDif1: string
  fechaDif2: string
  fechaPago: string
  plan: string
}

export type ResumenReinscritosPagos = {
  cicloEscolar: number
  cicloInscripcion: number
  cicloLabel: string
  nivel: number
  nivelLabel: string
  titulo: string
  filas: FilaReinscritosPagos[]
}

function pagoVigente(cancelado: number | null): boolean {
  return cancelado !== 1 && cancelado !== 2
}

function etiquetaPlanMeses(mes: number | null): string {
  if (mes === 1) return '10 meses'
  if (mes === 2) return '11 meses'
  return 'N/D'
}

function formatearFechaPago(fecha: string | null): string {
  if (!fecha) return ''
  const d = fecha.slice(0, 10)
  const [y, m, day] = d.split('-')
  if (!y || !m || !day) return fecha
  return `${day}/${m}/${y}`
}

function pagosAlumnoVigentes(
  pagos: {
    pago_referencia: string | null
    pago_fecha: string | null
    pago_cancelado: number | null
  }[]
) {
  return pagos.filter((p) => pagoVigente(p.pago_cancelado))
}

function tieneConceptoEnCiclo(
  pagos: ReturnType<typeof pagosAlumnoVigentes>,
  alumnoRef: string,
  conceptos: string[],
  cicloInscripcion: number
): boolean {
  const ref5 = formatearAlumnoRefParaReferencia(alumnoRef)
  return pagos.some((p) => {
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) return false
    return (
      parsed.alumnoRef === ref5 &&
      conceptos.includes(normalizarConceptoNo(parsed.conceptoNo)) &&
      parsed.cicloEscolar === cicloInscripcion
    )
  })
}

function buscarFechaConcepto(
  pagos: ReturnType<typeof pagosAlumnoVigentes>,
  alumnoRef: string,
  conceptos: string[],
  cicloInscripcion: number
): string {
  const ref5 = formatearAlumnoRefParaReferencia(alumnoRef)
  const hits = pagos
    .map((p) => {
      const parsed = parsearReferenciaPago(p.pago_referencia)
      if (!parsed) return null
      if (
        parsed.alumnoRef !== ref5 ||
        !conceptos.includes(normalizarConceptoNo(parsed.conceptoNo)) ||
        parsed.cicloEscolar !== cicloInscripcion
      ) {
        return null
      }
      return p.pago_fecha
    })
    .filter((f): f is string => Boolean(f))
    .sort()

  return hits.length ? formatearFechaPago(hits[0]) : ''
}

async function cargarReinscritosUnion(
  nivel: number,
  cicloEscolar: number,
  cicloInscripcion: number,
  titulo: string,
  modo: '1-pago' | '2-pagos'
): Promise<ResumenReinscritosPagos> {
  const alumnos = await fetchAlumnosReinscritos(nivel, cicloEscolar)
  const pagos = await fetchPagosPorAlumnos(alumnos.map((a) => a.alumno_id))

  const pagosPorAlumno = new Map<number, typeof pagos>()
  for (const p of pagos) {
    const list = pagosPorAlumno.get(p.alumno_id) ?? []
    list.push(p)
    pagosPorAlumno.set(p.alumno_id, list)
  }

  const conceptosPagados =
    modo === '1-pago' ? ['11', '13'] : ['12', '13']
  const conceptosDif1 = ['11']
  const conceptosDif2 = ['12', '13']

  const filas: FilaReinscritosPagos[] = []
  const incluidos = new Set<number>()

  for (const a of alumnos) {
    const vigentes = pagosAlumnoVigentes(pagosPorAlumno.get(a.alumno_id) ?? [])
    if (!vigentes.length) continue

    const pagoObjetivo = tieneConceptoEnCiclo(
      vigentes,
      a.alumno_ref,
      conceptosPagados,
      cicloInscripcion
    )

    if (pagoObjetivo) {
      incluidos.add(a.alumno_id)
      const fechaPago =
        modo === '1-pago'
          ? buscarFechaConcepto(vigentes, a.alumno_ref, conceptosPagados, cicloInscripcion)
          : buscarFechaConcepto(vigentes, a.alumno_ref, conceptosDif2, cicloInscripcion)

      filas.push({
        no: 0,
        grado: etiquetaGradoEscolar(a.alumno_nivel, a.alumno_grado),
        grupo: etiquetaGrupoEscolar(a.alumno_grupo),
        noCtrl: a.alumno_ref,
        nombre: a.nombre,
        fechaDif1: buscarFechaConcepto(
          vigentes,
          a.alumno_ref,
          conceptosDif1,
          cicloInscripcion
        ),
        fechaDif2: modo === '2-pagos' ? fechaPago : '',
        fechaPago: modo === '1-pago' ? fechaPago : '',
        plan: etiquetaPlanMeses(a.mes),
      })
    }
  }

  for (const a of alumnos) {
    if (incluidos.has(a.alumno_id)) continue
    const vigentes = pagosAlumnoVigentes(pagosPorAlumno.get(a.alumno_id) ?? [])
    if (!vigentes.length) continue

    filas.push({
      no: 0,
      grado: etiquetaGradoEscolar(a.alumno_nivel, a.alumno_grado),
      grupo: etiquetaGrupoEscolar(a.alumno_grupo),
      noCtrl: a.alumno_ref,
      nombre: a.nombre,
      fechaDif1: buscarFechaConcepto(
        vigentes,
        a.alumno_ref,
        conceptosDif1,
        cicloInscripcion
      ),
      fechaDif2: '',
      fechaPago: '',
      plan: etiquetaPlanMeses(a.mes),
    })
  }

  filas.sort((x, y) => {
    const g = x.grado.localeCompare(y.grado, 'es')
    if (g !== 0) return g
    const gp = x.grupo.localeCompare(y.grupo, 'es')
    if (gp !== 0) return gp
    return x.nombre.localeCompare(y.nombre, 'es')
  })

  filas.forEach((f, i) => {
    f.no = i + 1
  })

  return {
    cicloEscolar,
    cicloInscripcion,
    cicloLabel: etiquetaCicloReporte(cicloInscripcion),
    nivel,
    nivelLabel: etiquetaNivelEscolar(nivel),
    titulo,
    filas,
  }
}

export function reinscritosPagosATabla(resumen: ResumenReinscritosPagos, dosPagos: boolean) {
  const headers = dosPagos
    ? ['#', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', '1er Dif', '2do Dif', 'Plan']
    : ['#', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', 'F. pago', 'Plan']

  const rows = resumen.filas.map((f) =>
    dosPagos
      ? [
          String(f.no),
          f.grado,
          f.grupo,
          f.noCtrl,
          f.nombre,
          f.fechaDif1,
          f.fechaDif2,
          f.plan,
        ]
      : [String(f.no), f.grado, f.grupo, f.noCtrl, f.nombre, f.fechaPago, f.plan]
  )

  return { headers, rows }
}

export async function cargarReinscritos2Pagos(
  nivel: number,
  cicloInscripcion: number
): Promise<ResumenReinscritosPagos> {
  const cea = await resolverCicloEscolarSistemaValor()
  const cicloAlumnos = cicloFichaAlumnosParaInscripcion(cicloInscripcion, cea)
  return cargarReinscritosUnion(
    nivel,
    cicloAlumnos,
    cicloInscripcion,
    'Reinscritos — 2 pagos (diferidos)',
    '2-pagos'
  )
}

export async function cargarReinscritos1Pago(
  nivel: number,
  cicloInscripcion: number
): Promise<ResumenReinscritosPagos> {
  const cea = await resolverCicloEscolarSistemaValor()
  const cicloAlumnos = cicloFichaAlumnosParaInscripcion(cicloInscripcion, cea)
  return cargarReinscritosUnion(
    nivel,
    cicloAlumnos,
    cicloInscripcion,
    'Reinscritos — 1 pago',
    '1-pago'
  )
}
