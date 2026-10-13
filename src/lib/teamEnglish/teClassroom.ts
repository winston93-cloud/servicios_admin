import { google, type classroom_v1 } from 'googleapis'
import { TeError } from './teService'
import type {
  TeClassroomCurso,
  TeClassroomDetalle,
  TeClassroomPlanItem,
  TeClassroomPublicacion,
  TeClassroomResumen,
  TeClassroomTarea,
  TeCoMaestrasSync,
  PlanBloque,
  PlanContenido,
  SkillClave,
} from './teTypes'
import { DIAS_PLAN, hoyMx, lunesDe, materialDe, skillDe, sumarDias } from './teTypes'

/** Deben coincidir con los alcances de la delegación de dominio del service account en admin.google.com. */
const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
]

const DOMINIO = '@winston93.edu.mx'

/** Super admin de Workspace: Google solo deja agregar co-maestros directamente a un administrador. */
const ADMIN_WORKSPACE = 'sistemas.desarrollo@winston93.edu.mx'
const SCOPES_ADMIN = ['https://www.googleapis.com/auth/classroom.rosters', 'https://www.googleapis.com/auth/classroom.courses.readonly']

/** Cuentas que deben poder abrir todas las clases de las teachers (se agregan como co-maestras). */
const CO_MAESTRAS = ['coordinacioninglesprimaria@winston93.edu.mx', 'sistemas.desarrollo@winston93.edu.mx']
/** Cuentas que se retiran de las clases en la siguiente sincronización. */
const CO_MAESTRAS_RETIRAR: string[] = []

function clienteClassroom(email: string, scopes: string[] = SCOPES): classroom_v1.Classroom {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!sa || !key) throw new TeError('Falta configurar la cuenta de servicio de Google.', 500)
  const auth = new google.auth.JWT({ email: sa, key, scopes, subject: email })
  return google.classroom({ version: 'v1', auth })
}

export function normalizarCorreoTeacher(raw: unknown): string {
  const email = String(raw ?? '').trim().toLowerCase()
  if (!email.endsWith(DOMINIO) || !/^[a-z0-9._%+-]+@/.test(email)) {
    throw new TeError(`El correo debe ser institucional (${DOMINIO}).`)
  }
  return email
}

function maxIso(...fechas: (string | null | undefined)[]): string | null {
  const validas = fechas.filter((f): f is string => !!f).sort()
  return validas.length ? validas[validas.length - 1] : null
}

async function contarAlumnos(cr: classroom_v1.Classroom, courseId: string): Promise<number> {
  let total = 0
  let pageToken: string | undefined
  do {
    const r = await cr.courses.students.list({ courseId, pageSize: 100, pageToken })
    total += r.data.students?.length ?? 0
    pageToken = r.data.nextPageToken ?? undefined
  } while (pageToken)
  return total
}

async function resumenCurso(cr: classroom_v1.Classroom, c: classroom_v1.Schema$Course): Promise<TeClassroomCurso> {
  const courseId = c.id!
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [alumnos, tareas, avisos] = await Promise.all([
    contarAlumnos(cr, courseId),
    cr.courses.courseWork.list({ courseId, pageSize: 100, orderBy: 'updateTime desc' }),
    cr.courses.announcements.list({ courseId, pageSize: 50, orderBy: 'updateTime desc' }),
  ])
  const trabajos = tareas.data.courseWork ?? []
  const anuncios = avisos.data.announcements ?? []
  return {
    id: courseId,
    nombre: c.name ?? '(sin nombre)',
    seccion: c.section ?? null,
    enlace: c.alternateLink ?? null,
    alumnos,
    tareas: trabajos.length,
    tareas_30d: trabajos.filter((t) => (t.creationTime ?? '') >= hace30).length,
    avisos_30d: anuncios.filter((a) => (a.creationTime ?? '') >= hace30).length,
    ultima_actividad: maxIso(c.updateTime, trabajos[0]?.updateTime, anuncios[0]?.updateTime),
  }
}

