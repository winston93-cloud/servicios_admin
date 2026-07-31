import { createMysqlLegacyConnection } from './mysqlLegacy'
import { letraKinderEnANumero } from './kinderPromedioPonderador'

const TABLA_ES = 'boleta_calificacionpke'
const TABLA_EN = 'boleta_calificacionpkp'
/** Trimestres de la boleta ES (1º, 2º, 3º). */
const TRIMESTRES_ES = [1, 2, 3]

export type KinderPromedioAlumno = {
  alumnoId: number
  promedioEs: number | null
  promedioEn: number | null
  /** Promedio combinado ES/EN (o el único disponible). */
  promedio: number | null
  letraEn: string | null
  trimestresEs: number
  trimestresEn: number
  materiasEs: number
}

function parseCalificacionNumerica(raw: string): number | null {
  const s = String(raw ?? '')
    .trim()
    .replace(/,/g, '.')
  if (!s || /^-+$/.test(s) || s === 'N/A' || s === '----') return null
  const n = Number(s)
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

/**
 * Promedio ES por alumno (boleta Kinder español):
 * 1) Por materia: (T1 + T2 + T3) / trimestres con nota (ignora `--`).
 * 2) Promedio general: suma de esos promedios / número de materias.
 * Incluye todas las filas de la boleta (Conducta, Tecnología, etc.).
 *
 * EN: materia AVERAGE con letras → ponderador ENGLISH PRESCHOOL.
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
      materiasEs: 0,
    })
  }

  const mysql = await createMysqlLegacyConnection()
  try {
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
         AND fk_bimestre IN (1, 2, 3)`,
      unicos
    )

    // alumnoId -> materia -> bimestre -> nota
    const esPorAlumno = new Map<number, Map<string, Map<number, number>>>()
    for (const row of rowsEs as FilaCal[]) {
      const alumnoId = Number(row.fk_alumno)
      const materia = String(row.fk_materia)
      const bim = Number(row.fk_bimestre)
      if (!TRIMESTRES_ES.includes(bim)) continue
      const nota = parseCalificacionNumerica(row.calificacion)
      if (nota == null) continue
      if (!esPorAlumno.has(alumnoId)) esPorAlumno.set(alumnoId, new Map())
      const porMat = esPorAlumno.get(alumnoId)!
      if (!porMat.has(materia)) porMat.set(materia, new Map())
      porMat.get(materia)!.set(bim, nota)
    }

    for (const [alumnoId, porMat] of esPorAlumno) {
      const entry = mapa.get(alumnoId)
      if (!entry) continue
      const promMaterias: number[] = []
      const trimestresUsados = new Set<number>()

      for (const porBim of porMat.values()) {
        const trim: number[] = []
        for (const b of TRIMESTRES_ES) {
          const n = porBim.get(b)
          if (n != null) {
            trim.push(n)
            trimestresUsados.add(b)
          }
        }
        // (suma T1+T2+T3) / n_trimestres_con_nota
        const p = promedioLista(trim)
        if (p != null) promMaterias.push(p)
      }

      // suma promedios materia / total materias
      entry.promedioEs = promedioLista(promMaterias)
      entry.trimestresEs = trimestresUsados.size
      entry.materiasEs = promMaterias.length
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
