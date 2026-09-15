import { jsPDF } from 'jspdf'
import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_KINDER,
  BOLETAS_NIVEL_MATERNAL,
  KINDER_EN_GRADOS,
  KINDER_EN_SUBJECT_IDS_EXCLUIDOS_PROMEDIO,
  behavioralPorGrado,
  calificacionLetraANumero,
  esMaternal,
  grupoNumeroDesdeLetra,
  letraDesdeGrupoNumero,
  maternalIndicadores,
  promedioNumeroALetra,
  subjectsPorGrado,
  type KinderEnGrado,
  type KinderEnIndicador,
} from './boletasKinderEnCatalog'
import { etiquetaCicloBoletas } from './boletasCiclo'

const STATUS_ACTIVOS = [1, 4, 5] as const

export type KinderEnAlumnoLista = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  alumno_grado: number
  alumno_grupo: number
  grupo_letra: string
  /** 0=Maternal UI, 1–3=K1–K3 */
  grado_ui: KinderEnGrado
  nivel: number
}

export type KinderEnCapturaIndicador = KinderEnIndicador & {
  calificacion: string
}

export type KinderEnAttendance = {
  school_days: string
  days_absent: string
}

export type KinderEnCaptura = {
  alumno: KinderEnAlumnoLista
  bimestre: number
  ciclo: number
  modo: 'kinder' | 'maternal'
  subjects: KinderEnCapturaIndicador[]
  behavioral: KinderEnCapturaIndicador[]
  attendance: KinderEnAttendance
  maternal: KinderEnCapturaIndicador[]
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

function asGradoUi(n: number): KinderEnGrado {
  if (n === 0 || n === 1 || n === 2 || n === 3) return n
  throw new Error('Grado inválido (use 0 Maternal / 1–3 K1–K3)')
}

function mapAlumnoRow(
  a: {
    alumno_id: unknown
    alumno_ref?: unknown
    alumno_app?: unknown
    alumno_apm?: unknown
    alumno_nombre?: unknown
    alumno_grado?: unknown
    alumno_grupo?: unknown
    alumno_nivel?: unknown
  },
  gradoUi: KinderEnGrado
): KinderEnAlumnoLista {
  const nivel = Number(a.alumno_nivel)
  const alumnoGrado = Number(a.alumno_grado)
  const alumnoGrupo = Number(a.alumno_grupo)
  // Maternal: legacy filtra por alumno_grado = letra de grupo (A=1…).
  const grupoNum = gradoUi === 0 ? alumnoGrado : alumnoGrupo
  return {
    alumno_id: Number(a.alumno_id),
    alumno_ref: a.alumno_ref != null ? Number(a.alumno_ref) : null,
    nombre: nombreAlumno(a),
    alumno_grado: alumnoGrado,
    alumno_grupo: alumnoGrupo,
    grupo_letra: letraDesdeGrupoNumero(grupoNum || alumnoGrupo),
    grado_ui: gradoUi,
    nivel,
  }
}

export async function listarAlumnos(input: {
  grado: number
  grupoLetra: string
  ciclo: number
}): Promise<KinderEnAlumnoLista[]> {
  const gradoUi = asGradoUi(Number(input.grado))
  const grupoNum = grupoNumeroDesdeLetra(input.grupoLetra)
  if (!grupoNum) throw new Error('Grupo inválido (A–D)')
  const ciclo = Number(input.ciclo)
  if (!ciclo) throw new Error('Ciclo requerido')

  const db = createBoletasDb()
  const base = db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel, alumno_status, alumno_ciclo_escolar'
    )
    .eq('alumno_ciclo_escolar', ciclo)
    .in('alumno_status', [...STATUS_ACTIVOS])
    .order('alumno_app')

  const { data, error } = esMaternal(gradoUi)
    ? await base.eq('alumno_nivel', BOLETAS_NIVEL_MATERNAL).eq('alumno_grado', grupoNum)
    : await base
        .eq('alumno_nivel', BOLETAS_NIVEL_KINDER)
        .eq('alumno_grado', gradoUi)
        .eq('alumno_grupo', grupoNum)

  if (error) throw new Error(error.message)

  return (data ?? []).map((a) => mapAlumnoRow(a, gradoUi))
}

