import { createMysqlLegacyConnection } from './mysqlLegacy'

const TRIMESTRES = [1, 2, 3] as const
/** Materias académicas EN (mat_id); excluye Mindfulness(10), Faith(11), extras. */
const MAT_IDS_EN_ACADEMICAS = [2, 3, 4, 5, 6, 7, 8, 9]

export type PrimariaAlumnoInput = {
  alumnoId: number
  alumnoRef: string
  grado: number
}

export type PrimariaPromedioAlumno = {
  alumnoId: number
  promedioEs: number | null
  promedioEn: number | null
  promedio: number | null
  bloquesEs: number
  trimestresEn: number
}

function parseNota(raw: string | number | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).trim().replace(/,/g, '.')
  if (!s || /^-+$/.test(s) || s === 'N/A') return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0 || n > 10) return null
  return n
}

function redondear(n: number, dec: number): number {
  const f = 10 ** dec
  return Math.round(n * f) / f
}

function promedioLista(vals: number[], dec: number): number | null {
  if (vals.length === 0) return null
  return redondear(vals.reduce((a, b) => a + b, 0) / vals.length, dec)
}

/** Divisores por bloque según grado (igual que boletaspdf.php). */
function divisoresBloques(grado: number): {
  lenguajes: number
  saberes: number
  humano: number
  etica: number
} {
  const g = Number(grado) || 1
  return {
    lenguajes: 3,
    saberes: g < 3 ? 1 : 2,
    humano: 1,
    etica: g < 3 ? 1 : g === 3 ? 2 : 3,
  }
}

function promedioBloqueTrimestre(
  notas: number[],
  divisor: number,
  dec: number
): number | null {
  if (divisor <= 0) return null
  // Como el PDF: suma todas las filas (ceros placeholder incluidos) / divisor fijo.
  const suma = notas.reduce((a, b) => a + b, 0)
  if (notas.length === 0 && suma === 0) return null
  return redondear(suma / divisor, dec)
}

/**
 * Promedios Primaria desde MySQL (`winston_general`).
 *
 * ES (`prim_*`): promedio de 4 bloques (Lenguajes, Saberes, Humano, Ética);
 * cada bloque = media de sus 3 trimestres. Extra/habilidades fuera.
 *
 * EN (`ing_cal` por alu_ref): AVERAGE FINAL = media de 8 materias académicas
 * (mat_id 2–9), sin Mindfulness/Faith/skills.
 */
