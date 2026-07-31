import { createMysqlLegacyConnection } from './mysqlLegacy'
import { letraKinderEnANumero } from './kinderPromedioPonderador'

const TABLA_ES = 'boleta_calificacionpke'
const TABLA_EN = 'boleta_calificacionpkp'
const TABLA_MATERIAS_ES = 'boletas_materiaske'
const BIMESTRES_CAPTURA = [1, 2, 3]
/** En el PDF legacy el bimestre 4 es el promedio final (a veces vacío). */
const BIMESTRE_PROMEDIO_FINAL = 4

export type KinderPromedioAlumno = {
  alumnoId: number
  promedioEs: number | null
  promedioEn: number | null
  /** Promedio combinado ES/EN (o el único disponible). */
  promedio: number | null
  letraEn: string | null
  trimestresEs: number
  trimestresEn: number
}

function parseCalificacionNumerica(raw: string): number | null {
  const s = String(raw ?? '').trim()
  if (!s || s === '----' || s === '-' || s === 'N/A') return null
  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0 || n > 10) return null
  return n
}

function redondear1(n: number): number {
  return Math.round(n * 10) / 10
}

function promedioLista(vals: number[]): number | null {
  if (vals.length === 0) return null
  return redondear1(vals.reduce((a, b) => a + b, 0) / vals.length)
}

async function idsMateriasConductaEs(
  mysql: Awaited<ReturnType<typeof createMysqlLegacyConnection>>
): Promise<Set<string>> {
  const [rows] = await mysql.query(
    `SELECT id_materia FROM ${TABLA_MATERIAS_ES} WHERE UPPER(TRIM(boletas_materia)) = 'CONDUCTA'`
  )
  const set = new Set<string>()
  for (const row of rows as { id_materia: number }[]) {
    set.add(String(row.id_materia))
  }
  // Fallback histórico por si el catálogo no está alineado.
  for (const id of [11, 34, 55]) set.add(String(id))
  return set
}

/**
 * Promedios Kinder desde MySQL (`winston_general`).
 * - ES (`boleta_calificacionpke`): media de materias (sin conducta). Prefiere bimestre 4;
 *   si está vacío, media de trimestres 1–3 disponibles por materia.
 * - EN (`boleta_calificacionpkp`): materia AVERAGE con letras → ponderador.
 * El ciclo escolar se aplica vía becas/InsForge; aquí se consultan calificaciones por `alumno_id`.
 */
export async function cargarPromediosKinderMysql(
  alumnoIds: number[]
): Promise<Map<number, KinderPromedioAlumno>> {
  const mapa = new Map<number, KinderPromedioAlumno>()
  if (alumnoIds.length === 0) return mapa

  const unicos = [...new Set(alumnoIds.filter((id) => Number.isInteger(id) && id > 0))]
  for (const id of unicos) {
    mapa.set(id, {
      alumnoId: id,
      promedioEs: null,
      promedioEn: null,
      promedio: null,
      letraEn: null,
      trimestresEs: 0,
      trimestresEn: 0,
    })
  }

  const mysql = await createMysqlLegacyConnection()
  try {
    const conducta = await idsMateriasConductaEs(mysql)
    const placeholders = unicos.map(() => '?').join(',')

    type FilaCal = {
      fk_alumno: string | number
      fk_bimestre: number
      fk_materia: string | number
      calificacion: string
    }

    const [rowsEs] = await mysql.query(
      `SELECT fk_alumno, fk_bimestre, fk_materia, calificacion
       FROM ${TABLA_ES}
       WHERE fk_alumno IN (${placeholders})
         AND fk_bimestre IN (1, 2, 3, 4)`,
      unicos
    )

    // alumnoId -> materia -> bimestre -> nota
    const esPorAlumno = new Map<number, Map<string, Map<number, number>>>()
    for (const row of rowsEs as FilaCal[]) {
      const alumnoId = Number(row.fk_alumno)
      const materia = String(row.fk_materia)
      if (conducta.has(materia)) continue
      const nota = parseCalificacionNumerica(row.calificacion)
      if (nota == null) continue
      if (!esPorAlumno.has(alumnoId)) esPorAlumno.set(alumnoId, new Map())
      const porMat = esPorAlumno.get(alumnoId)!
      if (!porMat.has(materia)) porMat.set(materia, new Map())
      porMat.get(materia)!.set(Number(row.fk_bimestre), nota)
    }

    for (const [alumnoId, porMat] of esPorAlumno) {
      const entry = mapa.get(alumnoId)
      if (!entry) continue
      const promMaterias: number[] = []
      const trimestresUsados = new Set<number>()

      for (const porBim of porMat.values()) {
        const final = porBim.get(BIMESTRE_PROMEDIO_FINAL)
        if (final != null) {
          promMaterias.push(final)
          trimestresUsados.add(BIMESTRE_PROMEDIO_FINAL)
          continue
        }
        const trim: number[] = []
        for (const b of BIMESTRES_CAPTURA) {
          const n = porBim.get(b)
          if (n != null) {
            trim.push(n)
            trimestresUsados.add(b)
          }
        }
        const p = promedioLista(trim)
        if (p != null) promMaterias.push(p)
      }

      entry.promedioEs = promedioLista(promMaterias)
      entry.trimestresEs = trimestresUsados.size
    }

    const [rowsEn] = await mysql.query(
      `SELECT fk_alumno, fk_bimestre, fk_materia, calificacion
       FROM ${TABLA_EN}
       WHERE fk_alumno IN (${placeholders})
         AND fk_bimestre IN (1, 2, 3)
         AND CAST(fk_materia AS UNSIGNED) = 1`,
      unicos
    )

    const enPorAlumno = new Map<number, { notas: number[]; letraUltima: string | null }>()
    for (const row of rowsEn as FilaCal[]) {
      const alumnoId = Number(row.fk_alumno)
      const letra = String(row.calificacion ?? '').trim()
      const nota = letraKinderEnANumero(letra)
      if (nota == null) continue
      if (!enPorAlumno.has(alumnoId)) enPorAlumno.set(alumnoId, { notas: [], letraUltima: null })
      const bucket = enPorAlumno.get(alumnoId)!
      bucket.notas.push(nota)
      bucket.letraUltima = letra.toUpperCase()
    }

    for (const [alumnoId, bucket] of enPorAlumno) {
      const entry = mapa.get(alumnoId)
      if (!entry) continue
      entry.promedioEn = promedioLista(bucket.notas)
      entry.letraEn = bucket.letraUltima
      entry.trimestresEn = bucket.notas.length
    }

    for (const entry of mapa.values()) {
      const partes: number[] = []
      if (entry.promedioEs != null) partes.push(entry.promedioEs)
      if (entry.promedioEn != null) partes.push(entry.promedioEn)
      entry.promedio = promedioLista(partes)
    }
  } finally {
    await mysql.end()
  }

  return mapa
}
