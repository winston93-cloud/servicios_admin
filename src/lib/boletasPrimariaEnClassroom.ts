import type { classroom_v1 } from 'googleapis'
import { createBoletasDb } from './boletasInsforge'
import {
  PRIMARIA_CALIF_MIN,
  TABLA_CALIF_PRIMARIA,
  listarAlumnosPrimaria,
  materiasActivasPrimaria,
  type PrimariaAlumno,
  type PrimariaGrado,
  type PrimariaMateria,
} from './boletasPrimariaComun'
import { medirConSonda } from './panelControl/sonda'
import { clienteClassroom } from './teamEnglish/teClassroom'
import { equipo } from './teamEnglish/teService'

/**
 * Boleta Primaria Inglés ← Google Classroom. Cada teacher tiene una clase por materia, grupo y trimestre
 * («5th A - Grammar - TRIM 1»); el promedio se calcula como Classroom (categorías con porcentaje o puntos
 * totales, solo calificaciones devueltas) y pasa a la boleta de 0–100 a 5–10. Gana el último cambio:
 * si Classroom cambia, reemplaza; un ajuste hecho en el sistema se queda hasta que Classroom vuelva a cambiar.
 */

const TABLA_LIGA = 'boleta_classroom_alumno'
const TABLA_VISTO = 'boleta_classroom_calif_primaria_en'
const TABLA_SYNC = 'boleta_classroom_sync'
const ESPERA_MS = 2 * 60 * 1000

export type ClassroomSinLigar = { googleId: string; nombre: string }

export type ClassroomResumen = {
  sincronizadoEn: string
  teacher: string | null
  clases: { nombre: string; materias: string[] }[]
  ligados: number
  sinLigar: ClassroomSinLigar[]
  calificaciones: number
  cambios: number
  aviso: string | null
}

export type ClassroomCelda = { valor: string; origen: 'classroom' | 'manual' }

type Clave = 'grammar' | 'writing' | 'reading' | 'vocabulary' | 'math' | 'speaking' | 'listening'

const CLASES: { clave: Clave; re: RegExp; materias: RegExp }[] = [
  { clave: 'grammar', re: /GRAMMAR/, materias: /GRAMMAR/ },
  { clave: 'writing', re: /WRITING/, materias: /WRITING/ },
  { clave: 'reading', re: /READING/, materias: /READING/ },
  { clave: 'vocabulary', re: /VOCABULARY|SPELLING|PHONICS/, materias: /VOCABULARY|SPELLING|PHONICS/ },
  { clave: 'math', re: /MATH/, materias: /MATH/ },
  { clave: 'speaking', re: /SPEAKING/, materias: /SPEAKING/ },
  { clave: 'listening', re: /LISTENING/, materias: /LISTENING/ },
]

