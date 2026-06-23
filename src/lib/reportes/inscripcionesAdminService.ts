import { createDbAdmin } from '@/lib/insforgeAdmin'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { parsearReferenciaPago } from '@/lib/pagoReferenciaColegiatura'
import { etiquetaCicloReporte } from './renderDocument'

type Celda = { nivel: number; grado: number; total: number }

function key(nivel: number, grado: number) {
  return `${nivel}:${grado}`
}

function mapaDesdeFilas(filas: { alumno_nivel: number; alumno_grado: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const f of filas) {
    const k = key(Number(f.alumno_nivel), Number(f.alumno_grado))
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

async function contarAlumnos(
  ciclo: number,
  nuevoIngreso: 0 | 1,
  excluirStatus = true
): Promise<Map<string, number>> {
  const db = createDbAdmin()
  let q = db
    .from('alumno')
    .select('alumno_nivel, alumno_grado')
    .eq('alumno_ciclo_escolar', ciclo)
    .eq('alumno_nuevo_ingreso', nuevoIngreso)

  if (excluirStatus) q = q.not('alumno_status', 'in', '(0,2)')

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return mapaDesdeFilas(data ?? [])
}

async function contarReinscritosPagados(
  cicloAlumnos: number,
  cicloInscripcion: number,
  conceptos: string[]
): Promise<Map<string, number>> {
  const db = createDbAdmin()
  const { data: alumnos, error } = await db
    .from('alumno')
    .select('alumno_id, alumno_nivel, alumno_grado')
    .eq('alumno_ciclo_escolar', cicloAlumnos)
    .eq('alumno_nuevo_ingreso', 0)
    .not('alumno_status', 'in', '(0,2)')

  if (error) throw new Error(error.message)
  const ids = (alumnos ?? []).map((a) => Number(a.alumno_id))
  if (!ids.length) return new Map()

  const { data: pagos, error: pErr } = await db
    .from('pago_detalle')
    .select('alumno_id, pago_referencia, pago_cancelado')
    .in('alumno_id', ids)
    .eq('pago_cancelado', 0)

  if (pErr) throw new Error(pErr.message)

  const nivelGrado = new Map<number, { nivel: number; grado: number }>()
  for (const a of alumnos ?? []) {
    nivelGrado.set(Number(a.alumno_id), {
      nivel: Number(a.alumno_nivel),
      grado: Number(a.alumno_grado),
    })
  }

  const m = new Map<string, number>()
  const vistos = new Set<number>()

  for (const p of pagos ?? []) {
    const alumnoId = Number(p.alumno_id)
    if (vistos.has(alumnoId)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (parsed.cicloEscolar !== cicloInscripcion) continue
    if (!conceptos.includes(parsed.conceptoNo)) continue
    const ng = nivelGrado.get(alumnoId)
    if (!ng) continue
    vistos.add(alumnoId)
    const k = key(ng.nivel, ng.grado)
    m.set(k, (m.get(k) ?? 0) + 1)
  }

  return m
}

async function contarNuevoIngresoPagado(cicloInscripcion: number): Promise<Map<string, number>> {
  const db = createDbAdmin()
  const { data: pagos, error } = await db
    .from('pago_detalle')
    .select('alumno_id, pago_referencia, pago_cancelado')
    .eq('pago_cancelado', 0)

  if (error) throw new Error(error.message)

  const refs = new Set<string>()
  for (const p of pagos ?? []) {
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (parsed.cicloEscolar !== cicloInscripcion || parsed.conceptoNo !== '13') continue
    refs.add(parsed.alumnoRef)
  }

  if (!refs.size) return new Map()

  const { data: alumnos, error: aErr } = await db
    .from('alumno')
    .select('alumno_nivel, alumno_grado, alumno_ref')
    .eq('alumno_ciclo_escolar', cicloInscripcion)
    .eq('alumno_nuevo_ingreso', 1)
    .eq('alumno_status', 1)

  if (aErr) throw new Error(aErr.message)

  const filas = (alumnos ?? []).filter((a) =>
    refs.has(String(a.alumno_ref ?? '').padStart(5, '0').slice(-5))
  )
  return mapaDesdeFilas(filas)
}

const NIVELES_GRADOS: Celda[] = [
  { nivel: 1, grado: 1, total: 0 },
  { nivel: 1, grado: 2, total: 0 },
  { nivel: 2, grado: 1, total: 0 },
  { nivel: 2, grado: 2, total: 0 },
  { nivel: 2, grado: 3, total: 0 },
  { nivel: 3, grado: 1, total: 0 },
  { nivel: 3, grado: 2, total: 0 },
  { nivel: 3, grado: 3, total: 0 },
  { nivel: 3, grado: 4, total: 0 },
  { nivel: 3, grado: 5, total: 0 },
  { nivel: 3, grado: 6, total: 0 },
  { nivel: 4, grado: 1, total: 0 },
  { nivel: 4, grado: 2, total: 0 },
  { nivel: 4, grado: 3, total: 0 },
]

export async function cargarMatrizInscripciones(cicloInscripcion: number, modo: 'dif1' | 'dif2' | 'general') {
  const cicloAlumnos = cicloInscripcion - 1
  const conceptos =
    modo === 'dif2' ? ['12', '13'] : ['11', '13']

  const [riEst, riPag, niEst, niPag] = await Promise.all([
    contarAlumnos(cicloAlumnos, 0),
    contarReinscritosPagados(cicloAlumnos, cicloInscripcion, conceptos),
    contarAlumnos(cicloInscripcion, 1, false),
    contarNuevoIngresoPagado(cicloInscripcion),
  ])

  const filas = NIVELES_GRADOS.map(({ nivel, grado }) => {
    const k = key(nivel, grado)
    const est = riEst.get(k) ?? 0
    const pag = riPag.get(k) ?? 0
    const niE = niEst.get(k) ?? 0
    const niP = niPag.get(k) ?? 0
    return {
      nivel: etiquetaNivelEscolar(nivel),
      grado: etiquetaGradoEscolar(nivel, grado),
      reinscritosEst: String(est),
      reinscritosPag: String(pag),
      reinscritosDif: String(est - pag),
      nuevoIngEst: String(niE),
      nuevoIngPag: String(niP),
      nuevoIngDif: String(niE - niP),
    }
  }).filter(
    (f) =>
      Number(f.reinscritosEst) > 0 ||
      Number(f.nuevoIngEst) > 0 ||
      Number(f.reinscritosPag) > 0 ||
      Number(f.nuevoIngPag) > 0
  )

  const titulo =
    modo === 'dif1'
      ? 'Inscripciones admin — 1er diferido'
      : modo === 'dif2'
        ? 'Inscripciones admin — 2do diferido'
        : 'Inscripciones — resumen por nivel y grado'

  return {
    titulo,
    cicloInscripcion,
    cicloLabel: etiquetaCicloReporte(cicloInscripcion),
    filas,
  }
}

export function matrizInscripcionesATabla(resumen: Awaited<ReturnType<typeof cargarMatrizInscripciones>>) {
  return {
    headers: [
      'Nivel',
      'Grado',
      'Reinsc. est.',
      'Reinsc. pag.',
      'Reinsc. dif.',
      'N. ing. est.',
      'N. ing. pag.',
      'N. ing. dif.',
    ],
    rows: resumen.filas.map((f) => [
      f.nivel,
      f.grado,
      f.reinscritosEst,
      f.reinscritosPag,
      f.reinscritosDif,
      f.nuevoIngEst,
      f.nuevoIngPag,
      f.nuevoIngDif,
    ]),
  }
}
