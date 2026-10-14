import { jsPDF } from 'jspdf'
import { etiquetaCicloBoletas } from './boletasCiclo'
import { createBoletasDb } from './boletasInsforge'
import { fondo, plantillaPrimaria, rectPx, textoPx, type Rgb } from './boletasPrimariaPdf'
import {
  BOLETAS_NIVEL_SEC,
  SIN_CALIFICACION,
  califDesdeBd,
  esGradoSecundaria,
  etiquetaGradoSec,
  filasPorIds,
  fmtTrunc,
  grupoNumeroSec,
  letraConducta,
  letraGrupoSec,
  listarMateriasSec,
  promedioMateria,
  promedioMateriaBoleta,
  promediosDeAlumno,
  type SecMateria,
  type SecundariaGrado,
} from './boletasSecundariaService'

/** Boleta de secundaria sobre las plantillas legacy 7MO/8VO/9NO (carta, 300 dpi; medidas en px). */

type Row = Record<string, unknown>
type Tri = [string, string, string]

const PLANTILLA: Record<SecundariaGrado, string> = { 1: 'secundaria/7mo.jpg', 2: 'secundaria/8vo.jpg', 3: 'secundaria/9no.jpg' }

/** Renglones de la tabla: [y inicial, y final, renglones dibujados en la plantilla]. */
const TABLA: Record<SecundariaGrado, { set: [number, number, number]; promSet: [number, number]; win: [number, number, number]; promWin: [number, number] }> = {
  1: { set: [1302, 1882, 10], promSet: [1885, 1976], win: [1980, 2268, 5], promWin: [2272, 2363] },
  2: { set: [1312, 1862, 9], promSet: [1866, 1962], win: [1965, 2266, 5], promWin: [2269, 2365] },
  3: { set: [1312, 1862, 9], promSet: [1866, 1962], win: [1965, 2266, 5], promWin: [2269, 2365] },
}

/** Bordes de columna: materia | 3 × (CAL, CN, F) | final CAL, F. */
const X_MATERIA = 241
const X_CELDAS = [1012, 1122, 1231, 1341, 1451, 1561, 1671, 1781, 1891, 2001]
const X_FINAL = [2001, 2154, 2308]

const CCT = '28PES0124J'
const TURNO = 'MATUTINO'
const TINTA: Rgb = [28, 28, 32]
const ROJO_CICLO: Rgb = [255, 46, 52]

const ESTILO_DATO = { size: 13, color: TINTA, estilo: 'bold' as const, align: 'center' as const }
const ESTILO_CELDA = { size: 10, color: TINTA, estilo: 'bold' as const, align: 'center' as const }
const ESTILO_PROM = { size: 11, color: TINTA, estilo: 'bold' as const, align: 'center' as const }

/** Mindfulness: verde ≥ 8, amarillo ≥ 6, rojo abajo (legacy 2026-03-20). */
function colorSemaforo(n: number): Rgb {
  if (n >= 8) return [0, 176, 80]
  if (n >= 6) return [255, 192, 0]
  return [255, 0, 0]
}

type Alumno = {
  id: number
  app: string
  apm: string
  nombre: string
  grado: SecundariaGrado
  grupo: string
  cal: Map<number, Tri>
  cn: Map<number, Tri>
  faltas: Map<number, Tri>
}

const txt = (v: unknown) => String(v ?? '').trim()

