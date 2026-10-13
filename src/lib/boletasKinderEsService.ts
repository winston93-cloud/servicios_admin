import { jsPDF } from 'jspdf'
import { createBoletasDb } from './boletasInsforge'
import {
  BOLETAS_NIVEL_KINDER,
  KINDER_ES_NO_APLICA,
  esGradoKinderEs,
  etiquetaGradoKinderEs,
  grupoNumeroDesdeLetra,
  letraDesdeGrupoNumero,
  normalizarCalificacionKinderEs,
  type KinderEsGrado,
  type KinderEsIndicador,
} from './boletasKinderEsCatalog'
import { indicadoresActivosKinderEs, TABLA_CALIFICACIONES_KINDER_ES } from './boletasKinderEsIndicadores'
import { docentesPorGrupoKinder } from './boletasKinderDocentesGrupo'
import { etiquetaCicloBoletas } from './boletasCiclo'

const STATUS_ACTIVOS = [1, 4, 5] as const

export type KinderEsAlumnoLista = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  alumno_grado: number
  alumno_grupo: number
  grupo_letra: string
  grado_ui: KinderEsGrado
}

export type KinderEsCapturaIndicador = KinderEsIndicador & {
  calificacion: string
}

export type KinderEsCaptura = {
  alumno: KinderEsAlumnoLista
  bimestre: number
  ciclo: number
  indicadores: KinderEsCapturaIndicador[]
}

export type KinderEsProgreso = { capturadas: number; total: number }

const COLS_ALUMNO =
  'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nivel, alumno_status'

function nombreAlumno(a: { alumno_app?: unknown; alumno_apm?: unknown; alumno_nombre?: unknown }): string {
  return [a.alumno_app, a.alumno_apm, a.alumno_nombre]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

function asGrado(n: number): KinderEsGrado {
  if (esGradoKinderEs(n)) return n
  throw new Error('Grado inválido (use 1–3 / K1–K3)')
}

function validarPeriodo(bimestre: number, ciclo: number) {
  if (!(bimestre >= 1 && bimestre <= 3)) throw new Error('Trimestre inválido (1–3)')
  if (!ciclo) throw new Error('Ciclo requerido')
}

function mapAlumno(a: Record<string, unknown>): KinderEsAlumnoLista {
  const g = Number(a.alumno_grupo)
  const grado = Number(a.alumno_grado)
  return {
    alumno_id: Number(a.alumno_id),
    alumno_ref: a.alumno_ref != null ? Number(a.alumno_ref) : null,
    nombre: nombreAlumno(a),
    alumno_grado: grado,
    alumno_grupo: g,
    grupo_letra: letraDesdeGrupoNumero(g),
    grado_ui: asGrado(grado),
  }
}

export async function listarAlumnos(input: {
  grado: number
  grupoLetra: string
  ciclo: number
}): Promise<KinderEsAlumnoLista[]> {
  const grado = asGrado(Number(input.grado))
  const grupoNum = grupoNumeroDesdeLetra(input.grupoLetra)
  if (!grupoNum) throw new Error('Grupo inválido (A–D)')
  const ciclo = Number(input.ciclo)
  if (!ciclo) throw new Error('Ciclo requerido')

  const { data, error } = await createBoletasDb()
    .from('alumno')
    .select(COLS_ALUMNO)
    .eq('alumno_nivel', BOLETAS_NIVEL_KINDER)
    .eq('alumno_grado', grado)
    .eq('alumno_grupo', grupoNum)
    .eq('alumno_ciclo_escolar', ciclo)
    .in('alumno_status', [...STATUS_ACTIVOS])
    .order('alumno_app')
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapAlumno)
}

