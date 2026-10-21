import type { classroom_v1 } from 'googleapis'
import { createBoletasDb } from './boletasInsforge'
import {
  emparejarPorNombre,
  esFalloGoogle,
  mayus,
  promedioClassroom,
  todas,
  type AlumnoConNombre,
  type ClassroomCelda,
  type ClassroomResumen,
} from './boletasPrimariaEnClassroom'
import {
  BOLETAS_NIVEL_SEC,
  MODULO_SECUNDARIA,
  grupoNumeroSec,
  listarMaestrosSec,
  nombreMaestro,
  truncar,
  type SecMateria,
} from './boletasSecundariaService'
import { fechasDeTrimestre } from './boletasTrimestreFechas'
import { medirConSonda } from './panelControl/sonda'
import { clienteClassroom } from './teamEnglish/teClassroom'

/**
 * Boleta Secundaria ← Google Classroom. Cada maestro tiene una clase por materia y grupo («7A ARTES», 7–9 = 1°–3°)
 * casi siempre de todo el ciclo, así que el trimestre sale de las fechas que captura la dirección (fecha de entrega
 * de la tarea o, si no tiene, la de creación). Francés y FSH llevan el trimestre en el nombre («1T FRA 9C»); Inglés
 * va por nivel con grupos juntos («1T 7AB B1»). Se busca en el Classroom de todos los maestros asignados a la
 * materia. Calificación ÷ 10, truncada a un decimal, mínimo 5. Gana el último cambio, como en Primaria Inglés.
 */

const TABLA_LIGA = 'boleta_classroom_alumno'
const TABLA_VISTO = 'boleta_classroom_calif_sec'
const TABLA_SYNC = 'boleta_classroom_sync_sec'
const ESPERA_MS = 2 * 60 * 1000
const CALIF_MIN = 5
const ZONA = 'America/Monterrey'

/** Materia del catálogo (nombre normalizado) → cómo se reconoce su clase en Classroom. */
const MATERIAS: { materia: RegExp; clase: RegExp }[] = [
  { materia: /INGLES/, clase: /(?:^|[^A-Z0-9])(?:A1|A2|B1|B2|C1)(?:[^A-Z0-9]|$)/ },
  { materia: /FRANCES/, clase: /(?:^|[^A-Z])FRA(?:NCES)?(?:[^A-Z]|$)/ },
  { materia: /EDUCACION FISICA/, clase: /DEPORTE|EDUCACION FISICA|ED\.? ?FISICA/ },
  { materia: /BIOLOGIA/, clase: /BIOLOGIA/ },
  { materia: /FISICA/, clase: /(?<!EDUCACION |ED\. |ED )FISICA/ },
  { materia: /QUIMICA/, clase: /QUIMICA/ },
  { materia: /ESPANOL/, clase: /ESPANOL/ },
  { materia: /CIVICA/, clase: /CIVICA/ },
  { materia: /SOCIAL Y HUMANA/, clase: /(?:^|[^A-Z])FSH(?:[^A-Z]|$)|SOCIAL Y HUMANA/ },
  { materia: /GEOGRAFIA/, clase: /GEOGRAFIA/ },
  { materia: /HISTORIA/, clase: /HISTORIA/ },
  { materia: /TECNOLOGIA/, clase: /TECNOLOGIA/ },
  { materia: /MATEMATICAS/, clase: /MATEMATICAS|(?:^|[^A-Z])MATH(?:[^A-Z]|$)/ },
  { materia: /MINDFULNESS/, clase: /MINDFULNESS/ },
  { materia: /ROBOTICA/, clase: /ROBOTICA/ },
  { materia: /EMPRENDIMIENTO/, clase: /EMPRENDIMIENTO/ },
  { materia: /ARTES?(?:[^A-Z]|$)/, clase: /(?:^|[^A-Z])ARTES?(?:[^A-Z]|$)/ },
]

const NO_BOLETA = /^\s*COPIA DE\b|TALLER|WORKSHOP|RESPALDO/

export function claseDeMateria(nombreMateria: string): RegExp | null {
  const m = mayus(nombreMateria)
  return MATERIAS.find((x) => x.materia.test(m))?.clase ?? null
}

/** Grado (1–3), grupos y trimestre (si lo trae) a partir del nombre de la clase. null si no es de secundaria. */
export function leerNombreClaseSec(nombre: string): { grado: number; grupos: string[]; trimestre: number | null } | null {
  const n = mayus(nombre)
  if (NO_BOLETA.test(n)) return null
  const g = /(?:^|[^0-9])([789])\s*([ABC]{1,3})(?![A-Z0-9])/.exec(n)
  if (!g) return null
  const t = /(?:^|[^0-9])([123])\s*(?:T|TRIM(?:ESTRE)?)(?![A-Z])/.exec(n) ?? /TRIM(?:ESTRE)?\s*([123])(?!\d)/.exec(n)
  return { grado: Number(g[1]) - 6, grupos: [...new Set(g[2].split(''))], trimestre: t ? Number(t[1]) : null }
}

