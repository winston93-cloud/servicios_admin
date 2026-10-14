import { jsPDF } from 'jspdf'
import { etiquetaCicloBoletas } from './boletasCiclo'
import { docentesPorGrupoKinder } from './boletasKinderDocentesGrupo'
import {
  BOLETAS_NIVEL_PRIMARIA,
  PRIMARIA_SECCIONES,
  cargarAlumnoPrimaria,
  formatoCalificacion,
  mapaCalifsPrimaria,
  materiasActivasPrimaria,
  promedioPrimaria,
  validarPeriodoPrimaria,
  type PrimariaAlumno,
  type PrimariaMateria,
} from './boletasPrimariaComun'
import { fondo, lineaPx, plantillaPrimaria, rectPx, textoPx, type Rgb } from './boletasPrimariaPdf'

const NAVY: Rgb = [62, 64, 149]
const GRIS: Rgb = [210, 211, 213]
const BLANCO: Rgb = [255, 255, 255]
const TINTA: Rgb = [35, 31, 32]
const NARANJA: Rgb = [247, 134, 50]
const AZUL_HAB: Rgb = [0, 0, 254]
const GRIS_HAB: Rgb = [234, 240, 238]
const LINEA: Rgb = [90, 90, 90]

/** Columnas de la plantilla (px): asignatura, trimestres I–III y promedio anual. */
const T_X0 = 294
const T_X1 = 2253
const COL_NOMBRE_FIN = 1086
const COL_TRI = [1212, 1464, 1716]
const COL_LINEAS = [1086, 1338, 1590, 1842]
const CAJA_ANUAL: [number, number] = [2035, 2245]

/** Secciones que entran al promedio final (las extracurriculares llevan su propio promedio). */
const NO_EN_FINAL = new Set(['extra'])

/**
 * Boleta de español sobre la plantilla legacy (`boleta1.jpg` + `atras.jpg`).
 * La tabla se redibuja con el catálogo vigente; solo se llenan los trimestres hasta `bimestre`.
 */
export async function generarPdfPrimariaEs(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<Buffer> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  validarPeriodoPrimaria(bimestre, ciclo)
  const alumno = await cargarAlumnoPrimaria(alumnoId)
  const bimestres = [1, 2, 3].filter((b) => b <= bimestre)
  const [materias, docentes, frente, reverso] = await Promise.all([
    materiasActivasPrimaria('es', alumno.grado_ui),
    docentesPorGrupoKinder('es', [BOLETAS_NIVEL_PRIMARIA]).catch(
      () => new Map<string, { maestroId: number; nombre: string }>()
    ),
    plantillaPrimaria('primaria-es/boleta1.jpg'),
    plantillaPrimaria('primaria-es/atras.jpg'),
  ])
  const mapa = await mapaCalifsPrimaria('es', alumnoId, ciclo, bimestres, materias.map((m) => m.id))
  return dibujarPdfPrimariaEs({
    alumno,
    bimestre,
    ciclo,
    materias,
    mapa,
    profesora: docentes.get(`${alumno.grado_ui}-${alumno.grupo_letra}`)?.nombre ?? '',
    frente,
    reverso,
  })
}