function errorGoogle(e: unknown, email: string): never {
  if (e instanceof TeError) throw e
  const err = e as { code?: number; response?: { data?: { error?: string } }; message?: string }
  const codigo = err.response?.data?.error
  if (codigo === 'unauthorized_client') {
    throw new TeError('Google aún no autoriza los permisos de Classroom para la cuenta de servicio.', 502)
  }
  if (codigo === 'invalid_grant') throw new TeError(`Google no reconoce el correo ${email}.`, 404)
  if (err.code === 403 || err.code === 404) throw new TeError('Esa clase no es de esta teacher.', 404)
  throw new TeError(`Classroom: ${err.message ?? 'error'}`, 502)
}

/** Solo lectura: clases activas donde el correo es maestro. */
export async function resumenClassroomTeacher(rawEmail: unknown): Promise<TeClassroomResumen> {
  const email = normalizarCorreoTeacher(rawEmail)
  const cr = clienteClassroom(email)
  try {
    const r = await cr.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 50 })
    const cursos = await Promise.all((r.data.courses ?? []).map((c) => resumenCurso(cr, c)))
    return { email, cursos }
  } catch (e) {
    errorGoogle(e, email)
  }
}

const MAX_TAREAS = 60

function fechaEntrega(t: classroom_v1.Schema$CourseWork): string | null {
  const d = t.dueDate
  if (!d?.year || !d.month || !d.day) return null
  const hh = String(t.dueTime?.hours ?? 23).padStart(2, '0')
  const mm = String(t.dueTime?.minutes ?? 59).padStart(2, '0')
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}T${hh}:${mm}:00Z`
}

function publicacion(id: string | null | undefined, texto: string | null | undefined, fecha: string | null | undefined, enlace: string | null | undefined): TeClassroomPublicacion {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim()
  return { id: id ?? '', texto: limpio.length > 280 ? `${limpio.slice(0, 280)}…` : limpio, fecha: fecha ?? null, enlace: enlace ?? null }
}

async function entregasCurso(cr: classroom_v1.Classroom, courseId: string): Promise<classroom_v1.Schema$StudentSubmission[]> {
  const out: classroom_v1.Schema$StudentSubmission[] = []
  let pageToken: string | undefined
  do {
    const r = await cr.courses.courseWork.studentSubmissions.list({ courseId, courseWorkId: '-', pageSize: 1000, pageToken })
    out.push(...(r.data.studentSubmissions ?? []))
    pageToken = r.data.nextPageToken ?? undefined
  } while (pageToken && out.length < 20_000)
  return out
}

/** Solo lectura: tareas con estado de entregas, avisos y materiales de una clase de la teacher. */
export async function detalleClassroomCurso(rawEmail: unknown, courseId: string): Promise<TeClassroomDetalle> {
  const email = normalizarCorreoTeacher(rawEmail)
  if (!/^[0-9]{1,30}$/.test(courseId)) throw new TeError('Clase inválida.')
  const cr = clienteClassroom(email)
  try {
    await cr.courses.teachers.get({ courseId, userId: 'me' })
    const [alumnos, trabajos, entregas, avisos, materiales] = await Promise.all([
      contarAlumnos(cr, courseId),
      cr.courses.courseWork.list({ courseId, pageSize: MAX_TAREAS, orderBy: 'updateTime desc' }),
      entregasCurso(cr, courseId),
      cr.courses.announcements.list({ courseId, pageSize: 15, orderBy: 'updateTime desc' }),
      cr.courses.courseWorkMaterials.list({ courseId, pageSize: 15, orderBy: 'updateTime desc' }),
    ])
    const porTarea = new Map<string, classroom_v1.Schema$StudentSubmission[]>()
    for (const s of entregas) {
      if (!s.courseWorkId) continue
      const lista = porTarea.get(s.courseWorkId) ?? []
      lista.push(s)
      porTarea.set(s.courseWorkId, lista)
    }
    const tareas: TeClassroomTarea[] = (trabajos.data.courseWork ?? [])
      .map((t) => {
        const subs = porTarea.get(t.id ?? '') ?? []
        return {
          id: t.id ?? '',
          titulo: t.title?.trim() || '(sin título)',
          tipo: t.workType ?? 'ASSIGNMENT',
          publicada: t.creationTime ?? null,
          entrega: fechaEntrega(t),
          puntos: t.maxPoints ?? null,
          enlace: t.alternateLink ?? null,
          asignados: subs.length,
          entregadas: subs.filter((s) => s.state === 'TURNED_IN' || s.state === 'RETURNED').length,
          tarde: subs.filter((s) => s.late).length,
          calificadas: subs.filter((s) => s.assignedGrade != null).length,
          devueltas: subs.filter((s) => s.state === 'RETURNED').length,
        }
      })
      .sort((a, b) => (b.publicada ?? '').localeCompare(a.publicada ?? ''))
    return {
      curso_id: courseId,
      alumnos,
      tareas,
      avisos: (avisos.data.announcements ?? []).map((a) => publicacion(a.id, a.text, a.creationTime, a.alternateLink)),
      materiales: (materiales.data.courseWorkMaterial ?? []).map((m) =>
        publicacion(m.id, m.title || m.description, m.creationTime, m.alternateLink),
      ),
    }
  } catch (e) {
    errorGoogle(e, email)
  }
}

const RE_PLANEACION = /planea|planning|lesson\s*plan|weekly\s*plan|plan\s*semanal|planificaci/i

type Material = classroom_v1.Schema$Material

function adjuntos(materiales: Material[] | undefined): { titulo: string; enlace: string }[] {
  const out: { titulo: string; enlace: string }[] = []
  for (const m of materiales ?? []) {
    const d = m.driveFile?.driveFile
    if (d?.alternateLink) out.push({ titulo: d.title || 'Archivo de Drive', enlace: d.alternateLink })
    else if (m.link?.url) out.push({ titulo: m.link.title || m.link.url, enlace: m.link.url })
    else if (m.form?.formUrl) out.push({ titulo: m.form.title || 'Formulario', enlace: m.form.formUrl })
    else if (m.youtubeVideo?.alternateLink) out.push({ titulo: m.youtubeVideo.title || 'Video', enlace: m.youtubeVideo.alternateLink })
  }
  return out
}

/**
 * Solo lectura: lo que la teacher publicó (o dejó en borrador) en sus clases entre `desde` y `hasta` (ISO).
 * Marca como planeación lo que lo menciona en título, descripción, tema o nombre de archivo.
 */
export async function publicacionesClassroomTeacher(rawEmail: unknown, desde: string, hasta: string): Promise<TeClassroomPlanItem[]> {
  const email = normalizarCorreoTeacher(rawEmail)
  const cr = clienteClassroom(email)
  try {
    const [yo, cursos] = await Promise.all([
      cr.userProfiles.get({ userId: 'me' }),
      cr.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 50 }),
    ])
    const miId = yo.data.id
    const enRango = (f: string | null | undefined) => !!f && f >= desde && f < hasta
    const porCurso = await Promise.all(
      (cursos.data.courses ?? []).map(async (c) => {
        const courseId = c.id!
        const curso = [c.name, c.section].filter(Boolean).join(' · ') || '(sin nombre)'
        const [temas, tareas, materiales, avisos] = await Promise.all([
          /** Requiere classroom.topics.readonly en la delegación; sin ese alcance solo se omite el tema. */
          cr.courses.topics.list({ courseId, pageSize: 100 }).catch(() => ({ data: { topic: [] as classroom_v1.Schema$Topic[] } })),
          cr.courses.courseWork.list({ courseId, pageSize: 40, orderBy: 'updateTime desc', courseWorkStates: ['PUBLISHED', 'DRAFT'] }),
          cr.courses.courseWorkMaterials.list({ courseId, pageSize: 40, orderBy: 'updateTime desc', courseWorkMaterialStates: ['PUBLISHED', 'DRAFT'] }),
          cr.courses.announcements.list({ courseId, pageSize: 40, orderBy: 'updateTime desc', announcementStates: ['PUBLISHED', 'DRAFT'] }),
        ])
        const tema = new Map((temas.data.topic ?? []).map((t) => [t.topicId, t.name ?? null]))
        const crudos: {
          id?: string | null
          tipo: TeClassroomPlanItem['tipo']
          titulo?: string | null
          texto?: string | null
          topicId?: string | null
          creationTime?: string | null
          updateTime?: string | null
          state?: string | null
          alternateLink?: string | null
          creatorUserId?: string | null
          materials?: Material[]
        }[] = [
          ...(tareas.data.courseWork ?? []).map((t) => ({ ...t, tipo: 'tarea' as const, titulo: t.title, texto: t.description })),
          ...(materiales.data.courseWorkMaterial ?? []).map((m) => ({ ...m, tipo: 'material' as const, titulo: m.title, texto: m.description })),
          ...(avisos.data.announcements ?? []).map((a) => ({ ...a, tipo: 'aviso' as const, titulo: null, texto: a.text })),
        ]
        return crudos
          .filter((x) => (!miId || !x.creatorUserId || x.creatorUserId === miId) && (enRango(x.creationTime) || enRango(x.updateTime)))
          .map((x): TeClassroomPlanItem => {
            const arch = adjuntos(x.materials)
            const nombreTema = (x.topicId && tema.get(x.topicId)) || null
            const texto = String(x.texto ?? '').replace(/\s+/g, ' ').trim()
            const titulo = x.titulo?.trim() || (texto.length > 120 ? `${texto.slice(0, 120)}…` : texto) || '(sin título)'
            return {
              id: x.id ?? '',
              curso,
              tipo: x.tipo,
              titulo,
              tema: nombreTema,
              fecha: x.creationTime ?? x.updateTime ?? null,
              borrador: x.state === 'DRAFT',
              enlace: x.alternateLink ?? null,
              adjuntos: arch,
              es_planeacion: RE_PLANEACION.test([titulo, texto, nombreTema, ...arch.map((a) => a.titulo)].join(' ')),
            }
          })
      }),
    )
    return porCurso
      .flat()
      .sort((a, b) => Number(b.es_planeacion) - Number(a.es_planeacion) || (b.fecha ?? '').localeCompare(a.fecha ?? ''))
  } catch (e) {
    errorGoogle(e, email)
  }
}

/** Solo agrega o quita estas cuentas; nunca toca a la teacher dueña ni a otros maestros. */
async function sincronizarCurso(
  admin: classroom_v1.Classroom,
  teacher: classroom_v1.Classroom,
  courseId: string,
  r: TeCoMaestrasSync,
): Promise<void> {
  const maestros = await teacher.courses.teachers.list({ courseId, pageSize: 50 })
  const correos = new Set((maestros.data.teachers ?? []).map((m) => m.profile?.emailAddress?.toLowerCase()).filter(Boolean))
  for (const email of CO_MAESTRAS) {
    if (correos.has(email)) continue
    try {
      await admin.courses.teachers.create({ courseId, requestBody: { userId: email } })
      r.agregadas++
    } catch (e) {
      if ((e as { code?: number }).code !== 409) throw e
    }
  }
  for (const email of CO_MAESTRAS_RETIRAR) {
    if (!correos.has(email)) continue
    await admin.courses.teachers.delete({ courseId, userId: email })
    r.quitadas++
  }
}

/** Deja a las cuentas de CO_MAESTRAS como co-maestras en las clases activas de una teacher. */
export async function sincronizarCoMaestras(rawEmail: string): Promise<TeCoMaestrasSync> {
  const r: TeCoMaestrasSync = { clases: 0, agregadas: 0, quitadas: 0, errores: [] }
  const email = normalizarCorreoTeacher(rawEmail)
  try {
    const admin = clienteClassroom(ADMIN_WORKSPACE, SCOPES_ADMIN)
    const cr = clienteClassroom(email)
    const cursos = await cr.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 50 })
    const ids = (cursos.data.courses ?? []).map((c) => c.id).filter((id): id is string => !!id)
    r.clases = ids.length
    const resultados = await Promise.allSettled(ids.map((id) => sincronizarCurso(admin, cr, id, r)))
    for (const x of resultados) {
      if (x.status === 'rejected') r.errores.push((x.reason as { message?: string })?.message ?? 'error')
    }
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    r.errores.push(
      err.response?.data?.error === 'unauthorized_client' ? 'Google aún no autoriza el permiso classroom.rosters.' : `${email}: ${err.message ?? 'error'}`,
    )
  }
  return r
}

/* ── Publicar la planeación aprobada en Classroom ── */

/** Además de los de lectura, requiere classroom.topics y classroom.courseworkmaterials en la delegación. */
const SCOPES_PUBLICAR = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.topics',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
]

/** Hora a la que Classroom publica cada día: 7:00 en Monterrey (UTC-6, sin horario de verano). */
const HORA_PUBLICAR_UTC = '13:00:00Z'

const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const CLASE_DE_SKILL: Partial<Record<SkillClave, RegExp>> = {
  grammar: /GRAMMAR/,
  reading: /READING/,
  writing: /WRITING/,
  listening: /LISTENING/,
  speaking: /SPEAKING/,
  vocabulary: /VOCAB|SPELLING|PHONIC/,
  math: /MATH/,
}

export type GclassPrevia = { course_id: string; item_id: string; fecha: string }
export type GclassCreada = { course_id: string; item_id: string; fecha: string; topic_id: string | null; titulo: string; programado_at: string | null }
export type ResultadoGclass = {
  clases: number
  programadas: number
  inmediatas: number
  publicadas_ya: number
  retiradas: number
  omitidas: string[]
  errores: string[]
  creadas: GclassCreada[]
  /** Previas que siguen existiendo en Classroom (publicadas) y deben conservarse en la bitácora. */
  conservadas: GclassPrevia[]
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/** Como nombran el tema del día: «Tuesday October 13th 2026». */
export function nombreTemaDia(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const dia = DIAS_PLAN.find((x) => sumarDias(lunesDe(fecha), x.offset) === fecha)
  return `${dia?.en ?? ''} ${MESES_EN[m - 1]} ${ordinal(d)} ${y}`.trim()
}

function esTemaDelDia(nombre: string | null | undefined, fecha: string): boolean {
  const [y, m, d] = fecha.split('-').map(Number)
  const t = String(nombre ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')
  if (!new RegExp(`\\b${MESES_EN[m - 1].toLowerCase()} ${d}(st|nd|rd|th)?\\b`).test(t)) return false
  const anio = /\b(20\d\d)\b/.exec(t)
  return !anio || Number(anio[1]) === y
}

function normalizarNombre(c: classroom_v1.Schema$Course): string {
  return `${c.name ?? ''} ${c.section ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

/** Clase del grupo (ej. «5A») para la materia; si el grupo tiene una sola clase, esa. */
function buscarClase(cursos: classroom_v1.Schema$Course[], grupo: string, skill: SkillClave): classroom_v1.Schema$Course | null {
  const m = /^(\d)\s*([A-Z])$/i.exec(grupo.trim())
  if (!m) return null
  const reGrupo = new RegExp(`(^|[^0-9])${m[1]}\\s*[°ºO]?\\s*-?\\s*${m[2].toUpperCase()}(?![A-Z])`)
  const delGrupo = cursos.filter((c) => reGrupo.test(normalizarNombre(c)))
  const re = CLASE_DE_SKILL[skill]
  const propia = re ? delGrupo.find((c) => re.test(normalizarNombre(c))) : undefined
  if (propia) return propia
  const sinMateria = delGrupo.filter((c) => !Object.values(CLASE_DE_SKILL).some((r) => r!.test(normalizarNombre(c))))
  return delGrupo.length === 1 ? delGrupo[0] : sinMateria.length === 1 ? sinMateria[0] : null
}

function enlaces(...textos: string[]): classroom_v1.Schema$Material[] {
  const urls = new Set<string>()
  for (const t of textos) {
    for (const u of t.match(/https?:\/\/[^\s<>"')\]]+/g) ?? []) {
      try {
        urls.add(new URL(u.replace(/[.,;:]+$/, '')).toString())
      } catch {
        /* enlace mal escrito: se queda solo en el texto */
      }
    }
  }
  return [...urls].slice(0, 20).map((url) => ({ link: { url } }))
}

/** Lo que publican por materia dentro del tema del día, en el orden en que se ven. */
function publicacionesBloque(b: PlanBloque, repetida: boolean): { title: string; description: string; materials?: classroom_v1.Schema$Material[] }[] {
  const s = skillDe(b.skill)
  const sufijo = repetida && b.tema ? ` · ${b.tema.slice(0, 60)}` : ''
  const encabezado = `${s.emoji} ${s.etiqueta}${b.tema ? ` · ${b.tema}` : ''}`
  const out: { title: string; description: string; materials?: classroom_v1.Schema$Material[] }[] = []
  if (b.materiales.length) {
    out.push({ title: `Class Materials${sufijo}`, description: b.materiales.map((k) => { const x = materialDe(k); return x ? `${x.emoji} ${x.etiqueta}` : k }).join('\n') })
  }
  if (b.tema || b.actividades || b.recursos) {
    const links = enlaces(b.actividades, b.recursos)
    out.push({
      title: `CLASSWORK${sufijo}`,
      description: [encabezado, b.actividades, b.recursos ? `🔗 ${b.recursos}` : ''].filter(Boolean).join('\n\n'),
      ...(links.length ? { materials: links } : {}),
    })
  }
  if (b.participacion) out.push({ title: `PARTICIPATION${sufijo}`, description: `${encabezado}\n\n${b.participacion}` })
  if (b.tarea) out.push({ title: `HOMEWORK${sufijo}`, description: `${encabezado}\n\n${b.tarea}` })
  return out
}

async function enParalelo<T>(tareas: (() => Promise<T>)[], limite: number): Promise<void> {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limite, tareas.length) }, async () => {
      while (i < tareas.length) await tareas[i++]()
    }),
  )
}

