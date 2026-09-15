import { readFile } from 'fs/promises'
import path from 'path'
import { jsPDF } from 'jspdf'
import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_PRIMARIA,
  PRIMARIA_EN_GRADOS,
  colorMindfulnessPrimaria,
  grupoNumeroDesdeLetra,
  letraDesdeGrupoNumero,
  materiasPorGrado,
  promedioSubjectsNumerico,
  skillsCatalogo,
  teacherInglesPrimaria,
  type PrimariaEnGrado,
  type PrimariaEnMateria,
  type PrimariaEnSkill,
} from './boletasPrimariaEnCatalog'
import { etiquetaCicloBoletas } from './boletasCiclo'

const STATUS_ACTIVOS = [1, 4, 5] as const
const TABLE_CAL = 'boleta_calificacion_primaria_en'
const TABLE_SKILL = 'boleta_skill_primaria_en'
const TABLE_ATT = 'boleta_attendance_primaria_en'

export type PrimariaEnAlumnoLista = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  alumno_grado: number
  alumno_grupo: number
  grupo_letra: string
}

export type PrimariaEnCapturaMateria = PrimariaEnMateria & {
  calificacion: string
}

export type PrimariaEnCapturaSkill = PrimariaEnSkill & {
  calificacion: string
}

export type PrimariaEnAttendance = {
  school_days: string
  days_absent: string
}

export type PrimariaEnCaptura = {
  alumno: PrimariaEnAlumnoLista
  bimestre: number
  ciclo: number
  subjects: PrimariaEnCapturaMateria[]
  skills: PrimariaEnCapturaSkill[]
  attendance: PrimariaEnAttendance
  promedioSugerido: string
}

function nombreAlumno(a: {
  alumno_app?: unknown
  alumno_apm?: unknown
  alumno_nombre?: unknown
}): string {
  return [a.alumno_app, a.alumno_apm, a.alumno_nombre]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function asGrado(n: number): PrimariaEnGrado {
  if (n >= 1 && n <= 6) return n as PrimariaEnGrado
  throw new Error('Grado inválido (use 1–6)')
}

export async function listarAlumnos(input: {
  grado: number
  grupoLetra: string
  ciclo: number
}): Promise<PrimariaEnAlumnoLista[]> {
  const grado = asGrado(Number(input.grado))
  const grupoNum = grupoNumeroDesdeLetra(input.grupoLetra)
  if (!grupoNum || grupoNum > 3) throw new Error('Grupo inválido (A–C)')
  const ciclo = Number(input.ciclo)
  if (!ciclo) throw new Error('Ciclo requerido')

  const db = createBoletasDb()
  const { data, error } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel, alumno_status, alumno_ciclo_escolar'
    )
    .eq('alumno_nivel', BOLETAS_NIVEL_PRIMARIA)
    .eq('alumno_grado', grado)
    .eq('alumno_grupo', grupoNum)
    .eq('alumno_ciclo_escolar', ciclo)
    .in('alumno_status', [...STATUS_ACTIVOS])
    .order('alumno_app')

  if (error) throw new Error(error.message)

  return (data ?? []).map((a) => {
    const g = Number(a.alumno_grupo)
    return {
      alumno_id: Number(a.alumno_id),
      alumno_ref: a.alumno_ref != null ? Number(a.alumno_ref) : null,
      nombre: nombreAlumno(a),
      alumno_grado: Number(a.alumno_grado),
      alumno_grupo: g,
      grupo_letra: letraDesdeGrupoNumero(g),
    }
  })
}

async function cargarAlumnoPrimaria(alumnoId: number): Promise<PrimariaEnAlumnoLista> {
  const db = createBoletasDb()
  const { data, error } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel, alumno_status'
    )
    .eq('alumno_id', alumnoId)
    .limit(1)

  if (error) throw new Error(error.message)
  const a = data?.[0]
  if (!a) throw new Error('Alumno no encontrado')
  if (Number(a.alumno_nivel) !== BOLETAS_NIVEL_PRIMARIA) {
    throw new Error('El alumno no es de primaria')
  }
  const g = Number(a.alumno_grupo)
  return {
    alumno_id: Number(a.alumno_id),
    alumno_ref: a.alumno_ref != null ? Number(a.alumno_ref) : null,
    nombre: nombreAlumno(a),
    alumno_grado: Number(a.alumno_grado),
    alumno_grupo: g,
    grupo_letra: letraDesdeGrupoNumero(g),
  }
}

