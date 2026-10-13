import { jsPDF } from 'jspdf'
import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_KINDER,
  BOLETAS_NIVEL_MATERNAL,
  KINDER_EN_DIAS_MAX,
  calificacionLetraANumero,
  esGradoKinderEn,
  esMaternal,
  etiquetaGradoKinderEn,
  grupoNumeroDesdeLetra,
  letraDesdeGrupoNumero,
  normalizarCalificacionEscala,
  normalizarDias,
  promedioNumeroALetra,
  type KinderEnGrado,
  type KinderEnIndicador,
  type KinderEnTipo,
} from './boletasKinderEnCatalog'
import { indicadoresActivosKinderEn, tablaCalificacionesKinderEn } from './boletasKinderEnIndicadores'
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

export type KinderEnProgreso = { capturadas: number; total: number }

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
  if (esGradoKinderEn(n)) return n
  throw new Error('Grado inválido (use 0 Maternal / 1–3 K1–K3)')
}

function validarPeriodo(bimestre: number, ciclo: number) {
  if (!(bimestre >= 1 && bimestre <= 3)) throw new Error('Trimestre inválido (1–3)')
  if (!ciclo) throw new Error('Ciclo requerido')
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

/** Grupos con alumnos en el ciclo (Maternal A/B y K1–K3 por grupo), con su número de alumnos. */
export async function gruposConAlumnos(
  ciclo: number
): Promise<{ grado: KinderEnGrado; grupo: string; alumnos: number }[]> {
  const { data, error } = await createBoletasDb()
    .from('alumno')
    .select('alumno_nivel, alumno_grado, alumno_grupo')
    .eq('alumno_ciclo_escolar', ciclo)
    .in('alumno_status', [...STATUS_ACTIVOS])
    .in('alumno_nivel', [BOLETAS_NIVEL_MATERNAL, BOLETAS_NIVEL_KINDER])
    .limit(2000)
  if (error) throw new Error(error.message)
  const conteo = new Map<string, { grado: KinderEnGrado; grupo: string; alumnos: number }>()
  for (const a of data ?? []) {
    const nivel = Number(a.alumno_nivel)
    const g = Number(a.alumno_grado)
    let grado: KinderEnGrado
    let grupo: string
    if (nivel === BOLETAS_NIVEL_MATERNAL) {
      if (g !== 1 && g !== 2) continue
      grado = 0
      grupo = letraDesdeGrupoNumero(g)
    } else {
      if (!esGradoKinderEn(g) || g === 0) continue
      const gp = Number(a.alumno_grupo)
      if (!(gp >= 1 && gp <= 4)) continue
      grado = g
      grupo = letraDesdeGrupoNumero(gp)
    }
    const k = `${grado}-${grupo}`
    const prev = conteo.get(k)
    if (prev) prev.alumnos++
    else conteo.set(k, { grado, grupo, alumnos: 1 })
  }
  return [...conteo.values()].sort((a, b) => a.grado - b.grado || a.grupo.localeCompare(b.grupo))
}

export async function cargarAlumno(alumnoId: number): Promise<KinderEnAlumnoLista> {
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
    if (!s.enPromedio) continue
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

function conCalificacion(
  indicadores: KinderEnIndicador[],
  mapa: Map<number, string>
): KinderEnCapturaIndicador[] {
  return indicadores.map((ind) => ({ ...ind, calificacion: mapa.get(ind.id) ?? '' }))
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
  validarPeriodo(bimestre, ciclo)

  const alumno = await cargarAlumno(alumnoId)
  const grado = alumno.grado_ui

  if (esMaternal(grado)) {
    const indicadores = await indicadoresActivosKinderEn('maternal', 0)
    const mapa = await mapaCalifs(
      tablaCalificacionesKinderEn('maternal'),
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
      maternal: conCalificacion(indicadores, mapa),
      promedioSugerido: '',
    }
  }

  const [subjectsCat, behCat] = await Promise.all([
    indicadoresActivosKinderEn('subject', grado),
    indicadoresActivosKinderEn('behavioral', grado),
  ])
  const db = createBoletasDb()
  const [mapaSub, mapaBeh, attRes] = await Promise.all([
    mapaCalifs(tablaCalificacionesKinderEn('subject'), alumnoId, bimestre, ciclo, subjectsCat.map((i) => i.id)),
    mapaCalifs(tablaCalificacionesKinderEn('behavioral'), alumnoId, bimestre, ciclo, behCat.map((i) => i.id)),
    db
      .from('boleta_attendance_kinder_en')
      .select('school_days, days_absent')
      .eq('alumno_id', alumnoId)
      .eq('bimestre', bimestre)
      .eq('ciclo', ciclo)
      .limit(1),
  ])
  if (attRes.error) throw new Error(attRes.error.message)
  const att = attRes.data?.[0]

  const subjects = conCalificacion(subjectsCat, mapaSub)

  return {
    alumno,
    bimestre,
    ciclo,
    modo: 'kinder',
    subjects,
    behavioral: conCalificacion(behCat, mapaBeh),
    attendance: {
      school_days: String(att?.school_days ?? ''),
      days_absent: String(att?.days_absent ?? ''),
    },
    maternal: [],
    promedioSugerido: calcularPromedioSugerido(subjects),
  }
}

/** Valida contra el catálogo: escala E/VG/G/R/S/NI o días (0..120). Lanza con el nombre del campo. */
function valorValidado(ind: KinderEnIndicador, raw: unknown): string {
  if (ind.formato === 'numero') {
    const v = normalizarDias(raw)
    if (v == null) throw new Error(`«${ind.nombre}»: escribe un número de 0 a ${KINDER_EN_DIAS_MAX}.`)
    return v
  }
  const v = normalizarCalificacionEscala(raw)
  if (v == null) throw new Error(`«${ind.nombre}»: usa solo E, VG, G, R, S o NI.`)
  return v
}

async function upsertIndicadores(
  tipo: KinderEnTipo,
  alumnoId: number,
  bimestre: number,
  ciclo: number,
  catalogo: KinderEnIndicador[],
  valores: Record<number, string> | undefined
): Promise<number> {
  const porId = new Map(catalogo.map((i) => [i.id, i]))
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
    const ind = porId.get(Number(rawId))
    if (!ind) continue
    filas.push({
      alumno_id: alumnoId,
      indicador_id: ind.id,
      bimestre,
      ciclo,
      calificacion: valorValidado(ind, rawVal),
      updated_at: ahora,
    })
  }
  if (!filas.length) return 0

  const { error } = await createBoletasDb().from(tablaCalificacionesKinderEn(tipo)).upsert(filas, {
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
  validarPeriodo(bimestre, ciclo)

  const alumno = await cargarAlumno(alumnoId)
  const grado = alumno.grado_ui

  if (esMaternal(grado)) {
    const cat = await indicadoresActivosKinderEn('maternal', 0)
    return { saved: await upsertIndicadores('maternal', alumnoId, bimestre, ciclo, cat, input.maternal) }
  }

  let attendance: KinderEnAttendance | null = null
  if (input.attendance) {
    const school = normalizarDias(input.attendance.school_days)
    const absent = normalizarDias(input.attendance.days_absent)
    if (school == null) throw new Error(`«School days»: escribe un número de 0 a ${KINDER_EN_DIAS_MAX}.`)
    if (absent == null) throw new Error(`«Days absent»: escribe un número de 0 a ${KINDER_EN_DIAS_MAX}.`)
    if (school && absent && Number(absent) > Number(school)) {
      throw new Error('«Days absent» no puede ser mayor que «School days».')
    }
    attendance = { school_days: school, days_absent: absent }
  }

  const [subjectsCat, behCat] = await Promise.all([
    indicadoresActivosKinderEn('subject', grado),
    indicadoresActivosKinderEn('behavioral', grado),
  ])
  // Valida todo antes de escribir para no dejar la boleta a medias.
  for (const [cat, vals] of [
    [subjectsCat, input.subjects],
    [behCat, input.behavioral],
  ] as const) {
    const porId = new Map(cat.map((i) => [i.id, i]))
    for (const [id, v] of Object.entries(vals ?? {})) {
      const ind = porId.get(Number(id))
      if (ind) valorValidado(ind, v)
    }
  }

  let saved = 0
  saved += await upsertIndicadores('subject', alumnoId, bimestre, ciclo, subjectsCat, input.subjects)
  saved += await upsertIndicadores('behavioral', alumnoId, bimestre, ciclo, behCat, input.behavioral)

  if (attendance) {
    const { error } = await createBoletasDb().from('boleta_attendance_kinder_en').upsert(
      [
        {
          alumno_id: alumnoId,
          bimestre,
          ciclo,
          ...attendance,
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

async function contarCapturadas(
  table: string,
  alumnoIds: number[],
  ids: Set<number>,
  bimestre: number,
  ciclo: number,
  out: Map<number, number>
) {
  if (!alumnoIds.length || !ids.size) return
  const { data, error } = await createBoletasDb()
    .from(table)
    .select('alumno_id, indicador_id, calificacion')
    .in('alumno_id', alumnoIds)
    .eq('bimestre', bimestre)
    .eq('ciclo', ciclo)
    .neq('calificacion', '')
    .limit(5000)
  if (error) throw new Error(error.message)
  for (const r of data ?? []) {
    if (!ids.has(Number(r.indicador_id))) continue
    const id = Number(r.alumno_id)
    out.set(id, (out.get(id) ?? 0) + 1)
  }
}

/** Cuántos campos lleva cada alumno de un mismo grado (indicadores activos + asistencia en kinder). */
export async function progresoAlumnos(
  alumnoIds: number[],
  grado: KinderEnGrado,
  bimestre: number,
  ciclo: number
): Promise<Map<number, KinderEnProgreso>> {
  const capturadas = new Map<number, number>()
  let total: number
  if (esMaternal(grado)) {
    const cat = await indicadoresActivosKinderEn('maternal', 0)
    total = cat.length
    await contarCapturadas(
      tablaCalificacionesKinderEn('maternal'),
      alumnoIds,
      new Set(cat.map((i) => i.id)),
      bimestre,
      ciclo,
      capturadas
    )
  } else {
    const [sub, beh] = await Promise.all([
      indicadoresActivosKinderEn('subject', grado),
      indicadoresActivosKinderEn('behavioral', grado),
    ])
    total = sub.length + beh.length + 2
    await Promise.all([
      contarCapturadas(tablaCalificacionesKinderEn('subject'), alumnoIds, new Set(sub.map((i) => i.id)), bimestre, ciclo, capturadas),
      contarCapturadas(tablaCalificacionesKinderEn('behavioral'), alumnoIds, new Set(beh.map((i) => i.id)), bimestre, ciclo, capturadas),
    ])
    if (alumnoIds.length) {
      const { data, error } = await createBoletasDb()
        .from('boleta_attendance_kinder_en')
        .select('alumno_id, school_days, days_absent')
        .in('alumno_id', alumnoIds)
        .eq('bimestre', bimestre)
        .eq('ciclo', ciclo)
      if (error) throw new Error(error.message)
      for (const r of data ?? []) {
        const id = Number(r.alumno_id)
        const n = (String(r.school_days ?? '').trim() ? 1 : 0) + (String(r.days_absent ?? '').trim() ? 1 : 0)
        if (n) capturadas.set(id, (capturadas.get(id) ?? 0) + n)
      }
    }
  }
  return new Map(alumnoIds.map((id) => [id, { capturadas: Math.min(capturadas.get(id) ?? 0, total), total }]))
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
  const gradoEtiqueta = etiquetaGradoKinderEn(alumno.grado_ui)

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
      doc.text(`AVERAGE: ${captura.promedioSugerido}`, 14, y)
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