function errorPublicar(e: unknown): never {
  const err = e as { response?: { data?: { error?: string } } }
  if (err.response?.data?.error === 'unauthorized_client') {
    throw new TeError(
      'Google aún no autoriza publicar en Classroom. Falta agregar classroom.topics y classroom.courseworkmaterials a la delegación de dominio del service account (admin.google.com).',
      502,
    )
  }
  throw e
}

/** Retira lo programado (borradores) de envíos anteriores; lo ya publicado se conserva. */
async function retirarPrevias(cr: classroom_v1.Classroom, previas: GclassPrevia[], r: ResultadoGclass): Promise<Set<string>> {
  const visibles = new Set<string>()
  await enParalelo(
    previas.map((p) => async () => {
      try {
        const m = await cr.courses.courseWorkMaterials.get({ courseId: p.course_id, id: p.item_id })
        if (m.data.state === 'PUBLISHED') {
          visibles.add(`${p.course_id}|${p.fecha}`)
          r.publicadas_ya++
          r.conservadas.push(p)
          return
        }
        await cr.courses.courseWorkMaterials.delete({ courseId: p.course_id, id: p.item_id })
        r.retiradas++
      } catch (e) {
        if ((e as { code?: number }).code === 404) return
        if ((e as { response?: { data?: { error?: string } } }).response?.data?.error === 'unauthorized_client') errorPublicar(e)
        r.errores.push(`No se pudo retirar una publicación anterior: ${(e as Error).message ?? 'error'}`)
        r.conservadas.push(p)
      }
    }),
    4,
  )
  return visibles
}