export function dibujarPdfPrimariaEs(d: {
  alumno: Pick<PrimariaAlumno, 'app' | 'apm' | 'nombres' | 'grado_ui' | 'grupo_letra'>
  bimestre: number
  ciclo: number
  materias: PrimariaMateria[]
  mapa: Map<string, string>
  profesora: string
  frente: string
  reverso: string
}): Buffer {
  const { alumno, bimestre, ciclo, materias, mapa, frente, reverso } = d
  const valor = (b: number, id: number) => (b <= bimestre ? (mapa.get(`${b}-${id}`) ?? '') : '')
  const anualVisible = bimestre === 3

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })

  // ── Hoja 1: datos y asignaturas ──
  fondo(doc, frente)
  rectPx(doc, 880, 430, 1670, 478, BLANCO)
  textoPx(doc, `PRIMARIA CICLO ESCOLAR ${etiquetaCicloBoletas(ciclo)}`, 1274, 453, {
    size: 10,
    estilo: 'bold',
    color: NARANJA,
    align: 'center',
  })
  const dato = { size: 11, estilo: 'bold' as const, color: TINTA, align: 'center' as const }
  textoPx(doc, alumno.app, 683, 669, { ...dato, maxW: 560 })
  textoPx(doc, alumno.apm, 1273, 669, { ...dato, maxW: 560 })
  textoPx(doc, alumno.nombres, 1941, 669, { ...dato, maxW: 600 })
  textoPx(doc, `${alumno.grado_ui}°`, 766, 860, dato)
  textoPx(doc, alumno.grupo_letra, 1782, 860, dato)
  textoPx(doc, d.profesora, 1275, 1014, {
    ...dato,
    maxW: 1800,
  })

  const bloques = PRIMARIA_SECCIONES.es
    .filter((s) => s.formato === 'decimal')
    .map((s) => ({ seccion: s, mats: materias.filter((m) => m.seccion === s.id) }))
    .filter((b) => b.mats.length > 0)
  const nucleo = bloques.filter((b) => !NO_EN_FINAL.has(b.seccion.id))
  const extra = bloques.filter((b) => NO_EN_FINAL.has(b.seccion.id))

  const promedioBloque = (mats: PrimariaMateria[], b: number) =>
    promedioPrimaria(mats.filter((m) => m.enPromedio).map((m) => valor(b, m.id)))
  /** El anual se redondea (number_format del legacy); los promedios por trimestre se truncan. */
  const anual = (porTri: string[]) => {
    const nums = porTri.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    if (!anualVisible || !nums.length) return ''
    return formatoCalificacion(Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10)
  }
  const finalTri = [1, 2, 3].map((b) => promedioPrimaria(nucleo.map((k) => promedioBloque(k.mats, b))))

  const Y0 = 1262
  const Y_MAX = 2990
  const barras = bloques.length * 2 + (nucleo.length ? 1 : 0)
  const filas = bloques.reduce((n, b) => n + b.mats.length, 0)
  const k = Math.min(1, (Y_MAX - Y0) / (barras * 72 + filas * 75))
  const BAR = 72 * k
  const ROW = 75 * k
  rectPx(doc, T_X0 - 6, 1258, T_X1 + 8, 3000, BLANCO)

  let y = Y0
  const etiquetaBarra = { size: 9, estilo: 'bold' as const, color: BLANCO }
  const cajaAnual = (yy: number, alto: number, texto: string) => {
    textoPx(doc, 'PROMEDIO', 1855, yy + alto / 2, { size: 7.5, estilo: 'bold', color: BLANCO })
    rectPx(doc, CAJA_ANUAL[0], yy + 8 * k, CAJA_ANUAL[1], yy + alto - 8 * k, BLANCO)
    textoPx(doc, texto, (CAJA_ANUAL[0] + CAJA_ANUAL[1]) / 2, yy + alto / 2, {
      size: 10,
      estilo: 'bold',
      color: TINTA,
      align: 'center',
    })
  }

  const dibujarBloque = (b: (typeof bloques)[number]) => {
    const porTri = [1, 2, 3].map((t) => promedioBloque(b.mats, t))
    rectPx(doc, T_X0, y, T_X1, y + BAR - 2, NAVY)
    textoPx(doc, b.seccion.titulo.toUpperCase(), 330, y + BAR / 2, { ...etiquetaBarra, maxW: 1500 })
    cajaAnual(y, BAR - 2, anual(porTri))
    y += BAR
    const yMat = y
    for (const m of b.mats) {
      textoPx(doc, m.nombre, 345, y + ROW / 2, { size: 10.5, estilo: 'bold', color: TINTA, maxW: COL_NOMBRE_FIN - 370 })
      COL_TRI.forEach((x, i) => textoPx(doc, valor(i + 1, m.id), x, y + ROW / 2, { size: 10.5, color: TINTA, align: 'center' }))
      y += ROW
    }
    for (const x of [T_X0, ...COL_LINEAS, T_X1]) lineaPx(doc, x, yMat, x, y, LINEA, x === T_X0 || x === T_X1 ? 2 : 3)
    lineaPx(doc, T_X0, y, T_X1, y, LINEA, 2)
    rectPx(doc, T_X0, y, COL_NOMBRE_FIN - 1, y + BAR - 2, NAVY)
    textoPx(doc, 'PROMEDIO', 330, y + BAR / 2, etiquetaBarra)
    for (let i = 0; i < 4; i++) {
      rectPx(doc, COL_LINEAS[i] + 2, y, (COL_LINEAS[i + 1] ?? T_X1) - 2, y + BAR - 2, GRIS)
    }
    COL_TRI.forEach((x, i) =>
      textoPx(doc, porTri[i], x, y + BAR / 2, { size: 10, estilo: 'bold', color: TINTA, align: 'center' })
    )
    y += BAR
  }

  nucleo.forEach(dibujarBloque)
  if (nucleo.length) {
    rectPx(doc, T_X0, y, T_X1, y + BAR - 2, NAVY)
    textoPx(doc, 'PROMEDIO FINAL', 330, y + BAR / 2, etiquetaBarra)
    COL_TRI.forEach((x, i) =>
      textoPx(doc, finalTri[i], x, y + BAR / 2, { size: 10, estilo: 'bold', color: BLANCO, align: 'center' })
    )
    cajaAnual(y, BAR - 2, anual(finalTri))
    y += BAR
  }
  extra.forEach(dibujarBloque)

  // ── Hoja 2: habilidades conductuales ──
  doc.addPage()
  fondo(doc, reverso)
  const hab = materias.filter((m) => m.seccion === 'habilidades')
  const H_X0 = 308
  const H_X1 = 2266
  const H_Y0 = 950
  const rowH = hab.length ? Math.min(58, 578 / hab.length) : 58
  rectPx(doc, H_X0 - 8, H_Y0, H_X1 + 8, 1376, BLANCO)
  hab.forEach((m, i) => {
    const yy = H_Y0 + i * rowH
    if (i % 2 === 1) rectPx(doc, H_X0, yy, H_X1, yy + rowH, GRIS_HAB)
    textoPx(doc, m.nombre, 340, yy + rowH / 2, { size: 10, color: TINTA, maxW: 1258 - 360 })
    ;[1384, 1636, 1888].forEach((x, t) =>
      textoPx(doc, valor(t + 1, m.id), x, yy + rowH / 2, { size: 10, estilo: 'bold', color: TINTA, align: 'center' })
    )
  })
  const yFin = H_Y0 + hab.length * rowH
  for (const x of [1258, 1510, 1762, 2014]) lineaPx(doc, x, H_Y0, x, yFin, [0, 0, 0], 3)
  rectPx(doc, H_X0, yFin, H_X1, yFin + 72, AZUL_HAB)

  return Buffer.from(doc.output('arraybuffer'))
}