/** Grupos de K1–K3 con alumnos en el ciclo. */
export async function gruposConAlumnosKinderEs(
  ciclo: number
): Promise<{ grado: KinderEsGrado; grupo: string; alumnos: number }[]> {
  const { data, error } = await createBoletasDb()
    .from('alumno')
    .select('alumno_grado, alumno_grupo')
    .eq('alumno_ciclo_escolar', ciclo)
    .eq('alumno_nivel', BOLETAS_NIVEL_KINDER)
    .in('alumno_status', [...STATUS_ACTIVOS])
    .limit(2000)
  if (error) throw new Error(error.message)
  const conteo = new Map<string, { grado: KinderEsGrado; grupo: string; alumnos: number }>()
  for (const a of data ?? []) {
    const grado = Number(a.alumno_grado)
    const gp = Number(a.alumno_grupo)
    if (!esGradoKinderEs(grado) || !(gp >= 1 && gp <= 4)) continue
    const grupo = letraDesdeGrupoNumero(gp)
    const k = `${grado}-${grupo}`
    const prev = conteo.get(k)
    if (prev) prev.alumnos++
    else conteo.set(k, { grado, grupo, alumnos: 1 })
  }
  return [...conteo.values()].sort((a, b) => a.grado - b.grado || a.grupo.localeCompare(b.grupo))
}

export async function cargarAlumno(alumnoId: number): Promise<KinderEsAlumnoLista> {
  const { data, error } = await createBoletasDb()
    .from('alumno')
    .select(COLS_ALUMNO)
    .eq('alumno_id', alumnoId)
    .limit(1)
  if (error) throw new Error(error.message)
  const a = data?.[0] as Record<string, unknown> | undefined
  if (!a) throw new Error('Alumno no encontrado')
  if (Number(a.alumno_nivel) !== BOLETAS_NIVEL_KINDER) throw new Error('El alumno no es de kinder')
  return mapAlumno(a)
}

async function mapaCalifs(
  alumnoId: number,
  ciclo: number,
  bimestres: number[],
  ids: number[]
): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const { data, error } = await createBoletasDb()
    .from(TABLA_CALIFICACIONES_KINDER_ES)
    .select('indicador_id, bimestre, calificacion')
    .eq('alumno_id', alumnoId)
    .eq('ciclo', ciclo)
    .in('bimestre', bimestres)
    .in('indicador_id', ids)
  if (error) throw new Error(error.message)
  return new Map(
    (data ?? []).map((r) => [`${Number(r.bimestre)}-${Number(r.indicador_id)}`, String(r.calificacion ?? '')])
  )
}

export async function obtenerCaptura(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<KinderEsCaptura> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  validarPeriodo(bimestre, ciclo)

  const alumno = await cargarAlumno(alumnoId)
  const indicadores = await indicadoresActivosKinderEs(alumno.grado_ui)
  const mapa = await mapaCalifs(alumnoId, ciclo, [bimestre], indicadores.map((i) => i.id))
  return {
    alumno,
    bimestre,
    ciclo,
    indicadores: indicadores.map((ind) => ({ ...ind, calificacion: mapa.get(`${bimestre}-${ind.id}`) ?? '' })),
  }
}

/** Forma que usa la pantalla de captura compartida con Kinder Inglés. */
export function capturaParaUi(c: KinderEsCaptura) {
  return {
    alumno: c.alumno,
    modo: 'academico' as const,
    academicos: c.indicadores.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      formato: 'decimal' as const,
      calificacion: i.calificacion,
    })),
    subjects: [],
    behavioral: [],
    maternal: [],
    attendance: { school_days: '', days_absent: '' },
  }
}