async function mapaMaterias(
  alumnoId: number,
  bimestre: number,
  ciclo: number,
  ids: number[]
): Promise<Map<number, string>> {
  if (!ids.length) return new Map()
  const db = createBoletasDb()
  const { data, error } = await db
    .from(TABLE_CAL)
    .select('materia_id, calificacion')
    .eq('alumno_id', alumnoId)
    .eq('bimestre', bimestre)
    .eq('ciclo', ciclo)
    .in('materia_id', ids)
  if (error) throw new Error(error.message)
  return new Map((data ?? []).map((r) => [Number(r.materia_id), String(r.calificacion ?? '')]))
}

async function mapaSkills(
  alumnoId: number,
  bimestre: number,
  ciclo: number,
  ids: number[]
): Promise<Map<number, string>> {
  if (!ids.length) return new Map()
  const db = createBoletasDb()
  const { data, error } = await db
    .from(TABLE_SKILL)
    .select('skill_id, calificacion')
    .eq('alumno_id', alumnoId)
    .eq('bimestre', bimestre)
    .eq('ciclo', ciclo)
    .in('skill_id', ids)
  if (error) throw new Error(error.message)
  return new Map((data ?? []).map((r) => [Number(r.skill_id), String(r.calificacion ?? '')]))
}

export async function obtenerCaptura(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<PrimariaEnCaptura> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  if (bimestre < 1 || bimestre > 3) throw new Error('Bimestre inválido (1–3)')
  if (!ciclo) throw new Error('Ciclo requerido')

  const alumno = await cargarAlumnoPrimaria(alumnoId)
  const grado = asGrado(alumno.alumno_grado)
  const subjectsCat = materiasPorGrado(grado)
  const skillsCat = skillsCatalogo()

  const [mapaSub, mapaSkill] = await Promise.all([
    mapaMaterias(alumnoId, bimestre, ciclo, subjectsCat.map((m) => m.id)),
    mapaSkills(alumnoId, bimestre, ciclo, skillsCat.map((s) => s.id)),
  ])

  const db = createBoletasDb()
  const { data: attRows, error: attErr } = await db
    .from(TABLE_ATT)
    .select('school_days, days_absent')
    .eq('alumno_id', alumnoId)
    .eq('bimestre', bimestre)
    .eq('ciclo', ciclo)
    .limit(1)
  if (attErr) throw new Error(attErr.message)
  const att = attRows?.[0]

  const subjects = subjectsCat.map((m) => ({
    ...m,
    calificacion: mapaSub.get(m.id) ?? '',
  }))

  return {
    alumno,
    bimestre,
    ciclo,
    subjects,
    skills: skillsCat.map((s) => ({
      ...s,
      calificacion: mapaSkill.get(s.id) ?? '',
    })),
    attendance: {
      school_days: String(att?.school_days ?? ''),
      days_absent: String(att?.days_absent ?? ''),
    },
    promedioSugerido: promedioSubjectsNumerico(subjects, subjectsCat),
  }
}

async function upsertPorId(
  table: string,
  idCol: 'materia_id' | 'skill_id',
  alumnoId: number,
  bimestre: number,
  ciclo: number,
  permitidos: Set<number>,
  valores: Record<number, string> | undefined
): Promise<number> {
  const ahora = new Date().toISOString()
  const filas: Record<string, unknown>[] = []

  for (const [rawId, rawVal] of Object.entries(valores ?? {})) {
    const id = Number(rawId)
    if (!permitidos.has(id)) continue
    filas.push({
      alumno_id: alumnoId,
      [idCol]: id,
      bimestre,
      ciclo,
      calificacion: String(rawVal ?? '').trim().slice(0, 40),
      updated_at: ahora,
    })
  }
  if (!filas.length) return 0

  const db = createBoletasDb()
  const { error } = await db.from(table).upsert(filas, {
    onConflict: `alumno_id,${idCol},bimestre,ciclo`,
  })
  if (error) throw new Error(error.message)
  return filas.length
}

export async function guardarCaptura(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
  subjects?: Record<number, string>
  skills?: Record<number, string>
  attendance?: Partial<PrimariaEnAttendance>
}): Promise<{ saved: number }> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  if (bimestre < 1 || bimestre > 3) throw new Error('Bimestre inválido (1–3)')
  if (!ciclo) throw new Error('Ciclo requerido')

  const alumno = await cargarAlumnoPrimaria(alumnoId)
  const grado = asGrado(alumno.alumno_grado)
  let saved = 0

  saved += await upsertPorId(
    TABLE_CAL,
    'materia_id',
    alumnoId,
    bimestre,
    ciclo,
    new Set(materiasPorGrado(grado).map((m) => m.id)),
    input.subjects
  )
  saved += await upsertPorId(
    TABLE_SKILL,
    'skill_id',
    alumnoId,
    bimestre,
    ciclo,
    new Set(skillsCatalogo().map((s) => s.id)),
    input.skills
  )

  if (input.attendance) {
    const db = createBoletasDb()
    const { error } = await db.from(TABLE_ATT).upsert(
      [
        {
          alumno_id: alumnoId,
          bimestre,
          ciclo,
          school_days: String(input.attendance.school_days ?? '').trim().slice(0, 20),
          days_absent: String(input.attendance.days_absent ?? '').trim().slice(0, 20),
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'alumno_id,bimestre,ciclo' }
    )
    if (error) throw new Error(error.message)
    saved += 1
  }

  return { saved }
}