export function mayus(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

function llano(s: unknown): string {
  return mayus(s).toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Grado, grupo, trimestre y materia a partir del nombre de la clase; null si no es una clase de boleta. */
export function leerNombreClase(nombre: string): { grado: number; grupo: string; trimestre: number; clave: Clave } | null {
  const n = mayus(nombre)
  if (/^\s*COPIA DE\b/.test(n)) return null
  const g = /^\s*([1-6])\s*(?:ST|ND|RD|TH|°|º)?\s*\/?\s*([ABC])(?![A-Z])/.exec(n)
  const t = /TRIM(?:ESTER)?\s*([1-3])(?!\d)/.exec(n) ?? /(?:^|[^0-9])([1-3])\s*(?:ST|ND|RD)\s*TRIM/.exec(n)
  const c = CLASES.find((x) => x.re.test(n))
  if (!g || !t || !c) return null
  return { grado: Number(g[1]), grupo: g[2], trimestre: Number(t[1]), clave: c.clave }
}

/** De 0–100 a la escala de la boleta (5–10, 2 decimales). */
export function aEscalaBoleta(porcentaje: number): string {
  const v = Math.min(10, Math.max(PRIMARIA_CALIF_MIN, porcentaje / 10))
  return v.toFixed(2)
}

type Gradebook = { calculationType?: string; gradeCategories?: { id?: string; weight?: number }[] }
type Tarea = { id: string; max: number; categoria: string | null }

/** Promedio 0–100 como lo calcula Classroom; null si el alumno no tiene calificaciones devueltas. */
export function promedioClassroom(gb: Gradebook | undefined, tareas: Tarea[], notas: Map<string, number>): number | null {
  const calificadas = tareas.filter((t) => t.max > 0 && notas.has(t.id))
  if (!calificadas.length) return null
  if (gb?.calculationType === 'WEIGHTED_CATEGORIES') {
    let suma = 0
    let pesos = 0
    for (const cat of gb.gradeCategories ?? []) {
      const deCat = calificadas.filter((t) => t.categoria === cat.id)
      const posibles = deCat.reduce((s, t) => s + t.max, 0)
      if (!posibles || !cat.weight) continue
      suma += (cat.weight * deCat.reduce((s, t) => s + (notas.get(t.id) ?? 0), 0)) / posibles
      pesos += cat.weight
    }
    return pesos ? (suma / pesos) * 100 : null
  }
  const posibles = calificadas.reduce((s, t) => s + t.max, 0)
  return (calificadas.reduce((s, t) => s + (notas.get(t.id) ?? 0), 0) / posibles) * 100
}

export async function todas<T>(pagina: (token?: string) => Promise<{ items?: T[] | null; next?: string | null }>): Promise<T[]> {
  const out: T[] = []
  let token: string | undefined
  for (let i = 0; i < 50; i++) {
    const r = await pagina(token)
    out.push(...(r.items ?? []))
    if (!r.next) break
    token = r.next
  }
  return out
}

type DatosClase = {
  nombre: string
  clave: Clave
  gb: Gradebook | undefined
  tareas: Tarea[]
  notas: Map<string, Map<string, number>>
  alumnos: { googleId: string; nombre: string }[]
}

async function leerClase(cr: classroom_v1.Classroom, c: classroom_v1.Schema$Course, clave: Clave): Promise<DatosClase> {
  const courseId = c.id!
  const [curso, trabajos, entregas, alumnos] = await Promise.all([
    cr.courses.get({ id: courseId }),
    todas((pageToken) =>
      cr.courses.courseWork.list({ courseId, pageSize: 200, pageToken }).then((r) => ({ items: r.data.courseWork, next: r.data.nextPageToken }))
    ),
    todas((pageToken) =>
      cr.courses.courseWork.studentSubmissions
        .list({ courseId, courseWorkId: '-', pageSize: 500, pageToken })
        .then((r) => ({ items: r.data.studentSubmissions, next: r.data.nextPageToken }))
    ),
    todas((pageToken) =>
      cr.courses.students.list({ courseId, pageSize: 100, pageToken }).then((r) => ({ items: r.data.students, next: r.data.nextPageToken }))
    ),
  ])
  const tareas: Tarea[] = trabajos
    .filter((w) => w.id && (w.maxPoints ?? 0) > 0)
    .map((w) => ({ id: w.id!, max: Number(w.maxPoints), categoria: (w as { gradeCategory?: { id?: string } }).gradeCategory?.id ?? null }))
  const notas = new Map<string, Map<string, number>>()
  for (const s of entregas) {
    if (!s.userId || !s.courseWorkId || s.assignedGrade == null) continue
    const m = notas.get(s.userId) ?? new Map<string, number>()
    m.set(s.courseWorkId, Number(s.assignedGrade))
    notas.set(s.userId, m)
  }
  return {
    nombre: c.name ?? '',
    clave,
    gb: (curso.data as { gradebookSettings?: Gradebook }).gradebookSettings,
    tareas,
    notas,
    alumnos: alumnos.filter((a) => a.userId).map((a) => ({ googleId: a.userId!, nombre: a.profile?.name?.fullName ?? '' })),
  }
}

export type AlumnoConNombre = Pick<PrimariaAlumno, 'alumno_id' | 'nombres' | 'app' | 'apm'>

/** Empareja por nombre dentro del grupo; solo si hay un único candidato. */
export function emparejarPorNombre(nombre: string, alumnos: AlumnoConNombre[], usados: Set<number>): number | null {
  const n = llano(nombre)
  if (!n) return null
  const libres = alumnos.filter((a) => !usados.has(a.alumno_id))
  const unico = (lista: AlumnoConNombre[]) => (lista.length === 1 ? lista[0].alumno_id : null)
  const exacto = libres.filter((a) =>
    [`${a.nombres} ${a.app} ${a.apm}`, `${a.nombres} ${a.app}`, `${a.app} ${a.apm} ${a.nombres}`].some((k) => llano(k) === n)
  )
  if (exacto.length) return unico(exacto)
  const apellidos = libres.filter((a) => a.app && a.apm && n.endsWith(` ${llano(`${a.app} ${a.apm}`)}`))
  if (apellidos.length) return unico(apellidos)
  const primerNombre = libres.filter((a) => {
    const p = llano(a.nombres).split(' ')[0]
    return p && a.app && n.startsWith(`${p} `) && n.includes(` ${llano(a.app)}`)
  })
  return unico(primerNombre)
}

async function teacherDelGrupo(grado: number, grupo: string): Promise<{ nombre: string; email: string } | null> {
  const t = (await equipo(3, false)).find((x) => x.email && x.grupos.includes(`${grado}${grupo}`))
  return t ? { nombre: t.apodo || t.nombre, email: t.email! } : null
}

export function esFalloGoogle(e: unknown): boolean {
  const code = Number((e as { code?: unknown; status?: unknown })?.code ?? (e as { status?: unknown })?.status ?? 0)
  return !code || code >= 500 || code === 401 || code === 403
}

export async function resumenClassroom(input: { ciclo: number; trimestre: number; grado: number; grupo: string }): Promise<ClassroomResumen | null> {
  const { data, error } = await createBoletasDb()
    .from(TABLA_SYNC)
    .select('resumen')
    .eq('ciclo', input.ciclo)
    .eq('bimestre', input.trimestre)
    .eq('grado', input.grado)
    .eq('grupo', input.grupo)
    .limit(1)
  if (error) throw new Error(error.message)
  const r = (data?.[0] as { resumen?: ClassroomResumen } | undefined)?.resumen
  return r && r.sincronizadoEn ? r : null
}

/** Trae las calificaciones del trimestre desde Classroom y las pasa a la boleta (máximo una vez cada 2 min por grupo). */
export async function sincronizarClassroomGrupo(input: {
  ciclo: number
  trimestre: number
  grado: number
  grupo: string
  forzar?: boolean
}): Promise<ClassroomResumen> {
  const { ciclo, trimestre, grado, grupo } = input
  const previo = await resumenClassroom(input)
  if (previo && !input.forzar && Date.now() - new Date(previo.sincronizadoEn).getTime() < ESPERA_MS) return previo

  const db = createBoletasDb()
  const resumen: ClassroomResumen = {
    sincronizadoEn: new Date().toISOString(),
    teacher: null,
    clases: [],
    ligados: 0,
    sinLigar: [],
    calificaciones: 0,
    cambios: 0,
    aviso: null,
  }
  const guardar = async () => {
    const { error } = await db
      .from(TABLA_SYNC)
      .upsert([{ ciclo, bimestre: trimestre, grado, grupo, sincronizado_en: resumen.sincronizadoEn, resumen }], {
        onConflict: 'ciclo,bimestre,grado,grupo',
      })
    if (error) throw new Error(error.message)
    return resumen
  }

  const teacher = await teacherDelGrupo(grado, grupo)
  if (!teacher) {
    resumen.aviso = `En Team English no hay una teacher activa con ${grado}${grupo}.`
    return guardar()
  }
  resumen.teacher = teacher.nombre

  const [alumnos, materias] = await Promise.all([
    listarAlumnosPrimaria({ grado, grupoLetra: grupo, ciclo }),
    materiasActivasPrimaria('en', grado as PrimariaGrado),
  ])

  let clases: DatosClase[]
  try {
    clases = await medirConSonda(
      'google-classroom',
      async () => {
        const cr = clienteClassroom(teacher.email)
        const cursos = await todas((pageToken) =>
          cr.courses
            .list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 100, pageToken })
            .then((r) => ({ items: r.data.courses, next: r.data.nextPageToken }))
        )
        const delGrupo = cursos
          .map((c) => ({ c, d: leerNombreClase(c.name ?? '') }))
          .filter((x) => x.d && x.d.grado === grado && x.d.grupo === grupo && x.d.trimestre === trimestre)
        return Promise.all(delGrupo.map((x) => leerClase(cr, x.c, x.d!.clave)))
      },
      esFalloGoogle
    )
  } catch (e) {
    resumen.aviso = `No se pudo leer Classroom de ${teacher.nombre}: ${e instanceof Error ? e.message.slice(0, 160) : 'error'}`
    return guardar()
  }
  clases = clases.filter((c) => c.alumnos.length > 0)
  if (!clases.length) {
    resumen.aviso = `${teacher.nombre} no tiene clases de ${grado}${grupo} del trimestre ${trimestre} en Classroom.`
    return guardar()
  }

  const subject = materias.filter((m) => m.seccion === 'subject')
  const materiasDe = (clave: Clave): PrimariaMateria[] => {
    const re = CLASES.find((c) => c.clave === clave)!.materias
    return subject.filter((m) => re.test(mayus(m.nombre)))
  }
  resumen.clases = clases.map((c) => ({ nombre: c.nombre, materias: materiasDe(c.clave).map((m) => m.nombre) }))

  // Alumnos de Classroom ↔ sistema: primero lo ya ligado (si sigue en el grupo), luego por nombre.
  const googleIds = [...new Set(clases.flatMap((c) => c.alumnos.map((a) => a.googleId)))]
  const nombreDe = new Map(clases.flatMap((c) => c.alumnos.map((a) => [a.googleId, a.nombre] as const)))
  const { data: ligas, error: errLiga } = await db.from(TABLA_LIGA).select('google_id, alumno_id').in('google_id', googleIds)
  if (errLiga) throw new Error(errLiga.message)
  const delGrupo = new Set(alumnos.map((a) => a.alumno_id))
  const alumnoDe = new Map<string, number>()
  const usados = new Set<number>()
  for (const l of (ligas ?? []) as { google_id: string; alumno_id: number }[]) {
    if (!delGrupo.has(Number(l.alumno_id)) || usados.has(Number(l.alumno_id))) continue
    alumnoDe.set(l.google_id, Number(l.alumno_id))
    usados.add(Number(l.alumno_id))
  }
  const nuevas: { google_id: string; alumno_id: number; manual: boolean; updated_at: string }[] = []
  for (const gid of googleIds) {
    if (alumnoDe.has(gid) || (ligas ?? []).some((l) => l.google_id === gid)) continue
    const id = emparejarPorNombre(nombreDe.get(gid) ?? '', alumnos, usados)
    if (id == null) continue
    alumnoDe.set(gid, id)
    usados.add(id)
    nuevas.push({ google_id: gid, alumno_id: id, manual: false, updated_at: resumen.sincronizadoEn })
  }
  if (nuevas.length) {
    const { error } = await db.from(TABLA_LIGA).upsert(nuevas, { onConflict: 'google_id' })
    if (error) throw new Error(error.message)
  }
  resumen.ligados = alumnoDe.size
  resumen.sinLigar = googleIds
    .filter((g) => !alumnoDe.has(g))
    .map((g) => ({ googleId: g, nombre: nombreDe.get(g) ?? '' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  // Calificación por alumno y materia de la boleta.
  const valores = new Map<string, { alumno_id: number; materia_id: number; valor: string }>()
  for (const c of clases) {
    const destino = materiasDe(c.clave)
    if (!destino.length) continue
    for (const a of c.alumnos) {
      const alumnoId = alumnoDe.get(a.googleId)
      if (alumnoId == null) continue
      const p = promedioClassroom(c.gb, c.tareas, c.notas.get(a.googleId) ?? new Map())
      if (p == null) continue
      const valor = aEscalaBoleta(p)
      for (const m of destino) valores.set(`${alumnoId}-${m.id}`, { alumno_id: alumnoId, materia_id: m.id, valor })
    }
  }
  resumen.calificaciones = valores.size
  if (!valores.size) return guardar()

  const ids = [...new Set([...valores.values()].map((v) => v.alumno_id))]
  const { data: vistos, error: errVisto } = await db
    .from(TABLA_VISTO)
    .select('alumno_id, materia_id, valor_classroom')
    .in('alumno_id', ids)
    .eq('bimestre', trimestre)
    .eq('ciclo', ciclo)
  if (errVisto) throw new Error(errVisto.message)
  const visto = new Map(
    ((vistos ?? []) as { alumno_id: number; materia_id: number; valor_classroom: string }[]).map((r) => [
      `${r.alumno_id}-${r.materia_id}`,
      String(r.valor_classroom),
    ])
  )
  const cambiaron = [...valores.entries()].filter(([k, v]) => visto.get(k) !== v.valor).map(([, v]) => v)
  if (cambiaron.length) {
    const ahora = resumen.sincronizadoEn
    const califs = cambiaron.map((v) => ({
      alumno_id: v.alumno_id,
      materia_id: v.materia_id,
      bimestre: trimestre,
      ciclo,
      calificacion: v.valor,
      updated_at: ahora,
    }))
    const { error: e1 } = await db.from(TABLA_CALIF_PRIMARIA.en).upsert(califs, { onConflict: 'alumno_id,materia_id,bimestre,ciclo' })
    if (e1) throw new Error(e1.message)
    const marcas = cambiaron.map((v) => ({
      alumno_id: v.alumno_id,
      materia_id: v.materia_id,
      bimestre: trimestre,
      ciclo,
      valor_classroom: v.valor,
      origen: 'classroom',
      updated_at: ahora,
    }))
    const { error: e2 } = await db.from(TABLA_VISTO).upsert(marcas, { onConflict: 'alumno_id,materia_id,bimestre,ciclo' })
    if (e2) throw new Error(e2.message)
  }
  resumen.cambios = cambiaron.length
  return guardar()
}

/** Liga a mano un alumno de Classroom con uno del grupo (alumnoId 0 = quitar la liga). */
export async function ligarAlumnoClassroom(googleId: string, alumnoId: number, quien: string): Promise<void> {
  if (!/^[0-9]{1,40}$/.test(googleId)) throw new Error('Alumno de Classroom inválido.')
  const db = createBoletasDb()
  if (!alumnoId) {
    const { error } = await db.from(TABLA_LIGA).delete().eq('google_id', googleId)
    if (error) throw new Error(error.message)
    return
  }
  const { error: e0 } = await db.from(TABLA_LIGA).delete().eq('alumno_id', alumnoId).neq('google_id', googleId)
  if (e0) throw new Error(e0.message)
  const { error } = await db
    .from(TABLA_LIGA)
    .upsert([{ google_id: googleId, alumno_id: alumnoId, manual: true, ligado_por: quien, updated_at: new Date().toISOString() }], {
      onConflict: 'google_id',
    })
  if (error) throw new Error(error.message)
}

/** Lo que dio Classroom por materia para un alumno y si la boleta lo conserva o fue ajustada aquí. */
export async function celdasClassroomAlumno(alumnoId: number, bimestre: number, ciclo: number): Promise<Map<number, ClassroomCelda>> {
  const { data, error } = await createBoletasDb()
    .from(TABLA_VISTO)
    .select('materia_id, valor_classroom, origen')
    .eq('alumno_id', alumnoId)
    .eq('bimestre', bimestre)
    .eq('ciclo', ciclo)
  if (error) throw new Error(error.message)
  return new Map(
    ((data ?? []) as { materia_id: number; valor_classroom: string; origen: string }[]).map((r) => [
      Number(r.materia_id),
      { valor: String(r.valor_classroom), origen: r.origen === 'manual' ? 'manual' : 'classroom' },
    ])
  )
}

/** Tras guardar a mano: marca como ajustadas las materias cuyo valor ya no es el de Classroom. */
export async function marcarAjustesClassroom(alumnoId: number, bimestre: number, ciclo: number): Promise<void> {
  const db = createBoletasDb()
  const celdas = await celdasClassroomAlumno(alumnoId, bimestre, ciclo)
  if (!celdas.size) return
  const { data, error } = await db
    .from(TABLA_CALIF_PRIMARIA.en)
    .select('materia_id, calificacion')
    .eq('alumno_id', alumnoId)
    .eq('bimestre', bimestre)
    .eq('ciclo', ciclo)
    .in('materia_id', [...celdas.keys()])
  if (error) throw new Error(error.message)
  const ahora = new Date().toISOString()
  const cambios = ((data ?? []) as { materia_id: number; calificacion: string }[])
    .map((r) => {
      const c = celdas.get(Number(r.materia_id))!
      const origen = String(r.calificacion ?? '') === c.valor ? 'classroom' : 'manual'
      return origen === c.origen
        ? null
        : { alumno_id: alumnoId, materia_id: Number(r.materia_id), bimestre, ciclo, valor_classroom: c.valor, origen, updated_at: ahora }
    })
    .filter((x) => x != null)
  if (!cambios.length) return
  const { error: e2 } = await db.from(TABLA_VISTO).upsert(cambios, { onConflict: 'alumno_id,materia_id,bimestre,ciclo' })
  if (e2) throw new Error(e2.message)
}