function resultadoVacio(): ResultadoGclass {
  return { clases: 0, programadas: 0, inmediatas: 0, publicadas_ya: 0, retiradas: 0, omitidas: [], errores: [], creadas: [], conservadas: [] }
}

export async function retirarPlanClassroom(rawEmail: unknown, previas: GclassPrevia[]): Promise<ResultadoGclass> {
  const email = normalizarCorreoTeacher(rawEmail)
  const r = resultadoVacio()
  await retirarPrevias(clienteClassroom(email, SCOPES_PUBLICAR), previas, r)
  return r
}

/**
 * Crea, en la clase de cada materia y grupo, el tema del día con Class Materials / CLASSWORK / PARTICIPATION / HOMEWORK,
 * en borrador programado a las 7:00 de ese día. Días pasados se omiten; si la teacher ya publicó algo en ese tema, no se duplica.
 */
export async function publicarPlanClassroom(
  rawEmail: unknown,
  opts: { lunes: string; grupos: string[]; contenido: PlanContenido; previas: GclassPrevia[] },
): Promise<ResultadoGclass> {
  const email = normalizarCorreoTeacher(rawEmail)
  const cr = clienteClassroom(email, SCOPES_PUBLICAR)
  const r = resultadoVacio()
  const omitir = (txt: string) => {
    if (!r.omitidas.includes(txt)) r.omitidas.push(txt)
  }
  if (!opts.grupos.length) throw new TeError('La teacher no tiene grupos asignados para ese grado.')

  let cursos: classroom_v1.Schema$Course[]
  let visibles: Set<string>
  try {
    visibles = await retirarPrevias(cr, opts.previas, r)
    cursos = (await cr.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 100 })).data.courses ?? []
  } catch (e) {
    if (e instanceof TeError) throw e
    errorPublicar(e)
  }

  const ahora = new Date().toISOString()
  const hoy = hoyMx()
  const tareas = new Map<string, { curso: classroom_v1.Schema$Course; fecha: string; dia: string; bloques: PlanBloque[] }>()
  for (const d of DIAS_PLAN) {
    const bloques = opts.contenido.dias[d.clave]
    if (!bloques.length) continue
    const fecha = sumarDias(opts.lunes, d.offset)
    if (fecha < hoy) {
      omitir(`${d.es} ${fecha.slice(8)}: ese día ya pasó.`)
      continue
    }
    for (const b of bloques) {
      for (const g of opts.grupos) {
        const curso = buscarClase(cursos, g, b.skill)
        if (!curso?.id) {
          omitir(`${d.es} · ${g} ${skillDe(b.skill).etiqueta}: no encontré esa clase en su Classroom.`)
          continue
        }
        const clave = `${curso.id}|${fecha}`
        const t = tareas.get(clave) ?? { curso, fecha, dia: d.es, bloques: [] }
        t.bloques.push(b)
        tareas.set(clave, t)
      }
    }
  }

  const temasDe = new Map<string, Promise<classroom_v1.Schema$Topic[]>>()
  const itemsDe = new Map<string, Promise<{ topicId?: string | null; id?: string | null }[]>>()
  const previasIds = new Set(opts.previas.map((p) => p.item_id))
  const temas = (courseId: string) => {
    if (!temasDe.has(courseId)) temasDe.set(courseId, cr.courses.topics.list({ courseId, pageSize: 200 }).then((x) => x.data.topic ?? []))
    return temasDe.get(courseId)!
  }
  const items = (courseId: string) => {
    if (!itemsDe.has(courseId)) {
      itemsDe.set(
        courseId,
        Promise.all([
          cr.courses.courseWorkMaterials.list({ courseId, pageSize: 200, courseWorkMaterialStates: ['PUBLISHED', 'DRAFT'] }).then((x) => x.data.courseWorkMaterial ?? []),
          cr.courses.courseWork.list({ courseId, pageSize: 200, courseWorkStates: ['PUBLISHED', 'DRAFT'] }).then((x) => x.data.courseWork ?? []),
        ]).then(([a, b]) => [...a, ...b]),
      )
    }
    return itemsDe.get(courseId)!
  }
  const clases = new Set<string>()

  await enParalelo(
    [...tareas.entries()].map(([clave, t]) => async () => {
      const courseId = t.curso.id!
      const nombreClase = t.curso.name ?? courseId
      if (visibles.has(clave)) {
        omitir(`${t.dia} · ${nombreClase}: ya estaba publicada de un envío anterior (no se duplicó).`)
        return
      }
      try {
        const lista = await temas(courseId)
        let tema = lista.find((x) => esTemaDelDia(x.name, t.fecha))
        if (tema?.topicId) {
          const ajenas = (await items(courseId)).filter((x) => x.topicId === tema!.topicId && !previasIds.has(x.id ?? ''))
          if (ajenas.length) {
            omitir(`${t.dia} · ${nombreClase}: la teacher ya publicó en «${tema.name}» (no se duplicó).`)
            return
          }
        } else {
          tema = (await cr.courses.topics.create({ courseId, requestBody: { name: nombreTemaDia(t.fecha) } })).data
          lista.push(tema)
        }
        const programar = `${t.fecha}T${HORA_PUBLICAR_UTC}`
        const yaHora = programar <= ahora
        const skillsDelDia = t.bloques.map((b) => b.skill)
        const posts = t.bloques.flatMap((b) => publicacionesBloque(b, skillsDelDia.filter((s) => s === b.skill).length > 1))
        // Classroom muestra arriba lo más reciente: se crean al revés para que «Class Materials» quede primero.
        for (const p of [...posts].reverse()) {
          const creada = await cr.courses.courseWorkMaterials.create({
            courseId,
            requestBody: {
              ...p,
              topicId: tema!.topicId,
              state: yaHora ? 'PUBLISHED' : 'DRAFT',
              ...(yaHora ? {} : { scheduledTime: programar }),
            },
          })
          r.creadas.push({ course_id: courseId, item_id: creada.data.id!, fecha: t.fecha, topic_id: tema!.topicId ?? null, titulo: p.title, programado_at: yaHora ? null : programar })
          if (yaHora) r.inmediatas++
          else r.programadas++
        }
        clases.add(courseId)
      } catch (e) {
        if ((e as { response?: { data?: { error?: string } } }).response?.data?.error === 'unauthorized_client') errorPublicar(e)
        r.errores.push(`${t.dia} · ${nombreClase}: ${(e as Error).message ?? 'error'}`)
      }
    }),
    3,
  )
  r.clases = clases.size
  return r
}

