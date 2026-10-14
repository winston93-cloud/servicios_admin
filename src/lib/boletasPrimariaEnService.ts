import { jsPDF } from 'jspdf'
import { etiquetaCicloBoletas } from './boletasCiclo'
import { docentesPorGrupoKinder } from './boletasKinderDocentesGrupo'
import {
  BOLETAS_NIVEL_PRIMARIA,
  PRIMARIA_NO_APLICA,
  cargarAlumnoPrimaria,
  mapaCalifsPrimaria,
  materiasActivasPrimaria,
  promedioPrimaria,
  validarPeriodoPrimaria,
  type PrimariaAlumno,
  type PrimariaMateria,
} from './boletasPrimariaComun'
import { asistenciaPrimariaEn, type PrimariaAsistencia } from './boletasPrimariaService'
import { fondo, lineaPx, plantillaPrimaria, px, rectPx, textoPx, type Rgb } from './boletasPrimariaPdf'

const AZUL: Rgb = [9, 103, 162]
const GRIS: Rgb = [210, 211, 213]
const BLANCO: Rgb = [255, 255, 255]
const TINTA: Rgb = [35, 31, 32]
const NARANJA: Rgb = [245, 134, 52]
const LINEA: Rgb = [32, 30, 30]

/** Columnas de la plantilla (px): materia, periodos 1–3 y final. */
const T_X0 = 136
const T_X1 = 2414
const COL_LINEAS = [1151, 1467, 1782, 2098]
const COL_VAL = [1309, 1625, 1941, 2256]
const T_Y0 = 823
const T_Y1 = 2517

/** Semáforo de Mindfulness como el legacy: verde ≥ 8, amarillo ≥ 6, rojo abajo. */
function colorSemaforo(v: string): Rgb | null {
  const n = Number(v)
  if (!v || !Number.isFinite(n) || n <= 0) return null
  if (n >= 8) return [0, 176, 80]
  if (n >= 6) return [255, 192, 0]
  return [255, 0, 0]
}

/**
 * Boleta de inglés sobre la plantilla legacy (`bol1.jpg`), con la tabla redibujada según el catálogo.
 * Solo se llenan los periodos hasta `bimestre`; la columna final aparece con el 3er periodo.
 */