async function cargarAlumnos(ids: number[], ciclo: number): Promise<Alumno[]> {
  const db = createBoletasDb()
  const [alumnos, materias, cals, faltas, conds] = await Promise.all([
    filasPorIds(
      ids,
      (t, d, h) =>
        db
          .from('alumno')
          .select('alumno_id, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel')
          .in('alumno_id', t)
          .order('alumno_id')
          .range(d, h),
      'Alumnos'
    ),
    listarMateriasSec(),
    filasPorIds(
      ids,
      (t, d, h) =>
        db
          .from('boleta_calificacion')
          .select('calificacion_id, alumno_id, materia_id, calificacion_bimestre, calificacion_puntos')
          .eq('calificacion_ciclo_escolar', ciclo)
          .in('alumno_id', t)
          .order('calificacion_id')
          .range(d, h),
      'Calificaciones'
    ),
    filasPorIds(
      ids,
      (t, d, h) =>
        db
          .from('boleta_inasistencia')
          .select('inasistencia_id, alumno_id, materia_id, inasistencia_bimestre, inasistencia_cantidad')
          .eq('inasistencia_ciclo_escolar', ciclo)
          .in('alumno_id', t)
          .order('inasistencia_id')
          .range(d, h),
      'Faltas'
    ),
    filasPorIds(
      ids,
      (t, d, h) =>
        db
          .from('boleta_conducta')
          .select('conducta_id, alumno_id, materia_id, conducta_bimestre, conducta_valor')
          .eq('conducta_ciclo_escolar', ciclo)
          .in('alumno_id', t)
          .order('conducta_id')
          .range(d, h),
      'Conducta'
    ),
  ])
  const gradoMateria = new Map(materias.map((m) => [m.id, m.grado]))

  const porAlumno = (filas: Row[], bim: string, valor: (r: Row) => string) => {
    const out = new Map<number, Map<number, Tri>>()
    for (const r of filas) {
      const t = Number(r[bim])
      if (t < 1 || t > 3) continue
      const m = out.get(Number(r.alumno_id)) ?? new Map<number, Tri>()
      const v = m.get(Number(r.materia_id)) ?? ['', '', '']
      v[t - 1] = valor(r)
      m.set(Number(r.materia_id), v)
      out.set(Number(r.alumno_id), m)
    }
    return out
  }
  const cal = porAlumno(cals, 'calificacion_bimestre', (r) => califDesdeBd(r.calificacion_puntos))
  const fal = porAlumno(faltas, 'inasistencia_bimestre', (r) => (r.inasistencia_cantidad == null ? '' : String(Number(r.inasistencia_cantidad))))
  const cn = porAlumno(conds, 'conducta_bimestre', (r) => letraConducta(r.conducta_valor))

  const orden = new Map(ids.map((id, i) => [id, i]))
  return alumnos
    .filter((r) => Number(r.alumno_nivel) === BOLETAS_NIVEL_SEC)
    .map((r) => {
      const id = Number(r.alumno_id)
      const califs = cal.get(id) ?? new Map<number, Tri>()
      // En ciclos pasados el alumno ya cambió de grado: manda el grado de las materias calificadas.
      const delCiclo = [...califs.keys()].map((m) => gradoMateria.get(m)).find((g) => g != null)
      const grado = Number(delCiclo ?? r.alumno_grado)
      return {
        id,
        app: txt(r.alumno_app),
        apm: txt(r.alumno_apm),
        nombre: txt(r.alumno_nombre),
        grado: (esGradoSecundaria(grado) ? grado : 1) as SecundariaGrado,
        grupo: letraGrupoSec(Number(r.alumno_grupo)),
        cal: califs,
        cn: cn.get(id) ?? new Map<number, Tri>(),
        faltas: fal.get(id) ?? new Map<number, Tri>(),
      }
    })
    .sort((a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0))
}

function sumaFaltas(a: Alumno, materias: SecMateria[], trimestres: number[]): string {
  let suma = 0
  let alguna = false
  for (const m of materias) {
    const f = a.faltas.get(m.id)
    for (const t of trimestres) {
      if (!f?.[t - 1]) continue
      alguna = true
      suma += Number(f[t - 1])
    }
  }
  return alguna ? String(suma) : ''
}

function centro(x0: number, x1: number): number {
  return (x0 + x1) / 2
}