async function cargarAlumno(alumnoId: number): Promise<KinderEnAlumnoLista> {
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
  const nivel = Number(a.alumno_nivel)
  if (nivel === BOLETAS_NIVEL_MATERNAL) {
    return mapAlumnoRow(a, 0)
  }
  if (nivel !== BOLETAS_NIVEL_KINDER) {
    throw new Error('El alumno no es de maternal/kinder')
  }
  const grado = Number(a.alumno_grado)
  if (grado !== 1 && grado !== 2 && grado !== 3) {
    throw new Error('Grado de kinder inválido')
  }
  return mapAlumnoRow(a, grado)
}

function calcularPromedioSugerido(subjects: KinderEnCapturaIndicador[]): string {
  let suma = 0
  let cant = 0
  for (const s of subjects) {
    if (KINDER_EN_SUBJECT_IDS_EXCLUIDOS_PROMEDIO.has(s.id)) continue
    const raw = s.calificacion.trim()
    if (!raw) continue
    const n = calificacionLetraANumero(raw)
    if (n <= 0) continue
    suma += n
    cant++
  }
  if (!cant) return ''
  return promedioNumeroALetra(suma / cant)
}

async function mapaCalifs(
  table: string,
  alumnoId: number,
  bimestre: number,
  ciclo: number,
  ids: number[]
): Promise<Map<number, string>> {
  if (!ids.length) return new Map()
  const db = createBoletasDb()
  const { data, error } = await db
    .from(table)
    .select('indicador_id, calificacion')
    .eq('alumno_id', alumnoId)
    .eq('bimestre', bimestre)
    .eq('ciclo', ciclo)
    .in('indicador_id', ids)
  if (error) throw new Error(error.message)
  return new Map((data ?? []).map((r) => [Number(r.indicador_id), String(r.calificacion ?? '')]))
}

export async function obtenerCaptura(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<KinderEnCaptura> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  if (bimestre < 1 || bimestre > 3) throw new Error('Bimestre inválido (1–3)')
  if (!ciclo) throw new Error('Ciclo requerido')

  const alumno = await cargarAlumno(alumnoId)
  const grado = alumno.grado_ui

  if (esMaternal(grado)) {
    const indicadores = maternalIndicadores()
    const mapa = await mapaCalifs(
      'boleta_calificacion_maternal_en',
      alumnoId,
      bimestre,
      ciclo,
      indicadores.map((i) => i.id)
    )
    return {
      alumno,
      bimestre,
      ciclo,
      modo: 'maternal',
      subjects: [],
      behavioral: [],
      attendance: { school_days: '', days_absent: '' },
      maternal: indicadores.map((ind) => ({
        ...ind,
        calificacion: mapa.get(ind.id) ?? '',
      })),
      promedioSugerido: '',
    }
  }

  const subjectsCat = subjectsPorGrado(grado)
  const behCat = behavioralPorGrado(grado)
  const [mapaSub, mapaBeh] = await Promise.all([
    mapaCalifs(
      'boleta_calificacion_kinder_en',
      alumnoId,
      bimestre,
      ciclo,
      subjectsCat.map((i) => i.id)
    ),
    mapaCalifs(
      'boleta_behavioral_kinder_en',
      alumnoId,
      bimestre,
      ciclo,
      behCat.map((i) => i.id)
    ),
  ])

  const db = createBoletasDb()
  const { data: attRows, error: attErr } = await db
    .from('boleta_attendance_kinder_en')
    .select('school_days, days_absent')
    .eq('alumno_id', alumnoId)
    .eq('bimestre', bimestre)
    .eq('ciclo', ciclo)
    .limit(1)
  if (attErr) throw new Error(attErr.message)
  const att = attRows?.[0]

  const subjects = subjectsCat.map((ind) => ({
    ...ind,
    calificacion: mapaSub.get(ind.id) ?? '',
  }))

  return {
    alumno,
    bimestre,
    ciclo,
    modo: 'kinder',
    subjects,
    behavioral: behCat.map((ind) => ({
      ...ind,
      calificacion: mapaBeh.get(ind.id) ?? '',
    })),
    attendance: {
      school_days: String(att?.school_days ?? ''),
      days_absent: String(att?.days_absent ?? ''),
    },
    maternal: [],
    promedioSugerido: calcularPromedioSugerido(subjects),
  }
}