export async function generarPdfPrimariaEn(input: {
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
  const [materias, docentes, plantilla, asistencia] = await Promise.all([
    materiasActivasPrimaria('en', alumno.grado_ui),
    docentesPorGrupoKinder('en', [BOLETAS_NIVEL_PRIMARIA]).catch(
      () => new Map<string, { maestroId: number; nombre: string }>()
    ),
    plantillaPrimaria('primaria-en/bol1.jpg'),
    asistenciaPrimariaEn(alumnoId, ciclo, bimestres),
  ])
  const mapa = await mapaCalifsPrimaria('en', alumnoId, ciclo, bimestres, materias.map((m) => m.id))
  return dibujarPdfPrimariaEn({
    alumno,
    bimestre,
    ciclo,
    materias,
    mapa,
    asistencia,
    teacher: docentes.get(`${alumno.grado_ui}-${alumno.grupo_letra}`)?.nombre ?? '',
    plantilla,
  })
}

export function dibujarPdfPrimariaEn(d: {
  alumno: Pick<PrimariaAlumno, 'nombre' | 'grado_ui' | 'grupo_letra'>
  bimestre: number
  ciclo: number
  materias: PrimariaMateria[]
  mapa: Map<string, string>
  asistencia: Map<number, PrimariaAsistencia>
  teacher: string
  plantilla: string
}): Buffer {
  const { alumno, bimestre, ciclo, materias, mapa, asistencia } = d
  const bimestres = [1, 2, 3].filter((b) => b <= bimestre)
  const valor = (b: number, id: number) => (b <= bimestre ? (mapa.get(`${b}-${id}`) ?? '') : '')
  const conFinal = bimestre === 3

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  fondo(doc, d.plantilla)

  rectPx(doc, 525, 332, 1025, 376, BLANCO)
  textoPx(doc, `SCHOOL YEAR ${etiquetaCicloBoletas(ciclo)}`, 532, 354, { size: 9.5, estilo: 'bold', color: NARANJA })
  const dato = { size: 10.5, estilo: 'bold' as const, color: TINTA }
  textoPx(doc, alumno.nombre, 505, 559, { ...dato, maxW: 1880 })
  textoPx(doc, `${alumno.grado_ui}° ${alumno.grupo_letra}`, 545, 653, { ...dato, maxW: 240 })
  textoPx(doc, d.teacher, 1160, 653, { ...dato, maxW: 1250 })

  const subjects = materias.filter((m) => m.seccion === 'subject')
  const extra = materias.filter((m) => m.seccion === 'extra')
  const skills = materias.filter((m) => m.seccion === 'skill')

  const BAR = 66
  const filasFijas = subjects.length + extra.length + 2
  const disponible = T_Y1 - T_Y0 - BAR * 3
  let ROW = 58
  if (filasFijas * ROW + skills.length * 70 > disponible) {
    ROW = Math.max(40, (disponible - skills.length * 70) / filasFijas)
  }
  const skillH = skills.length ? Math.min(140, (disponible - filasFijas * ROW) / skills.length) : 0

  rectPx(doc, T_X0, T_Y0, T_X1, T_Y1, BLANCO)
  let y = T_Y0

  const filaEtiqueta = (en: string, es: string, alto: number, idx: number, multilinea: boolean) => {
    if (idx % 2 === 1) rectPx(doc, T_X0, y, T_X1, y + alto, GRIS)
    const anchoCol = COL_LINEAS[0] - T_X0 - 50
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    const anchoEn = doc.getTextWidth(en) / px(1)
    const libre = anchoCol - anchoEn - 40
    if (multilinea && es) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      const lineas = doc.splitTextToSize(es, px(Math.max(300, libre))) as string[]
      textoPx(doc, en, 160, y + alto / 2, { size: 9, estilo: 'bold', color: TINTA, maxW: anchoCol - 320 })
      const salto = 40
      lineas.slice(0, 3).forEach((l, i) =>
        textoPx(doc, l, COL_LINEAS[0] - 26, y + alto / 2 + (i - (Math.min(lineas.length, 3) - 1) / 2) * salto, {
          size: 9,
          estilo: 'italic',
          color: TINTA,
          align: 'right',
        })
      )
    } else {
      textoPx(doc, en, 160, y + alto / 2, { size: 9, estilo: 'bold', color: TINTA, maxW: es ? anchoCol * 0.45 : anchoCol })
      if (es) {
        textoPx(doc, es, COL_LINEAS[0] - 26, y + alto / 2, {
          size: 9,
          estilo: 'italic',
          color: TINTA,
          align: 'right',
          maxW: Math.max(300, libre),
        })
      }
    }
  }

  const celda = (texto: string, col: number, alto: number, semaforo = false) => {
    if (!texto) return
    const color = semaforo && texto !== PRIMARIA_NO_APLICA ? colorSemaforo(texto) : null
    if (color) {
      const x0 = COL_LINEAS[col] + 40
      const x1 = (COL_LINEAS[col + 1] ?? T_X1) - 40
      rectPx(doc, x0, y + alto * 0.18, x1, y + alto * 0.82, color)
      return
    }
    textoPx(doc, texto, COL_VAL[col], y + alto / 2, { size: 10, color: TINTA, align: 'center' })
  }

  const lineasColumnas = (yA: number, yB: number) => {
    for (const x of COL_LINEAS) lineaPx(doc, x, yA, x, yB, LINEA, 3)
  }

  const barra = (texto: string, centrado: boolean, valores?: string[]) => {
    rectPx(doc, T_X0, y, T_X1, y + BAR, AZUL)
    textoPx(doc, texto, centrado ? (T_X0 + COL_LINEAS[0]) / 2 : 160, y + BAR / 2, {
      size: 9,
      estilo: 'bold',
      color: BLANCO,
      align: centrado ? 'center' : 'left',
    })
    valores?.forEach((v, i) => textoPx(doc, v, COL_VAL[i], y + BAR / 2, { size: 10, estilo: 'bold', color: BLANCO, align: 'center' }))
    y += BAR
  }

  const finalMateria = (m: PrimariaMateria) => (conFinal ? promedioPrimaria([1, 2, 3].map((b) => valor(b, m.id))) : '')

  const filasMaterias = (lista: PrimariaMateria[], alto: number, conPromedioFinal: boolean, multilinea: boolean) => {
    const yA = y
    lista.forEach((m, i) => {
      filaEtiqueta(m.nombre, m.nombreAlt, alto, i, multilinea)
      ;[1, 2, 3].forEach((b) => celda(valor(b, m.id), b - 1, alto, m.semaforo))
      if (conPromedioFinal) celda(finalMateria(m), 3, alto, m.semaforo)
      y += alto
    })
    lineasColumnas(yA, y)
  }

  // Subjects + promedio por periodo.
  filasMaterias(subjects, ROW, true, false)
  const enProm = subjects.filter((m) => m.enPromedio)
  const promTri = [1, 2, 3].map((b) => promedioPrimaria(enProm.map((m) => valor(b, m.id))))
  const promFinal = conFinal ? promedioPrimaria(enProm.map(finalMateria)) : ''
  barra('AVERAGE (PROMEDIO)', true, [...promTri, promFinal])

  if (extra.length) filasMaterias(extra, ROW, true, false)

  barra('SCHOOL ATTENDANCE (ASISTENCIA)', true)
  const yAtt = y
  const sumar = (campo: 'school_days' | 'days_absent') => {
    const nums = bimestres.map((b) => Number(asistencia.get(b)?.[campo] || NaN)).filter(Number.isFinite)
    return conFinal && nums.length ? String(nums.reduce((a, b) => a + b, 0)) : ''
  }
  ;(
    [
      ['School days', 'Días de clase', 'school_days'],
      ['Absences', 'Inasistencias', 'days_absent'],
    ] as const
  ).forEach(([en, es, campo], i) => {
    filaEtiqueta(en, es, ROW, i, false)
    bimestres.forEach((b) => celda(asistencia.get(b)?.[campo] ?? '', b - 1, ROW))
    celda(sumar(campo), 3, ROW)
    y += ROW
  })
  lineasColumnas(yAtt, y)

  barra('BEHAVIORAL SKILLS (HABILIDADES CONDUCTUALES)', false)
  filasMaterias(skills, skillH, false, true)

  lineaPx(doc, T_X0, T_Y0, T_X0, Math.max(y, T_Y1), LINEA, 3)
  lineaPx(doc, T_X1, T_Y0, T_X1, Math.max(y, T_Y1), LINEA, 3)
  lineaPx(doc, T_X0, Math.max(y, T_Y1), T_X1, Math.max(y, T_Y1), LINEA, 3)

  return Buffer.from(doc.output('arraybuffer'))
}