export type DiagnosticoGclass = {
  ok: boolean
  error: string | null
  clases: string[]
  temas_ejemplo: string[]
  mapa: { grupo: string; skill: SkillClave; clase: string | null }[]
}

/** Solo lectura: confirma que la delegación ya permite publicar y qué clase tocaría a cada grupo y materia. */
export async function diagnosticoPublicar(rawEmail: unknown, grupos: string[]): Promise<DiagnosticoGclass> {
  const out: DiagnosticoGclass = { ok: false, error: null, clases: [], temas_ejemplo: [], mapa: [] }
  try {
    const email = normalizarCorreoTeacher(rawEmail)
    const cr = clienteClassroom(email, SCOPES_PUBLICAR)
    const cursos = (await cr.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 100 })).data.courses ?? []
    out.clases = cursos.map((c) => [c.name, c.section].filter(Boolean).join(' · ')).sort()
    const conTemas = cursos.find((c) => c.id)
    if (conTemas?.id) {
      const temas = (await cr.courses.topics.list({ courseId: conTemas.id, pageSize: 20 })).data.topic ?? []
      out.temas_ejemplo = temas.slice(0, 5).map((t) => `${conTemas.name}: ${t.name}`)
    }
    for (const g of grupos) {
      for (const s of Object.keys(CLASE_DE_SKILL) as SkillClave[]) {
        out.mapa.push({ grupo: g, skill: s, clase: buscarClase(cursos, g, s)?.name ?? null })
      }
    }
    out.ok = true
  } catch (e) {
    const err = e as { response?: { data?: { error?: string } }; message?: string }
    out.error =
      err.response?.data?.error === 'unauthorized_client'
        ? 'Google aún no autoriza classroom.topics / classroom.courseworkmaterials (puede tardar unos minutos).'
        : (err.message ?? 'error')
  }
  return out
}