async function upsertIndicadores(
  table: string,
  alumnoId: number,
  bimestre: number,
  ciclo: number,
  permitidos: Set<number>,
  valores: Record<number, string> | undefined
): Promise<number> {
  const ahora = new Date().toISOString()
  const filas: {
    alumno_id: number
    indicador_id: number
    bimestre: number
    ciclo: number
    calificacion: string
    updated_at: string
  }[] = []

  for (const [rawId, rawVal] of Object.entries(valores ?? {})) {
    const indicadorId = Number(rawId)
    if (!permitidos.has(indicadorId)) continue
    filas.push({
      alumno_id: alumnoId,
      indicador_id: indicadorId,
      bimestre,
      ciclo,
      calificacion: String(rawVal ?? '').trim().slice(0, 40),
      updated_at: ahora,
    })
  }
  if (!filas.length) return 0

  const db = createBoletasDb()
  const { error } = await db.from(table).upsert(filas, {
    onConflict: 'alumno_id,indicador_id,bimestre,ciclo',
  })
  if (error) throw new Error(error.message)
  return filas.length
}

export async function guardarCaptura(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
  subjects?: Record<number, string>
  behavioral?: Record<number, string>
  maternal?: Record<number, string>
  attendance?: Partial<KinderEnAttendance>
}): Promise<{ saved: number }> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  if (bimestre < 1 || bimestre > 3) throw new Error('Bimestre inválido (1–3)')
  if (!ciclo) throw new Error('Ciclo requerido')

  const alumno = await cargarAlumno(alumnoId)
  const grado = alumno.grado_ui
  let saved = 0

  if (esMaternal(grado)) {
    saved += await upsertIndicadores(
      'boleta_calificacion_maternal_en',
      alumnoId,
      bimestre,
      ciclo,
      new Set(maternalIndicadores().map((i) => i.id)),
      input.maternal
    )
    return { saved }
  }

  saved += await upsertIndicadores(
    'boleta_calificacion_kinder_en',
    alumnoId,
    bimestre,
    ciclo,
    new Set(subjectsPorGrado(grado).map((i) => i.id)),
    input.subjects
  )
  saved += await upsertIndicadores(
    'boleta_behavioral_kinder_en',
    alumnoId,
    bimestre,
    ciclo,
    new Set(behavioralPorGrado(grado).map((i) => i.id)),
    input.behavioral
  )

  if (input.attendance) {
    const db = createBoletasDb()
    const { error } = await db.from('boleta_attendance_kinder_en').upsert(
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
  filas: { nombre: string; calificacion: string }[],
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
    doc.text(f.nombre.slice(0, 72), 14, y)
    doc.text((f.calificacion.trim() || '—').slice(0, 20), 160, y)
    y += 5
  }
  return y + 4
}

export async function generarPdfKinderEn(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<Buffer> {
  const captura = await obtenerCaptura(input)
  const { alumno, bimestre, ciclo, modo } = captura
  const gradoEtiqueta =
    KINDER_EN_GRADOS.find((g) => g.valor === alumno.grado_ui)?.etiqueta ??
    `K${alumno.grado_ui}`

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('INSTITUTO WINSTON CHURCHILL', pageW / 2, y, { align: 'center' })
  y += 7
  doc.setFontSize(11)
  doc.text('Report Card · English Preschool', pageW / 2, y, { align: 'center' })
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
  y += 10

  if (modo === 'maternal') {
    y = pdfSeccion(
      doc,
      'MATERNAL',
      captura.maternal.map((i) => ({ nombre: i.nombre, calificacion: i.calificacion })),
      pageW,
      y
    )
  } else {
    y = pdfSeccion(
      doc,
      'SUBJECTS',
      captura.subjects.map((i) => ({ nombre: i.nombre, calificacion: i.calificacion })),
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
      doc.text(`AVERAGE (excl. Music/Mindfulness): ${captura.promedioSugerido}`, 14, y)
      y += 8
    }
    y = pdfSeccion(
      doc,
      'BEHAVIORAL SKILLS',
      captura.behavioral.map((i) => ({ nombre: i.nombre, calificacion: i.calificacion })),
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
  }

  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Generated by servicios_admin / boletas kinder-ingles (InsForge).', 14, y)
  doc.setTextColor(0)

  return Buffer.from(doc.output('arraybuffer'))
}
