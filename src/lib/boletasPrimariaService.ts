import { createBoletasDb } from './boletasInsforge'
import { entregaVacia, listarEntregas, type BoletaEntrega } from './boletasEntrega'
import { listarPublicaciones, type BoletaPublicacion } from './boletasPortal'
import { docentesPorGrupoKinder } from './boletasKinderDocentesGrupo'
import {
  BOLETAS_NIVEL_PRIMARIA,
  PRIMARIA_CALIF_HINT,
  PRIMARIA_CALIF_MIN,
  PRIMARIA_DIAS_MAX,
  PRIMARIA_ESCALA,
  PRIMARIA_SECCIONES,
  capturadasPorAlumnoPrimaria,
  cargarAlumnoPrimaria,
  etiquetaGrupoPrimaria,
  esGradoPrimaria,
  guardarCalifsPrimaria,
  gruposConAlumnosPrimaria,
  listarAlumnosPrimaria,
  mapaCalifsPrimaria,
  materiasActivasPrimaria,
  normalizarDiasPrimaria,
  validarPeriodoPrimaria,
  type IdiomaPrimaria,
  type PrimariaAlumno,
  type PrimariaGrado,
  type PrimariaMateria,
} from './boletasPrimariaComun'

export const MODULO_PRIMARIA = { es: 'primaria-es', en: 'primaria-en' } as const

const TABLA_ASISTENCIA = 'boleta_attendance_primaria_en'

export type PrimariaAsistencia = { school_days: string; days_absent: string }

export type PrimariaCaptura = {
  idioma: IdiomaPrimaria
  alumno: PrimariaAlumno
  bimestre: number
  ciclo: number
  materias: (PrimariaMateria & { calificacion: string })[]
  /** Solo inglés: días de clase y faltas del trimestre. */
  asistencia: PrimariaAsistencia | null
}

export type PrimariaProgreso = { capturadas: number; total: number }

function asGrado(n: number): PrimariaGrado {
  if (esGradoPrimaria(n)) return n
  throw new Error('Grado inválido (1° a 6°)')
}

/** Asistencia de un alumno por trimestre (inglés). */
export async function asistenciaPrimariaEn(
  alumnoId: number,
  ciclo: number,
  bimestres: number[]
): Promise<Map<number, PrimariaAsistencia>> {
  if (!bimestres.length) return new Map()
  const { data, error } = await createBoletasDb()
    .from(TABLA_ASISTENCIA)
    .select('bimestre, school_days, days_absent')
    .eq('alumno_id', alumnoId)
    .eq('ciclo', ciclo)
    .in('bimestre', bimestres)
  if (error) throw new Error(error.message)
  return new Map(
    (data ?? []).map((r) => [
      Number(r.bimestre),
      { school_days: String(r.school_days ?? ''), days_absent: String(r.days_absent ?? '') },
    ])
  )
}

export async function obtenerCapturaPrimaria(
  idioma: IdiomaPrimaria,
  input: { alumnoId: number; bimestre: number; ciclo: number }
): Promise<PrimariaCaptura> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  validarPeriodoPrimaria(bimestre, ciclo)
  const alumno = await cargarAlumnoPrimaria(alumnoId)
  const materias = await materiasActivasPrimaria(idioma, alumno.grado_ui)
  const [mapa, asistencia] = await Promise.all([
    mapaCalifsPrimaria(idioma, alumnoId, ciclo, [bimestre], materias.map((m) => m.id)),
    idioma === 'en' ? asistenciaPrimariaEn(alumnoId, ciclo, [bimestre]) : Promise.resolve(null),
  ])
  return {
    idioma,
    alumno,
    bimestre,
    ciclo,
    materias: materias.map((m) => ({ ...m, calificacion: mapa.get(`${bimestre}-${m.id}`) ?? '' })),
    asistencia: asistencia ? (asistencia.get(bimestre) ?? { school_days: '', days_absent: '' }) : null,
  }
}

/** Forma que usa la pantalla de captura compartida (modo por secciones). */
export function capturaParaUiPrimaria(c: PrimariaCaptura) {
  return {
    alumno: c.alumno,
    modo: 'secciones' as const,
    califMin: PRIMARIA_CALIF_MIN,
    hint: PRIMARIA_CALIF_HINT,
    secciones: PRIMARIA_SECCIONES[c.idioma]
      .map((s) => ({
        id: s.id,
        titulo: s.titulo,
        promedio: s.promedio,
        escala: s.formato === 'escala' ? PRIMARIA_ESCALA[c.idioma] : undefined,
        filas: c.materias
          .filter((m) => m.seccion === s.id)
          .map((m) => ({
            id: m.id,
            nombre: m.nombre,
            detalle: m.nombreAlt || undefined,
            formato: s.formato === 'escala' ? ('escala' as const) : ('decimal' as const),
            enPromedio: m.enPromedio,
            calificacion: m.calificacion,
          })),
      }))
      .filter((s) => s.filas.length > 0),
    asistencia: c.asistencia != null,
    subjects: [],
    behavioral: [],
    maternal: [],
    attendance: c.asistencia ?? { school_days: '', days_absent: '' },
  }
}