function pagina(doc: jsPDF, fondoUrl: string, a: Alumno, materiasGrado: SecMateria[], ciclo: number, periodo: number) {
  fondo(doc, fondoUrl)
  textoPx(doc, etiquetaCicloBoletas(ciclo), 1730, 520, { size: 11.7, color: ROJO_CICLO, estilo: 'bold' })

  textoPx(doc, a.app, 684, 738, { ...ESTILO_DATO, maxW: 620 })
  textoPx(doc, a.apm, 1286, 738, { ...ESTILO_DATO, maxW: 620 })
  textoPx(doc, a.nombre, 1970, 738, { ...ESTILO_DATO, maxW: 640 })
  textoPx(doc, `${etiquetaGradoSec(a.grado)} ${a.grupo}`.trim(), centro(242, 900), 938, ESTILO_DATO)
  textoPx(doc, TURNO, centro(946, 1603), 938, ESTILO_DATO)
  textoPx(doc, CCT, centro(1650, 2307), 938, ESTILO_DATO)

  const tabla = TABLA[a.grado]
  const trimestres = [1, 2, 3].filter((t) => t <= periodo)
  const conFinal = periodo >= 3
  const recorte = (v: Tri): Tri => [v[0], periodo >= 2 ? v[1] : '', periodo >= 3 ? v[2] : '']

  const seccion = (materias: SecMateria[], [y0, y1, n]: [number, number, number]) => {
    const h = (y1 - y0) / Math.max(n, materias.length, 1)
    materias.forEach((m, i) => {
      const top = y0 + i * h
      const mid = top + h / 2
      textoPx(doc, m.nombre, X_MATERIA + 26, mid, { size: 8.5, color: TINTA, estilo: 'bold', maxW: 740 })
      const cal = recorte(a.cal.get(m.id) ?? ['', '', ''])
      const cn = a.cn.get(m.id) ?? ['', '', '']
      const fal = a.faltas.get(m.id) ?? ['', '', '']
      const pintar = (valor: string, x0: number, x1: number) => {
        if (m.semaforo && valor && valor !== SIN_CALIFICACION) {
          rectPx(doc, x0 + 10, top + 7, x1 - 10, top + h - 7, colorSemaforo(Number(valor)))
        } else {
          textoPx(doc, valor, centro(x0, x1), mid, ESTILO_CELDA)
        }
      }
      for (const t of trimestres) {
        if (!cal[t - 1]) continue
        const k = (t - 1) * 3
        pintar(cal[t - 1], X_CELDAS[k], X_CELDAS[k + 1])
        textoPx(doc, cn[t - 1], centro(X_CELDAS[k + 1], X_CELDAS[k + 2]), mid, ESTILO_CELDA)
        textoPx(doc, fal[t - 1], centro(X_CELDAS[k + 2], X_CELDAS[k + 3]), mid, ESTILO_CELDA)
      }
      if (conFinal) {
        const p = promedioMateria(cal)
        if (m.semaforo && p != null) rectPx(doc, X_FINAL[0] + 14, top + 7, X_FINAL[1] - 14, top + h - 7, colorSemaforo(p))
        else textoPx(doc, promedioMateriaBoleta(cal), centro(X_FINAL[0], X_FINAL[1]), mid, ESTILO_CELDA)
        textoPx(doc, sumaFaltas(a, [m], [1, 2, 3]), centro(X_FINAL[1], X_FINAL[2]), mid, ESTILO_CELDA)
      }
    })
  }

  const fila = (yMid: number, valor: (periodo: 1 | 2 | 3 | 'final') => number | null, faltasDe: SecMateria[]) => {
    for (const t of trimestres) {
      const k = (t - 1) * 3
      textoPx(doc, fmtTrunc(valor(t as 1 | 2 | 3), 1), centro(X_CELDAS[k], X_CELDAS[k + 1]), yMid, ESTILO_PROM)
      textoPx(doc, sumaFaltas(a, faltasDe, [t]), centro(X_CELDAS[k + 2], X_CELDAS[k + 3]), yMid, ESTILO_PROM)
    }
    if (conFinal) {
      textoPx(doc, fmtTrunc(valor('final'), 1), centro(X_FINAL[0], X_FINAL[1]), yMid, ESTILO_PROM)
      textoPx(doc, sumaFaltas(a, faltasDe, [1, 2, 3]), centro(X_FINAL[1], X_FINAL[2]), yMid, ESTILO_PROM)
    }
  }

  const set = materiasGrado.filter((m) => m.seccion === 'set')
  const winston = materiasGrado.filter((m) => m.seccion === 'winston')
  seccion(set, tabla.set)
  seccion(winston, tabla.win)

  const calRecortada = new Map([...a.cal].map(([id, v]) => [id, recorte(v)]))
  const prom = (p: 1 | 2 | 3 | 'final') => promediosDeAlumno(materiasGrado, calRecortada, p)
  fila(centro(...tabla.promSet), (p) => prom(p).set, set)
  fila(centro(...tabla.promWin), (p) => prom(p).winston, materiasGrado)
}

async function pdfDeAlumnos(alumnos: Alumno[], ciclo: number, periodo: number): Promise<Buffer> {
  if (!alumnos.length) throw new Error('No hay alumnos de secundaria para esa boleta.')
  const materias = (await listarMateriasSec()).filter((m) => m.activa)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  for (const [i, a] of alumnos.entries()) {
    if (i > 0) doc.addPage('letter', 'portrait')
    pagina(doc, await plantillaPrimaria(PLANTILLA[a.grado]), a, materias.filter((m) => m.grado === a.grado), ciclo, periodo)
  }
  return Buffer.from(doc.output('arraybuffer'))
}

function periodoDe(raw: number | undefined): number {
  return raw && raw >= 1 && raw <= 3 ? Math.trunc(raw) : 3
}

export type BoletaPdfInput = {
  alumnoId: number
  ciclo: number
  /** Último trimestre que se imprime (1–3). Sin valor: los tres y el promedio final. */
  periodo?: number
}

export async function generarBoletaPdfBuffer(input: BoletaPdfInput): Promise<Buffer> {
  return pdfDeAlumnos(await cargarAlumnos([input.alumnoId], input.ciclo), input.ciclo, periodoDe(input.periodo))
}

/** Todas las boletas de un grupo en un solo PDF (una página por alumno, en orden de lista). */
export async function generarBoletasGrupoPdfBuffer(input: {
  ciclo: number
  grado: number
  grupo: string
  periodo?: number
}): Promise<Buffer> {
  const { data, error } = await createBoletasDb()
    .from('alumno')
    .select('alumno_id')
    .eq('alumno_nivel', BOLETAS_NIVEL_SEC)
    .eq('alumno_ciclo_escolar', input.ciclo)
    .eq('alumno_grado', input.grado)
    .eq('alumno_grupo', grupoNumeroSec(input.grupo))
    .in('alumno_status', [1, 4, 5])
    .order('alumno_app')
    .order('alumno_apm')
    .order('alumno_nombre')
  if (error) throw new Error(`Alumnos del grupo: ${error.message}`)
  const ids = ((data ?? []) as Row[]).map((r) => Number(r.alumno_id))
  return pdfDeAlumnos(await cargarAlumnos(ids, input.ciclo), input.ciclo, periodoDe(input.periodo))
}