export async function guardarCaptura(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
  valores: Record<number, string>
}): Promise<{ saved: number }> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  validarPeriodo(bimestre, ciclo)

  const alumno = await cargarAlumno(alumnoId)
  const porId = new Map((await indicadoresActivosKinderEs(alumno.grado_ui)).map((i) => [i.id, i]))
  const ahora = new Date().toISOString()
  const filas: {
    alumno_id: number
    indicador_id: number
    bimestre: number
    ciclo: number
    calificacion: string
    updated_at: string
  }[] = []

  // Valida todo antes de escribir para no dejar la boleta a medias.
  for (const [rawId, rawVal] of Object.entries(input.valores ?? {})) {
    const ind = porId.get(Number(rawId))
    if (!ind) continue
    const calificacion = normalizarCalificacionKinderEs(rawVal)
    if (calificacion == null) {
      throw new Error(`«${ind.nombre}»: escribe una calificación de 0 a 10 (un decimal, ej. 9.5) o N/A.`)
    }
    filas.push({ alumno_id: alumnoId, indicador_id: ind.id, bimestre, ciclo, calificacion, updated_at: ahora })
  }
  if (!filas.length) return { saved: 0 }

  const { error } = await createBoletasDb().from(TABLA_CALIFICACIONES_KINDER_ES).upsert(filas, {
    onConflict: 'alumno_id,indicador_id,bimestre,ciclo',
  })
  if (error) throw new Error(error.message)
  return { saved: filas.length }
}

/** Cuántos campos activos lleva cada alumno de un mismo grado (N/A cuenta como capturado). */
export async function progresoAlumnos(
  alumnoIds: number[],
  grado: KinderEsGrado,
  bimestre: number,
  ciclo: number
): Promise<Map<number, KinderEsProgreso>> {
  const cat = await indicadoresActivosKinderEs(grado)
  const ids = new Set(cat.map((i) => i.id))
  const capturadas = new Map<number, number>()
  if (alumnoIds.length && ids.size) {
    const { data, error } = await createBoletasDb()
      .from(TABLA_CALIFICACIONES_KINDER_ES)
      .select('alumno_id, indicador_id')
      .in('alumno_id', alumnoIds)
      .eq('bimestre', bimestre)
      .eq('ciclo', ciclo)
      .neq('calificacion', '')
      .limit(5000)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      if (!ids.has(Number(r.indicador_id))) continue
      const id = Number(r.alumno_id)
      capturadas.set(id, (capturadas.get(id) ?? 0) + 1)
    }
  }
  return new Map(
    alumnoIds.map((id) => [id, { capturadas: Math.min(capturadas.get(id) ?? 0, cat.length), total: cat.length }])
  )
}

const ROJO: [number, number, number] = [228, 30, 43]
const AZUL: [number, number, number] = [16, 94, 178]
const VERDE: [number, number, number] = [52, 168, 38]
const GRIS: [number, number, number] = [226, 226, 226]

/**
 * Boleta como la plantilla legacy: campos académicos con columnas 1º/2º/3º.
 * Solo llena los trimestres hasta `bimestre` (lo publicado), los siguientes van vacíos.
 */
