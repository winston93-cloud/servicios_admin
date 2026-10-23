import type { classroom_v1 } from 'googleapis'
import { createBoletasDb } from './boletasInsforge'
import {
  emparejarPorNombre,
  esFalloGoogle,
  mayus,
  promedioClassroom,
  todas,
  type ClassroomCelda,
  type ClassroomResumen,
} from './boletasPrimariaEnClassroom'
import {
  PRIMARIA_CALIF_MIN,
  TABLA_CALIF_PRIMARIA,
  listarAlumnosPrimaria,
  materiasActivasPrimaria,
  type PrimariaGrado,
  type PrimariaMateria,
} from './boletasPrimariaComun'
import { truncar } from './boletasSecundariaCatalog'
import { fechasDeTrimestre } from './boletasTrimestreFechas'
import { medirConSonda } from './panelControl/sonda'
import { clienteClassroom } from './teamEnglish/teClassroom'

/**
 * Boleta Primaria Español ← Google Classroom. La maestra titular tiene una clase por materia y grupo
 * («1A Español», «3B Entidad donde vivo») de todo el ciclo, así que el trimestre sale de las fechas que captura
 * la dirección (fecha de entrega o, sin ella, de creación). El promedio es el de Classroom, ÷ 10 truncado a un
 * decimal, mínimo 5. Mismas reglas que Primaria Inglés: gana el último cambio y las ligas de alumnos se comparten.
 */

const TABLA_LIGA = 'boleta_classroom_alumno'
const TABLA_VISTO = 'boleta_classroom_calif_primaria_es'
const TABLA_SYNC = 'boleta_classroom_sync_primaria_es'
const ESPERA_MS = 2 * 60 * 1000
const ZONA = 'America/Monterrey'

/** Palabra clave en el nombre de la clase y en el de la materia de la boleta. */
const MATERIAS: RegExp[] = [/ESPANOL/, /MATEMATICAS/, /CONOCIMIENTO/, /ENTIDAD/, /CIENCIAS/, /HISTORIA/, /GEOGRAFIA/, /CIVICA/]

const NO_BOLETA = /^\s*COPIA DE\b|TALLER|WORKSHOP|RESPALDO/

/** Grado, grupo y materia a partir del nombre de la clase; null si no es una clase de boleta. */
export function leerNombreClaseEs(nombre: string): { grado: number; grupo: string; materia: RegExp } | null {
  const n = mayus(nombre)
  if (NO_BOLETA.test(n)) return null
  const g = /^\s*([1-6])\s*(?:°|º)?\s*([ABC])(?![A-Z])/.exec(n)
  const materia = MATERIAS.find((re) => re.test(n))
  if (!g || !materia) return null
  return { grado: Number(g[1]), grupo: g[2], materia }
}

