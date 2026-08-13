import { jsPDF } from 'jspdf'
import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_SECUNDARIA,
  MATERIA_IDS_MINDFULNESS,
  etiquetaCicloBoletas,
  etiquetaGradoSecundaria,
  letraDesdeGrupoNum,
} from './boletasCiclo'

function parseNota(raw: string | number | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).trim().replace(/,/g, '.')
  if (!s || /^-+$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0 || n > 10) return null
  return n
}

function truncar(n: number, dec: number): number {
  const f = 10 ** dec
  return Math.floor(Math.abs(n) * f + 1e-9) / f * (n < 0 ? -1 : 1)
}

function promedioLista(vals: number[], dec: number): number | null {
  if (!vals.length) return null
  return truncar(vals.reduce((a, b) => a + b, 0) / vals.length, dec)
}

function fmt(n: number | null): string {
  if (n == null) return '—'
  return n.toFixed(1)
}

export type BoletaPdfInput = {
  alumnoId: number
  ciclo: number
  /** Si se omite, incluye bimestres 1–3. */
  periodo?: number
}

/**
 * PDF boleta secundaria (paridad funcional con BoletaPdfGenerator.php).
 * Plantillas 7mo/8vo/9no; excluye mindfulness del promedio Winston.
 */
export async function generarBoletaPdfBuffer(input: BoletaPdfInput): Promise<Buffer> {
  const db = createBoletasDb()
  const { data: alumnos, error } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel'
    )
    .eq('alumno_id', input.alumnoId)
    .limit(1)

  if (error) throw new Error(error.message)
  const alumno = alumnos?.[0]
  if (!alumno) throw new Error('Alumno no encontrado')
  if (Number(alumno.alumno_nivel) !== BOLETAS_NIVEL_SECUNDARIA) {
    throw new Error('El alumno no es de secundaria')
  }

  const grado = Number(alumno.alumno_grado)
  const grupoLetra = letraDesdeGrupoNum(Number(alumno.alumno_grupo))
  const nombre = [alumno.alumno_app, alumno.alumno_apm, alumno.alumno_nombre]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')

  const { data: materias } = await db
    .from('boleta_materia')
    .select('materia_id, materia_nombre, materia_grado, materia_orden')
    .eq('materia_nivel', BOLETAS_NIVEL_SECUNDARIA)
    .eq('materia_grado', grado)
    .order('materia_orden')

  const matList = (materias ?? []).filter(
    (m) => !MATERIA_IDS_MINDFULNESS.includes(Number(m.materia_id) as 45 | 46 | 47)
  )
  const mindList = (materias ?? []).filter((m) =>
    MATERIA_IDS_MINDFULNESS.includes(Number(m.materia_id) as 45 | 46 | 47)
  )

  const bimestres = input.periodo ? [input.periodo] : [1, 2, 3]
  const materiaIds = (materias ?? []).map((m) => Number(m.materia_id))

  const { data: cals } = materiaIds.length
    ? await db
        .from('boleta_calificacion')
        .select('materia_id, calificacion_bimestre, calificacion_puntos')
        .eq('alumno_id', input.alumnoId)
        .eq('calificacion_ciclo_escolar', input.ciclo)
        .in('calificacion_bimestre', bimestres.length === 3 ? [1, 2, 3] : bimestres)
        .in('materia_id', materiaIds)
    : { data: [] as { materia_id: number; calificacion_bimestre: number; calificacion_puntos: string }[] }

  const { data: inas } = materiaIds.length
    ? await db
        .from('boleta_inasistencia')
        .select('materia_id, inasistencia_bimestre, inasistencia_cantidad')
        .eq('alumno_id', input.alumnoId)
        .eq('inasistencia_ciclo_escolar', input.ciclo)
        .in('inasistencia_bimestre', [1, 2, 3])
        .in('materia_id', materiaIds)
    : { data: [] as { materia_id: number; inasistencia_bimestre: number; inasistencia_cantidad: number }[] }

  const { data: comps } = await db
    .from('boleta_comprension_lectora')
    .select('comprension_trimestre, comprension_valor')
    .eq('alumno_id', input.alumnoId)
    .eq('comprension_ciclo_escolar', input.ciclo)

  const nota = (materiaId: number, bim: number): string => {
    const row = (cals ?? []).find(
      (c) => Number(c.materia_id) === materiaId && Number(c.calificacion_bimestre) === bim
    )
    const v = row?.calificacion_puntos
    return v == null || String(v).trim() === '' ? '—' : String(v).trim()
  }

  const falts = (materiaId: number, bim: number): number => {
    const row = (inas ?? []).find(
      (c) => Number(c.materia_id) === materiaId && Number(c.inasistencia_bimestre) === bim
    )
    return Number(row?.inasistencia_cantidad ?? 0)
  }

  // Promedio Winston por bimestre (sin mindfulness)
  const promBim: Record<number, number | null> = { 1: null, 2: null, 3: null }
  for (const bim of [1, 2, 3] as const) {
    const vals: number[] = []
    for (const m of matList) {
      const n = parseNota(nota(Number(m.materia_id), bim))
      if (n != null) vals.push(n)
    }
    promBim[bim] = promedioLista(vals, 1)
  }
  const promFinal = promedioLista(
    [promBim[1], promBim[2], promBim[3]].filter((x): x is number => x != null),
    1
  )

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('INSTITUTO WINSTON CHURCHILL', pageW / 2, y, { align: 'center' })
  y += 7
  doc.setFontSize(11)
  doc.text('Boleta de calificaciones — Secundaria', pageW / 2, y, { align: 'center' })
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Alumno: ${nombre}`, 14, y)
  y += 5
  doc.text(
    `Ref: ${String(alumno.alumno_ref ?? '').padStart(5, '0')}   Grado: ${etiquetaGradoSecundaria(grado)} ${grupoLetra}   Ciclo: ${etiquetaCicloBoletas(input.ciclo)}`,
    14,
    y
  )
  y += 8

  // Encabezado tabla
  const colX = [14, 78, 98, 118, 138, 158]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Materia', colX[0], y)
  doc.text('1°', colX[1], y)
  doc.text('2°', colX[2], y)
  doc.text('3°', colX[3], y)
  doc.text('Prom', colX[4], y)
  doc.text('Faltas', colX[5], y)
  y += 4
  doc.setDrawColor(180)
  doc.line(14, y, pageW - 14, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  const drawMateriaRows = (lista: typeof matList, titulo?: string) => {
    if (titulo) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(titulo, 14, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
    }
    for (const m of lista) {
      if (y > 260) {
        doc.addPage()
        y = 18
      }
      const mid = Number(m.materia_id)
      const n1 = parseNota(nota(mid, 1))
      const n2 = parseNota(nota(mid, 2))
      const n3 = parseNota(nota(mid, 3))
      const pMat = promedioLista([n1, n2, n3].filter((x): x is number => x != null), 1)
      const fTot = falts(mid, 1) + falts(mid, 2) + falts(mid, 3)
      const nombreMat = String(m.materia_nombre).slice(0, 42)
      doc.text(nombreMat, colX[0], y)
      doc.text(nota(mid, 1), colX[1], y)
      doc.text(nota(mid, 2), colX[2], y)
      doc.text(nota(mid, 3), colX[3], y)
      doc.text(fmt(pMat), colX[4], y)
      doc.text(String(fTot), colX[5], y)
      y += 4.5
    }
  }

  drawMateriaRows(matList, 'Plan Winston')
  y += 2
  if (mindList.length) {
    drawMateriaRows(mindList, 'Complementarias (no promedian)')
    y += 2
  }

  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(
    `Promedio Winston — 1°: ${fmt(promBim[1])}   2°: ${fmt(promBim[2])}   3°: ${fmt(promBim[3])}   Final: ${fmt(promFinal)}`,
    14,
    y
  )
  y += 8

  // Comprensión lectora
  doc.setFont('helvetica', 'bold')
  doc.text('Comprensión lectora', 14, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  for (const bim of [1, 2, 3]) {
    const row = (comps ?? []).find((c) => Number(c.comprension_trimestre) === bim)
    const v = row?.comprension_valor != null ? String(row.comprension_valor) : '—'
    doc.text(`Periodo ${bim}: ${v}`, 18, y)
    y += 4.5
  }

  y += 10
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Documento generado por servicios_admin / boletas-secundaria (InsForge).', 14, y)
  doc.setTextColor(0)

  const ab = doc.output('arraybuffer')
  return Buffer.from(ab)
}