export async function cargarPromediosPrimariaMysql(
  alumnos: PrimariaAlumnoInput[]
): Promise<Map<number, PrimariaPromedioAlumno>> {
  const mapa = new Map<number, PrimariaPromedioAlumno>()
  if (alumnos.length === 0) return mapa

  const porId = new Map<number, PrimariaAlumnoInput>()
  const porRef = new Map<number, number>() // ref → alumnoId
  for (const a of alumnos) {
    if (!Number.isInteger(a.alumnoId) || a.alumnoId <= 0) continue
    porId.set(a.alumnoId, a)
    mapa.set(a.alumnoId, {
      alumnoId: a.alumnoId,
      promedioEs: null,
      promedioEn: null,
      promedio: null,
      bloquesEs: 0,
      trimestresEn: 0,
    })
    const ref = Number(String(a.alumnoRef ?? '').trim())
    if (Number.isInteger(ref) && ref > 0) porRef.set(ref, a.alumnoId)
  }

  const ids = [...porId.keys()]
  if (ids.length === 0) return mapa

  const mysql = await createMysqlLegacyConnection()
  try {
    const ph = ids.map(() => '?').join(',')

    type FilaPrim = {
      id_alumno: number
      trimestre: number
      id_materia: number
      calificacion: string | number
    }

    const cargarTabla = async (tabla: string) => {
      const [rows] = await mysql.query(
        `SELECT id_alumno, trimestre, id_materia, calificacion
         FROM ${tabla}
         WHERE id_alumno IN (${ph})
           AND trimestre IN (1, 2, 3)`,
        ids
      )
      return rows as FilaPrim[]
    }

    const [lenguajes, saberes, humano, etica] = await Promise.all([
      cargarTabla('prim_lenguajes'),
      cargarTabla('prim_saberes'),
      cargarTabla('prim_humano'),
      cargarTabla('prim_etica'),
    ])

    type Bucket = Map<number, Map<number, number[]>> // alumno → trim → notas
    const toBucket = (rows: FilaPrim[]): Bucket => {
      const b: Bucket = new Map()
      for (const row of rows) {
        const id = Number(row.id_alumno)
        const trim = Number(row.trimestre)
        if (!TRIMESTRES.includes(trim as 1 | 2 | 3)) continue
        const nota = parseNota(row.calificacion)
        // Incluir 0 (placeholder); excluir null/vacío.
        if (nota == null) continue
        if (!b.has(id)) b.set(id, new Map())
        const porTrim = b.get(id)!
        if (!porTrim.has(trim)) porTrim.set(trim, [])
        porTrim.get(trim)!.push(nota)
      }
      return b
    }

    const buckLen = toBucket(lenguajes)
    const buckSab = toBucket(saberes)
    const buckHum = toBucket(humano)
    const buckEti = toBucket(etica)

    const promedioBloqueAnual = (
      bucket: Bucket,
      alumnoId: number,
      divisor: number
    ): number | null => {
      const porTrim = bucket.get(alumnoId)
      if (!porTrim) return null
      const trimAvgs: number[] = []
      for (const t of TRIMESTRES) {
        const notas = porTrim.get(t) ?? []
        const p = promedioBloqueTrimestre(notas, divisor, 1)
        if (p != null) trimAvgs.push(p)
      }
      return promedioLista(trimAvgs, 1)
    }

    for (const [alumnoId, meta] of porId) {
      const div = divisoresBloques(meta.grado)
      const bloques: number[] = []
      const len = promedioBloqueAnual(buckLen, alumnoId, div.lenguajes)
      const sab = promedioBloqueAnual(buckSab, alumnoId, div.saberes)
      const hum = promedioBloqueAnual(buckHum, alumnoId, div.humano)
      const eti = promedioBloqueAnual(buckEti, alumnoId, div.etica)
      if (len != null) bloques.push(len)
      if (sab != null) bloques.push(sab)
      if (hum != null) bloques.push(hum)
      if (eti != null) bloques.push(eti)
      const entry = mapa.get(alumnoId)!
      entry.promedioEs = promedioLista(bloques, 1)
      entry.bloquesEs = bloques.length
    }

    // ——— Inglés ———
    const refs = [...porRef.keys()]
    if (refs.length > 0) {
      const phRef = refs.map(() => '?').join(',')
      const matPh = MAT_IDS_EN_ACADEMICAS.map(() => '?').join(',')
      const [rowsEn] = await mysql.query(
        `SELECT alu_ref, fk_trim, mat_id, cal_par_1
         FROM ing_cal
         WHERE alu_ref IN (${phRef})
           AND fk_trim IN (1, 2, 3)
           AND mat_id IN (${matPh})`,
        [...refs, ...MAT_IDS_EN_ACADEMICAS]
      )

      // alumnoId → mat_id → trim → nota
      const enPorAlumno = new Map<number, Map<number, Map<number, number>>>()
      for (const row of rowsEn as {
        alu_ref: string | number
        fk_trim: number
        mat_id: number
        cal_par_1: string | number
      }[]) {
        const ref = Number(row.alu_ref)
        const alumnoId = porRef.get(ref)
        if (alumnoId == null) continue
        const trim = Number(row.fk_trim)
        const mat = Number(row.mat_id)
        const nota = parseNota(row.cal_par_1)
        if (nota == null || nota <= 0) continue // 0.00 = vacío en EN
        if (!enPorAlumno.has(alumnoId)) enPorAlumno.set(alumnoId, new Map())
        const porMat = enPorAlumno.get(alumnoId)!
        if (!porMat.has(mat)) porMat.set(mat, new Map())
        porMat.get(mat)!.set(trim, nota)
      }

      for (const [alumnoId, porMat] of enPorAlumno) {
        const finalesMateria: number[] = []
        const trimPeriodo = new Map<number, number[]>()

        for (const porTrim of porMat.values()) {
          const trimNotas: number[] = []
          for (const t of TRIMESTRES) {
            const n = porTrim.get(t)
            if (n != null) {
              trimNotas.push(n)
              if (!trimPeriodo.has(t)) trimPeriodo.set(t, [])
              trimPeriodo.get(t)!.push(n)
            }
          }
          const fin = promedioLista(trimNotas, 2)
          if (fin != null) finalesMateria.push(fin)
        }

        // AVERAGE FINAL = media de finales de materia (equiv. media de averages por periodo).
        const entry = mapa.get(alumnoId)!
        entry.promedioEn = promedioLista(finalesMateria, 2)
        entry.trimestresEn = [...trimPeriodo.keys()].length
      }
    }

    for (const entry of mapa.values()) {
      const partes: number[] = []
      if (entry.promedioEs != null) partes.push(entry.promedioEs)
      if (entry.promedioEn != null) partes.push(entry.promedioEn)
      entry.promedio = promedioLista(partes, 1)
    }
  } finally {
    await mysql.end()
  }

  return mapa
}