/** De 0–100 a la escala de la boleta: ÷ 10 truncado a un decimal, de 5 a 10. */
export function aEscalaBoletaEs(porcentaje: number): string {
  return Math.min(10, Math.max(PRIMARIA_CALIF_MIN, truncar(porcentaje / 10, 1))).toFixed(1)
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

type Gradebook = Parameters<typeof promedioClassroom>[0]
type Tarea = Parameters<typeof promedioClassroom>[1][number]

type DatosClase = {
  nombre: string
  materia: RegExp
  gb: Gradebook
  tareas: Tarea[]
  notas: Map<string, Map<string, number>>
  alumnos: { googleId: string; nombre: string }[]
}

async function leerClase(
  cr: classroom_v1.Classroom,
  c: classroom_v1.Schema$Course,
  materia: RegExp,
  rango: { inicio: string; fin: string }
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
    .filter((w) => {
      if (!w.id || (w.maxPoints ?? 0) <= 0) return false
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
    materia,
    gb: (curso.data as { gradebookSettings?: Gradebook }).gradebookSettings,
    tareas,
    notas,
    alumnos: alumnos.filter((a) => a.userId).map((a) => ({ googleId: a.userId!, nombre: a.profile?.name?.fullName ?? '' })),
  }
}

/** Maestra(s) titulares del grupo en el catálogo de boletas (casilla «Maestro(a)» de primaria), con correo. */
async function maestrasDelGrupo(grado: number, grupo: string): Promise<{ nombre: string; email: string }[]> {
  const db = createBoletasDb()
  const { data: materias, error } = await db
    .from('boleta_materia')
    .select('materia_id')
    .eq('materia_nivel', 3)
    .eq('materia_grado', grado)
    .eq('materia_nombre', 'Maestro(a)')
  if (error) throw new Error(error.message)
  const ids = (materias ?? []).map((m) => Number(m.materia_id))
  if (!ids.length) return []
  const { data: asig, error: errA } = await db.from('boleta_maestro_grupo').select('maestro_id, grupo_letra').in('materia_id', ids)
  if (errA) throw new Error(errA.message)
  const maestroIds = [
    ...new Set(
      ((asig ?? []) as { maestro_id: number; grupo_letra: string | null }[])
        .filter((a) => String(a.grupo_letra ?? '').toUpperCase().includes(grupo))
        .map((a) => Number(a.maestro_id))
    ),
  ]
  if (!maestroIds.length) return []
  const { data: ms, error: errM } = await db
    .from('boleta_maestro')
    .select('maestro_nombre, maestro_app, maestro_email')
    .in('maestro_id', maestroIds)
  if (errM) throw new Error(errM.message)
  return ((ms ?? []) as Record<string, unknown>[])
    .filter((m) => String(m.maestro_email ?? '').includes('@'))
    .map((m) => ({
      nombre: [m.maestro_nombre, m.maestro_app].map((x) => String(x ?? '').trim()).filter(Boolean).join(' '),
      email: String(m.maestro_email).trim(),
    }))
}

export async function resumenClassroomPrimariaEs(input: {
  ciclo: number
  trimestre: number
  grado: number
  grupo: string
}): Promise<ClassroomResumen | null> {
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
export async function sincronizarClassroomPrimariaEs(input: {
  ciclo: number
  trimestre: number
  grado: number
  grupo: string
  forzar?: boolean
}): Promise<ClassroomResumen> {
  const { ciclo, trimestre, grado, grupo } = input
  const previo = await resumenClassroomPrimariaEs(input)
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

  const maestras = await maestrasDelGrupo(grado, grupo)
  if (!maestras.length) {
    resumen.aviso = `${grado}°${grupo} no tiene maestra titular con correo en «Maestras y grupos».`
    return guardar()
  }
  resumen.teacher = maestras.map((m) => m.nombre).join(', ')
  const rango = await fechasDeTrimestre(ciclo, 'primaria-es', trimestre)
  if (!rango) {
    resumen.aviso = `Falta que la dirección capture las fechas del trimestre ${trimestre} (Entregas y publicación → Fechas de los trimestres).`
    return guardar()
  }

  const [alumnos, materias] = await Promise.all([
    listarAlumnosPrimaria({ grado, grupoLetra: grupo, ciclo }),
    materiasActivasPrimaria('es', grado as PrimariaGrado),
  ])

  const clases: DatosClase[] = []
  const fallos: string[] = []
  const vistos = new Set<string>()
  await medirConSonda(
    'google-classroom',
    async () => {
      for (const m of maestras) {
        try {
          const cr = clienteClassroom(m.email)
          const cursos = await todas((pageToken) =>
            cr.courses
              .list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 100, pageToken })
              .then((r) => ({ items: r.data.courses, next: r.data.nextPageToken }))
          )
          const delGrupo = cursos
            .filter((c) => c.id && !vistos.has(c.id))
            .map((c) => ({ c, d: leerNombreClaseEs(c.name ?? '') }))
            .filter((x) => x.d && x.d.grado === grado && x.d.grupo === grupo)
          for (const x of delGrupo) vistos.add(x.c.id!)
          clases.push(...(await Promise.all(delGrupo.map((x) => leerClase(cr, x.c, x.d!.materia, rango)))))
        } catch (e) {
          if (maestras.length === 1) throw e
          fallos.push(m.nombre)
        }
      }
    },
    esFalloGoogle
  ).catch((e) => {
    resumen.aviso = `No se pudo leer Classroom de ${resumen.teacher}: ${e instanceof Error ? e.message.slice(0, 160) : 'error'}`
  })
  if (resumen.aviso) return guardar()
  if (fallos.length) resumen.aviso = `No se pudo leer Classroom de ${fallos.join(', ')}.`

  const conAlumnos = clases.filter((c) => c.alumnos.length > 0)
  if (!conAlumnos.length) {
    resumen.aviso = `${resumen.teacher} no tiene clases de ${grado}${grupo} en Classroom.`
    return guardar()
  }

  const evaluables = materias.filter((m) => m.seccion !== 'habilidades')
  const materiasDe = (re: RegExp): PrimariaMateria[] => evaluables.filter((m) => re.test(mayus(m.nombre)))
  resumen.clases = conAlumnos.map((c) => ({ nombre: c.nombre, materias: materiasDe(c.materia).map((m) => m.nombre) }))

  // Alumnos de Classroom ↔ sistema: primero lo ya ligado (si sigue en el grupo), luego por nombre.
  const googleIds = [...new Set(conAlumnos.flatMap((c) => c.alumnos.map((a) => a.googleId)))]
  const nombreDe = new Map(conAlumnos.flatMap((c) => c.alumnos.map((a) => [a.googleId, a.nombre] as const)))
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

  // Si un alumno sale en dos clases de la misma materia, gana la que le tenga más calificaciones.
  const valores = new Map<string, { alumno_id: number; materia_id: number; valor: string; n: number }>()
  for (const c of conAlumnos) {
    const destino = materiasDe(c.materia)
    if (!destino.length) continue
    for (const a of c.alumnos) {
      const alumnoId = alumnoDe.get(a.googleId)
      if (alumnoId == null) continue
      const notas = c.notas.get(a.googleId) ?? new Map<string, number>()
      const p = promedioClassroom(c.gb, c.tareas, notas)
      if (p == null) continue
      const valor = aEscalaBoletaEs(p)
      for (const m of destino) {
        const k = `${alumnoId}-${m.id}`
        if ((valores.get(k)?.n ?? -1) >= notas.size) continue
        valores.set(k, { alumno_id: alumnoId, materia_id: m.id, valor, n: notas.size })
      }
    }
  }
  resumen.calificaciones = valores.size
  if (!valores.size) return guardar()

  const ids = [...new Set([...valores.values()].map((v) => v.alumno_id))]
  const { data: previos, error: errVisto } = await db
    .from(TABLA_VISTO)
    .select('alumno_id, materia_id, valor_classroom')
    .in('alumno_id', ids)
    .eq('bimestre', trimestre)
    .eq('ciclo', ciclo)
  if (errVisto) throw new Error(errVisto.message)
  const visto = new Map(
    ((previos ?? []) as { alumno_id: number; materia_id: number; valor_classroom: string }[]).map((r) => [
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
    const { error: e1 } = await db.from(TABLA_CALIF_PRIMARIA.es).upsert(califs, { onConflict: 'alumno_id,materia_id,bimestre,ciclo' })
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

/** Lo que dio Classroom por materia para un alumno y si la boleta lo conserva o fue ajustada aquí. */
export async function celdasClassroomAlumnoEs(alumnoId: number, bimestre: number, ciclo: number): Promise<Map<number, ClassroomCelda>> {
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
export async function marcarAjustesClassroomEs(alumnoId: number, bimestre: number, ciclo: number): Promise<void> {
  const db = createBoletasDb()
  const celdas = await celdasClassroomAlumnoEs(alumnoId, bimestre, ciclo)
  if (!celdas.size) return
  const { data, error } = await db
    .from(TABLA_CALIF_PRIMARIA.es)
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