export async function generarPdfKinderEs(input: {
  alumnoId: number
  bimestre: number
  ciclo: number
}): Promise<Buffer> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  validarPeriodo(bimestre, ciclo)
  const alumno = await cargarAlumno(alumnoId)
  const bimestres = [1, 2, 3].filter((b) => b <= bimestre)
  const [indicadores, docentes] = await Promise.all([
    indicadoresActivosKinderEs(alumno.grado_ui),
    docentesPorGrupoKinder('es').catch(() => new Map<string, { maestroId: number; nombre: string }>()),
  ])
  const mapa = await mapaCalifs(alumnoId, ciclo, bimestres, indicadores.map((i) => i.id))
  const profesora = docentes.get(`${alumno.grado_ui}-${alumno.grupo_letra}`)?.nombre ?? ''

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const x0 = 16
  const ancho = pageW - x0 * 2
  let y = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...ROJO)
  doc.text('Instituto Educativo Winston', pageW / 2, y, { align: 'center' })
  y += 6
  doc.setFontSize(9)
  doc.setTextColor(40)
  doc.text('ACUERDO No. 15061214     CLAVE 28PJN0671F', pageW / 2, y, { align: 'center' })
  y += 12

  const dato = (etiqueta: string, valor: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...AZUL)
    doc.text(etiqueta, x, yy)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(20)
    doc.text(valor, x + doc.getTextWidth(etiqueta) + 2, yy)
  }
  dato('NOMBRE DEL ALUMNO:', alumno.nombre, x0, y)
  y += 7
  dato('GRADO Y GRUPO:', `${etiquetaGradoKinderEs(alumno.grado_ui)} ${alumno.grupo_letra}`, x0, y)
  dato('PROFESORA:', profesora, x0 + 70, y)
  y += 11

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...VERDE)
  doc.text(
    `BOLETA DE CALIFICACIÓN ${etiquetaGradoKinderEs(alumno.grado_ui)} - CICLO ESCOLAR ${etiquetaCicloBoletas(ciclo)}`,
    pageW / 2,
    y,
    { align: 'center' }
  )
  y += 5

  const colNombre = ancho * 0.48
  const colTri = (ancho - colNombre) / 3
  const filaH = 6.2

  doc.setFillColor(...ROJO)
  doc.rect(x0, y, ancho, 12, 'F')
  doc.setTextColor(255)
  doc.setFontSize(9)
  doc.text('CAMPOS ACADÉMICOS', x0 + colNombre / 2, y + 7.5, { align: 'center' })
  doc.text('TRIMESTRES', x0 + colNombre + (colTri * 3) / 2, y + 4.5, { align: 'center' })
  for (let t = 0; t < 3; t++) {
    doc.text(`${t + 1}º`, x0 + colNombre + colTri * t + colTri / 2, y + 10, { align: 'center' })
  }
  y += 12

  doc.setFontSize(9)
  indicadores.forEach((ind, idx) => {
    if (y > 250) {
      doc.addPage()
      y = 20
    }
    if (idx % 2 === 1) {
      doc.setFillColor(...GRIS)
      doc.rect(x0, y, ancho, filaH, 'F')
    }
    doc.setTextColor(30)
    doc.setFont('helvetica', /^EXAMEN/.test(ind.nombre) ? 'bold' : 'normal')
    doc.text(ind.nombre.slice(0, 48), x0 + 3, y + 4.3)
    doc.setFont('helvetica', 'normal')
    for (const b of bimestres) {
      const v = mapa.get(`${b}-${ind.id}`) ?? ''
      if (!v) continue
      doc.text(v === KINDER_ES_NO_APLICA ? '----' : v, x0 + colNombre + colTri * (b - 1) + colTri / 2, y + 4.3, {
        align: 'center',
      })
    }
    y += filaH
  })
  doc.setDrawColor(...AZUL)
  doc.setLineWidth(0.4)
  const altoTabla = 12 + filaH * indicadores.length
  if (altoTabla < 230) {
    const yTabla = y - altoTabla
    doc.rect(x0, yTabla, ancho, altoTabla)
    for (let t = 0; t < 3; t++) {
      const x = x0 + colNombre + colTri * t
      doc.line(x, yTabla + (t === 0 ? 0 : 6), x, y)
    }
  }

  y += 10
  if (y > 235) {
    doc.addPage()
    y = 20
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(60)
  doc.text('FIRMA DE LA MADRE, PADRE DE FAMILIA O TUTOR', pageW / 2, y, { align: 'center' })
  y += 3
  doc.setFillColor(...ROJO)
  doc.rect(x0, y, ancho, 6, 'F')
  doc.setTextColor(255)
  doc.setFontSize(9)
  for (let t = 0; t < 3; t++) {
    doc.text(`${t + 1}º`, x0 + (ancho / 3) * t + ancho / 6, y + 4.2, { align: 'center' })
  }
  doc.setDrawColor(...AZUL)
  doc.rect(x0, y, ancho, 26)
  doc.line(x0 + ancho / 3, y, x0 + ancho / 3, y + 26)
  doc.line(x0 + (ancho / 3) * 2, y, x0 + (ancho / 3) * 2, y + 26)

  doc.setTextColor(0)
  return Buffer.from(doc.output('arraybuffer'))
}