/** De 0–100 a la boleta de secundaria: ÷ 10, truncada a un decimal, de 5 a 10. */
export function aEscalaSec(porcentaje: number): string {
  return String(truncar(Math.min(10, Math.max(CALIF_MIN, porcentaje / 10)), 1))
}

type Gradebook = { calculationType?: string; gradeCategories?: { id?: string; weight?: number }[] }
type Tarea = { id: string; max: number; categoria: string | null }

type DatosClase = {
  nombre: string
  maestro: string
  varios: boolean
  gb: Gradebook | undefined
  tareas: Tarea[]
  notas: Map<string, Map<string, number>>
  alumnos: { googleId: string; nombre: string }[]
}

function diaLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { timeZone: ZONA })
}

function fechaTarea(w: classroom_v1.Schema$CourseWork): string {
  const d = w.dueDate
  if (d?.year && d.month && d.day) return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
  return diaLocal(w.creationTime)
}

async function leerClase(
  cr: classroom_v1.Classroom,
  c: classroom_v1.Schema$Course,
  maestro: string,
  varios: boolean,
  rango: { inicio: string; fin: string } | null
): Promise<DatosClase> {
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
    .filter((w) => {
      if (!rango) return true
      const f = fechaTarea(w)
      return f !== '' && f >= rango.inicio && f <= rango.fin
    })
    .map((w) => ({ id: w.id!, max: Number(w.maxPoints), categoria: (w as { gradeCategory?: { id?: string } }).gradeCategory?.id ?? null }))
  const vale = new Set(tareas.map((t) => t.id))
  const notas = new Map<string, Map<string, number>>()
  for (const s of entregas) {
    if (!s.userId || !s.courseWorkId || s.assignedGrade == null || !vale.has(s.courseWorkId)) continue
    const m = notas.get(s.userId) ?? new Map<string, number>()
    m.set(s.courseWorkId, Number(s.assignedGrade))
    notas.set(s.userId, m)
  }
  return {
    nombre: c.name ?? '',
    maestro,
    varios,
    gb: (curso.data as { gradebookSettings?: Gradebook }).gradebookSettings,
    tareas,
    notas,
    alumnos: alumnos.filter((a) => a.userId).map((a) => ({ googleId: a.userId!, nombre: a.profile?.name?.fullName ?? '' })),
  }
}

async function alumnosConNombre(ciclo: number, grado: number, grupo: string): Promise<AlumnoConNombre[]> {
  const { data, error } = await createBoletasDb()
    .from('alumno')
    .select('alumno_id, alumno_nombre, alumno_app, alumno_apm')
    .eq('alumno_nivel', BOLETAS_NIVEL_SEC)
    .eq('alumno_ciclo_escolar', ciclo)
    .eq('alumno_grado', grado)
    .eq('alumno_grupo', grupoNumeroSec(grupo))
    .in('alumno_status', [1, 4, 5])
    .limit(1000)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    alumno_id: Number(r.alumno_id),
    nombres: String(r.alumno_nombre ?? '').trim(),
    app: String(r.alumno_app ?? '').trim(),
    apm: String(r.alumno_apm ?? '').trim(),
  }))
}

type Clave = { ciclo: number; trimestre: number; materiaId: number; grupo: string }

export async function resumenClassroomSec(input: Clave): Promise<ClassroomResumen | null> {
  const { data, error } = await createBoletasDb()
    .from(TABLA_SYNC)
    .select('resumen')
    .eq('ciclo', input.ciclo)
    .eq('bimestre', input.trimestre)
    .eq('materia_id', input.materiaId)
    .eq('grupo', input.grupo)
    .limit(1)
  if (error) throw new Error(error.message)
  const r = (data?.[0] as { resumen?: ClassroomResumen } | undefined)?.resumen
  return r && r.sincronizadoEn ? r : null
}

