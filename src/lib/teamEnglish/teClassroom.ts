import { google, type classroom_v1 } from 'googleapis'
import { TeError } from './teService'
import type {
  TeClassroomCurso,
  TeClassroomDetalle,
  TeClassroomPublicacion,
  TeClassroomResumen,
  TeClassroomTarea,
  TeCoMaestrasSync,
} from './teTypes'

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