export async function guardarCapturaPrimaria(
  idioma: IdiomaPrimaria,
  input: {
    alumnoId: number
    bimestre: number
    ciclo: number
    valores: Record<number, string>
    attendance?: Partial<PrimariaAsistencia> | null
  }
): Promise<{ saved: number }> {
  const alumnoId = Number(input.alumnoId)
  const bimestre = Number(input.bimestre)
  const ciclo = Number(input.ciclo)
  if (!alumnoId) throw new Error('alumnoId requerido')
  validarPeriodoPrimaria(bimestre, ciclo)

  let asistencia: PrimariaAsistencia | null = null
  if (idioma === 'en' && input.attendance) {
    const school = normalizarDiasPrimaria(input.attendance.school_days)
    const absent = normalizarDiasPrimaria(input.attendance.days_absent)
    if (school == null) throw new Error(`«School days»: escribe un número de 0 a ${PRIMARIA_DIAS_MAX}.`)
    if (absent == null) throw new Error(`«Days absent»: escribe un número de 0 a ${PRIMARIA_DIAS_MAX}.`)
    if (school && absent && Number(absent) > Number(school)) {
      throw new Error('«Days absent» no puede ser mayor que «School days».')
    }
    asistencia = { school_days: school, days_absent: absent }
  }

  const alumno = await cargarAlumnoPrimaria(alumnoId)
  const materias = await materiasActivasPrimaria(idioma, alumno.grado_ui)
  let saved = await guardarCalifsPrimaria({ idioma, alumnoId, bimestre, ciclo, materias, valores: input.valores })

  if (asistencia) {
    const { error } = await createBoletasDb()
      .from(TABLA_ASISTENCIA)
      .upsert([{ alumno_id: alumnoId, bimestre, ciclo, ...asistencia, updated_at: new Date().toISOString() }], {
        onConflict: 'alumno_id,bimestre,ciclo',
      })
    if (error) throw new Error(error.message)
    saved += 1
  }
  return { saved }
}

/** Campos capturados por alumno de un mismo grado (materias activas + asistencia en inglés; N/A cuenta). */
export async function progresoAlumnosPrimaria(
  idioma: IdiomaPrimaria,
  alumnoIds: number[],
  grado: number,
  bimestre: number,
  ciclo: number
): Promise<Map<number, PrimariaProgreso>> {
  const materias = await materiasActivasPrimaria(idioma, asGrado(grado))
  const capturadas = await capturadasPorAlumnoPrimaria(idioma, alumnoIds, materias, bimestre, ciclo)
  let total = materias.length
  if (idioma === 'en') {
    total += 2
    if (alumnoIds.length) {
      const { data, error } = await createBoletasDb()
        .from(TABLA_ASISTENCIA)
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

/** Alumnos del grupo con su avance del trimestre (lista de la pantalla de captura). */
export async function alumnosConProgresoPrimaria(
  idioma: IdiomaPrimaria,
  input: { grado: number; grupo: string; trimestre: number; ciclo: number }
) {
  const lista = await listarAlumnosPrimaria({ grado: input.grado, grupoLetra: input.grupo, ciclo: input.ciclo })
  const progreso = await progresoAlumnosPrimaria(
    idioma,
    lista.map((a) => a.alumno_id),
    input.grado,
    input.trimestre,
    input.ciclo
  )
  return lista.map((a) => ({ ...a, progreso: progreso.get(a.alumno_id) ?? null }))
}

export type GrupoTableroPrimaria = {
  grado: PrimariaGrado
  grupo: string
  etiqueta: string
  alumnos: number
  completos: number
  teacher: string | null
  entrega: BoletaEntrega
  publicable: boolean
  publicacion: BoletaPublicacion | null
}

/** Estado de cada grupo en un trimestre: avance, entrega de la docente y publicación a papás. */
export async function tableroPrimaria(
  idioma: IdiomaPrimaria,
  ciclo: number,
  trimestre: number
): Promise<GrupoTableroPrimaria[]> {
  const modulo = MODULO_PRIMARIA[idioma]
  const [grupos, entregas, publicaciones, docentes] = await Promise.all([
    gruposConAlumnosPrimaria(ciclo),
    listarEntregas({ ciclo, modulo, trimestre }),
    listarPublicaciones(ciclo, [modulo]),
    docentesPorGrupoKinder(idioma, [BOLETAS_NIVEL_PRIMARIA]),
  ])
  return Promise.all(
    grupos.map(async (g) => {
      const alumnos = await alumnosConProgresoPrimaria(idioma, { grado: g.grado, grupo: g.grupo, trimestre, ciclo })
      const completos = alumnos.filter((a) => a.progreso && a.progreso.total > 0 && a.progreso.capturadas >= a.progreso.total).length
      return {
        grado: g.grado,
        grupo: g.grupo,
        etiqueta: etiquetaGrupoPrimaria(g.grado, g.grupo),
        alumnos: alumnos.length,
        completos,
        teacher: docentes.get(`${g.grado}-${g.grupo}`)?.nombre ?? null,
        entrega:
          entregas.find((e) => e.grado === g.grado && e.grupo === g.grupo) ??
          entregaVacia({ ciclo, modulo, trimestre, grado: g.grado, grupo: g.grupo }),
        publicable: true,
        publicacion:
          publicaciones.find(
            (p) =>
              p.trimestre === trimestre &&
              ((p.grado === g.grado && p.grupo === g.grupo) || (p.grado === 0 && p.grupo === ''))
          ) ?? null,
      }
    })
  )
}