/** Trae las calificaciones del trimestre de una materia y grupo desde Classroom (máximo una vez cada 2 min). */
export async function sincronizarClassroomSec(input: Clave & { materia: SecMateria; forzar?: boolean }): Promise<ClassroomResumen> {
  const { ciclo, trimestre, materia, grupo } = input
  const clave = { ciclo, trimestre, materiaId: materia.id, grupo }
  const previo = await resumenClassroomSec(clave)
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
      .upsert([{ ciclo, bimestre: trimestre, materia_id: materia.id, grupo, sincronizado_en: resumen.sincronizadoEn, resumen }], {
        onConflict: 'ciclo,bimestre,materia_id,grupo',
      })
    if (error) throw new Error(error.message)
    return resumen
  }

  const reClase = claseDeMateria(materia.nombre)
  if (!reClase) {
    resumen.aviso = `No sé cómo se llama en Classroom la clase de ${materia.nombre}.`
    return guardar()
  }
  const maestros = (await listarMaestrosSec()).filter((m) => m.email && m.asignaciones.some((a) => a.materiaId === materia.id))
  if (!maestros.length) {
    resumen.aviso = `${materia.nombre} no tiene maestros con correo asignados en el catálogo.`
    return guardar()
  }
  resumen.teacher = maestros.map(nombreMaestro).join(', ')
  const rango = await fechasDeTrimestre(ciclo, MODULO_SECUNDARIA, trimestre)

  let clases: DatosClase[] = []
  let sinFechas = false
  const fallos: string[] = []
  await medirConSonda(
    'google-classroom',
    async () => {
      const vistos = new Set<string>()
      for (const m of maestros) {
        let cr: classroom_v1.Classroom
        let cursos: classroom_v1.Schema$Course[]
        try {
          cr = clienteClassroom(m.email)
          cursos = await todas((pageToken) =>
            cr.courses
              .list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 100, pageToken })
              .then((r) => ({ items: r.data.courses, next: r.data.nextPageToken }))
          )
        } catch (e) {
          if (esFalloGoogle(e) && Number((e as { code?: unknown }).code) !== 400) throw e
          fallos.push(nombreMaestro(m))
          continue
        }
        const delGrupo = cursos.filter((c) => {
          if (!c.id || vistos.has(c.id)) return false
          const d = leerNombreClaseSec(c.name ?? '')
          if (!d || d.grado !== materia.grado || !d.grupos.includes(grupo)) return false
          if (d.trimestre != null && d.trimestre !== trimestre) return false
          return reClase.test(mayus(c.name))
        })
        for (const c of delGrupo) vistos.add(c.id!)
        const leidas = await Promise.all(
          delGrupo.map((c) => {
            const d = leerNombreClaseSec(c.name ?? '')!
            if (d.trimestre == null && !rango) {
              sinFechas = true
              return null
            }
            return leerClase(cr, c, nombreMaestro(m), d.grupos.length > 1, d.trimestre != null ? null : rango)
          })
        )
        clases.push(...leidas.filter((x): x is DatosClase => x != null))
      }
    },
    esFalloGoogle
  ).catch((e) => {
    resumen.aviso = `No se pudo leer Classroom: ${e instanceof Error ? e.message.slice(0, 160) : 'error'}`
  })
  if (resumen.aviso) return guardar()

  clases = clases.filter((c) => c.alumnos.length > 0)
  if (!clases.length) {
    resumen.aviso = sinFechas
      ? `La dirección aún no captura las fechas del trimestre ${trimestre}; sin ellas no se puede separar el trimestre en Classroom.`
      : `No encontré en Classroom la clase de ${materia.nombre} ${materia.grado + 6}${grupo}${fallos.length ? ` (no respondió Google para ${fallos.join(', ')})` : ''}.`
    return guardar()
  }
  resumen.clases = clases.map((c) => ({ nombre: c.nombre, materias: [materia.nombre] }))

  // Alumnos de Classroom ↔ sistema: lo ya ligado (si es del grupo), luego por nombre. En clases de varios grupos
  // (Inglés por nivel) los que no son de este grupo no cuentan como «sin ligar».
  const alumnos = await alumnosConNombre(ciclo, materia.grado, grupo)
  const googleIds = [...new Set(clases.flatMap((c) => c.alumnos.map((a) => a.googleId)))]
  const nombreDe = new Map(clases.flatMap((c) => c.alumnos.map((a) => [a.googleId, a.nombre] as const)))
  const soloVarios = new Set(googleIds.filter((g) => clases.every((c) => c.varios || !c.alumnos.some((a) => a.googleId === g))))
  const { data: ligas, error: errLiga } = await db.from(TABLA_LIGA).select('google_id, alumno_id').in('google_id', googleIds)
  if (errLiga) throw new Error(errLiga.message)
  const ligados = new Set(((ligas ?? []) as { google_id: string }[]).map((l) => l.google_id))
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
    if (alumnoDe.has(gid) || ligados.has(gid)) continue
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
    .filter((g) => !alumnoDe.has(g) && !ligados.has(g) && !soloVarios.has(g))
    .map((g) => ({ googleId: g, nombre: nombreDe.get(g) ?? '' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  // Si un alumno está en varias clases (p. ej. dos niveles de Inglés), cuenta la que le tiene más calificaciones.
  const valores = new Map<number, { n: number; valor: string }>()
  for (const c of clases) {
    for (const a of c.alumnos) {
      const alumnoId = alumnoDe.get(a.googleId)
      if (alumnoId == null) continue
      const notas = c.notas.get(a.googleId) ?? new Map<string, number>()
      const p = promedioClassroom(c.gb, c.tareas, notas)
      if (p == null) continue
      const previo = valores.get(alumnoId)
      if (previo && previo.n >= notas.size) continue
      valores.set(alumnoId, { n: notas.size, valor: aEscalaSec(p) })
    }
  }
  resumen.calificaciones = valores.size
  if (!valores.size) return guardar()

  const ids = [...valores.keys()]
  const { data: vistos, error: errVisto } = await db
    .from(TABLA_VISTO)
    .select('alumno_id, valor_classroom')
    .in('alumno_id', ids)
    .eq('materia_id', materia.id)
    .eq('bimestre', trimestre)
    .eq('ciclo', ciclo)
  if (errVisto) throw new Error(errVisto.message)
  const visto = new Map(((vistos ?? []) as { alumno_id: number; valor_classroom: string }[]).map((r) => [Number(r.alumno_id), String(r.valor_classroom)]))
  const cambiaron = [...valores.entries()].filter(([id, v]) => visto.get(id) !== v.valor)
  if (cambiaron.length) {
    const ahora = resumen.sincronizadoEn
    const { error: e1 } = await db.from('boleta_calificacion').upsert(
      cambiaron.map(([id, v]) => ({
        alumno_id: id,
        materia_id: materia.id,
        calificacion_bimestre: trimestre,
        calificacion_ciclo_escolar: ciclo,
        calificacion_puntos: v.valor,
        calificacion_registro: ahora,
      })),
      { onConflict: 'alumno_id,materia_id,calificacion_bimestre,calificacion_ciclo_escolar' }
    )
    if (e1) throw new Error(e1.message)
    const { error: e2 } = await db.from(TABLA_VISTO).upsert(
      cambiaron.map(([id, v]) => ({
        alumno_id: id,
        materia_id: materia.id,
        bimestre: trimestre,
        ciclo,
        valor_classroom: v.valor,
        origen: 'classroom',
        updated_at: ahora,
      })),
      { onConflict: 'alumno_id,materia_id,bimestre,ciclo' }
    )
    if (e2) throw new Error(e2.message)
  }
  resumen.cambios = cambiaron.length
  return guardar()
}

/** Lo que dio Classroom por alumno en una materia y trimestre, y si la boleta lo conserva o se ajustó aquí. */
export async function celdasClassroomSec(input: Omit<Clave, 'grupo'>): Promise<Record<number, ClassroomCelda>> {
  const { data, error } = await createBoletasDb()
    .from(TABLA_VISTO)
    .select('alumno_id, valor_classroom, origen')
    .eq('materia_id', input.materiaId)
    .eq('bimestre', input.trimestre)
    .eq('ciclo', input.ciclo)
    .limit(1000)
  if (error) throw new Error(error.message)
  return Object.fromEntries(
    ((data ?? []) as { alumno_id: number; valor_classroom: string; origen: string }[]).map((r) => [
      Number(r.alumno_id),
      { valor: String(r.valor_classroom), origen: r.origen === 'manual' ? 'manual' : 'classroom' } satisfies ClassroomCelda,
    ])
  )
}

/** Tras guardar a mano: las calificaciones que ya no son las de Classroom quedan como ajustadas aquí. */
export async function marcarAjustesClassroomSec(input: Omit<Clave, 'grupo'> & { cambios: { alumnoId: unknown; cal?: unknown }[] }): Promise<void> {
  const conCal = input.cambios.filter((c) => c.cal !== undefined)
  if (!conCal.length) return
  const celdas = await celdasClassroomSec(input)
  const ahora = new Date().toISOString()
  const filas = conCal
    .map((c) => {
      const id = Number(c.alumnoId)
      const celda = celdas[id]
      if (!celda) return null
      const v = String(c.cal ?? '').trim().replace(',', '.')
      const origen = v !== '' && Number(v) === Number(celda.valor) ? 'classroom' : 'manual'
      return origen === celda.origen
        ? null
        : { alumno_id: id, materia_id: input.materiaId, bimestre: input.trimestre, ciclo: input.ciclo, valor_classroom: celda.valor, origen, updated_at: ahora }
    })
    .filter((x) => x != null)
  if (!filas.length) return
  const { error } = await createBoletasDb().from(TABLA_VISTO).upsert(filas, { onConflict: 'alumno_id,materia_id,bimestre,ciclo' })
  if (error) throw new Error(error.message)
}