function pdfSeccion(
  doc: jsPDF,
  title: string,
  filas: { nombre: string; calificacion: string; mindfulnessColor?: boolean }[],
  pageW: number,
  yStart: number
): number {
  let y = yStart
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(0)
  doc.text(title, 14, y)
  y += 5
  doc.setFontSize(8)
  doc.text('Indicator', 14, y)
  doc.text('Grade', 160, y)
  y += 3
  doc.setDrawColor(180)
  doc.line(14, y, pageW - 14, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  for (const f of filas) {
    if (y > 265) {
      doc.addPage()
      y = 18
    }
    doc.setTextColor(0)
    doc.text(f.nombre.slice(0, 72), 14, y)
    const cal = f.calificacion.trim() || '—'
    if (f.mindfulnessColor && cal !== '—') {
      const rgb = colorMindfulnessPrimaria(cal)
      if (rgb) {
        doc.setFillColor(rgb[0], rgb[1], rgb[2])
        doc.rect(158, y - 3.2, 14, 4, 'F')
        y += 5
        continue
      }
    }
    doc.text(cal.slice(0, 20), 160, y)
    y += 5
  }
  return y + 4
}

async function loadPlantillaBase64(): Promise<string | null> {
  try {
    const abs = path.join(process.cwd(), 'public', 'boletas', 'primaria-en', 'bol1.png')
    const buf = await readFile(abs)
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export async function generarPdfPrimariaEn(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<Buffer> {
  const captura = await obtenerCaptura(input)
  const { alumno, bimestre, ciclo } = captura
  const grado = asGrado(alumno.alumno_grado)
  const gradoEtiqueta =
    PRIMARIA_EN_GRADOS.find((g) => g.valor === grado)?.etiqueta ?? `${grado}°`
  const teacher = teacherInglesPrimaria(grado, alumno.alumno_grupo)
  const plantilla = await loadPlantillaBase64()

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  if (plantilla) {
    doc.addImage(plantilla, 'PNG', 10, 8, 170, 265)
    doc.addPage()
  }

  let y = 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('INSTITUTO WINSTON CHURCHILL', pageW / 2, y, { align: 'center' })
  y += 7
  doc.setFontSize(11)
  doc.text('Report Card · Primaria Inglés', pageW / 2, y, { align: 'center' })
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Student: ${alumno.nombre}`, 14, y)
  y += 5
  doc.text(
    `Ref: ${String(alumno.alumno_ref ?? '').padStart(5, '0')}   Grade: ${gradoEtiqueta} ${alumno.grupo_letra}   Term: ${bimestre}   School Year: ${etiquetaCicloBoletas(ciclo)}`,
    14,
    y
  )
  y += 5
  if (teacher) {
    doc.text(`Teacher: ${teacher}`, 14, y)
    y += 5
  }
  y += 4

  y = pdfSeccion(
    doc,
    'SUBJECTS',
    captura.subjects.map((i) => ({
      nombre: i.nombre,
      calificacion: i.calificacion,
      mindfulnessColor: i.mindfulnessColor,
    })),
    pageW,
    y
  )

  if (captura.promedioSugerido) {
    if (y > 265) {
      doc.addPage()
      y = 18
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(0)
    doc.text(
      `AVERAGE (excl. Mindfulness / Computer / Faith): ${captura.promedioSugerido}`,
      14,
      y
    )
    y += 8
  }

  y = pdfSeccion(
    doc,
    'BEHAVIORAL SKILLS',
    captura.skills.map((i) => ({ nombre: i.nombre, calificacion: i.calificacion })),
    pageW,
    y
  )

  if (y > 255) {
    doc.addPage()
    y = 18
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('ATTENDANCE', 14, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`School days: ${captura.attendance.school_days.trim() || '—'}`, 14, y)
  y += 5
  doc.text(`Days absent: ${captura.attendance.days_absent.trim() || '—'}`, 14, y)
  y += 8

  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(
    'Generated by servicios_admin / boletas primaria-ingles (InsForge).',
    14,
    Math.min(y, pageH - 12)
  )
  doc.setTextColor(0)

  return Buffer.from(doc.output('arraybuffer'))
}
