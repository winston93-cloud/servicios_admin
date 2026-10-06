import { google, type classroom_v1 } from 'googleapis'
import { TeError } from './teService'
import type {
  TeClassroomCurso,
  TeClassroomDetalle,
  TeClassroomPublicacion,
  TeClassroomResumen,
  TeClassroomTarea,
  TeCoMaestrasCurso,
  TeCoMaestrasPlan,
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

/** Únicas cuentas que se pueden agregar o quitar como co-maestras. */
export const CO_MAESTRAS_PERMITIDAS = [
  { email: 'coordinacioninglesprimaria@winston93.edu.mx', etiqueta: 'Coordinación Inglés Primaria' },
  { email: 'sistemas.desarrollo@winston93.edu.mx', etiqueta: 'Sistemas (pruebas)' },
] as const

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

function coMaestraPermitida(raw: unknown): string {
  const email = String(raw ?? '').trim().toLowerCase()
  if (!CO_MAESTRAS_PERMITIDAS.some((c) => c.email === email)) throw new TeError('Esa cuenta no se puede agregar como co-maestra.')
  return email
}

/** Clases activas de las teachers y si cada cuenta permitida ya es maestra en ellas. Solo lectura. */
export async function planCoMaestras(teachers: { nombre: string; email: string | null }[]): Promise<TeCoMaestrasPlan> {
  const cursos = new Map<string, TeCoMaestrasCurso>()
  const errores: string[] = []
  for (const t of teachers) {
    if (!t.email) continue
    try {
      const cr = clienteClassroom(normalizarCorreoTeacher(t.email))
      const r = await cr.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 50 })
      for (const c of r.data.courses ?? []) {
        if (!c.id || cursos.has(c.id)) continue
        const maestros = await cr.courses.teachers.list({ courseId: c.id, pageSize: 50 })
        const correos = new Set((maestros.data.teachers ?? []).map((m) => m.profile?.emailAddress?.toLowerCase()).filter(Boolean))
        cursos.set(c.id, {
          id: c.id,
          nombre: c.name ?? '(sin nombre)',
          seccion: c.section ?? null,
          teacher: t.nombre,
          ya: CO_MAESTRAS_PERMITIDAS.filter((p) => correos.has(p.email)).map((p) => p.email),
        })
      }
    } catch (e) {
      try {
        errorGoogle(e, t.email)
      } catch (te) {
        errores.push(`${t.nombre}: ${te instanceof Error ? te.message : 'error'}`)
      }
    }
  }
  return {
    cuentas: CO_MAESTRAS_PERMITIDAS.map((c) => ({ ...c })),
    cursos: [...cursos.values()].sort((a, b) => a.teacher.localeCompare(b.teacher, 'es') || a.nombre.localeCompare(b.nombre, 'es')),
    errores,
  }
}

/** Escritura: agrega o quita una cuenta permitida como co-maestra en las clases indicadas. */
export async function aplicarCoMaestra(rawEmail: unknown, cursoIds: string[], quitar: boolean): Promise<{ ok: number; errores: string[] }> {
  const email = coMaestraPermitida(rawEmail)
  const ids = [...new Set(cursoIds.map(String).filter((id) => /^[0-9]{1,30}$/.test(id)))].slice(0, 200)
  if (!ids.length) throw new TeError('No hay clases seleccionadas.')
  const cr = clienteClassroom(ADMIN_WORKSPACE, SCOPES_ADMIN)
  let ok = 0
  const errores: string[] = []
  for (const courseId of ids) {
    try {
      if (quitar) await cr.courses.teachers.delete({ courseId, userId: email })
      else await cr.courses.teachers.create({ courseId, requestBody: { userId: email } })
      ok++
    } catch (e) {
      const err = e as { code?: number; message?: string; response?: { data?: { error?: string } } }
      if (err.response?.data?.error === 'unauthorized_client') {
        throw new TeError('Google aún no autoriza el permiso de escritura (classroom.rosters).', 502)
      }
      if (!quitar && err.code === 409) {
        ok++
        continue
      }
      if (quitar && err.code === 404) {
        ok++
        continue
      }
      errores.push(`${courseId}: ${err.message ?? 'error'}`)
    }
  }
  return { ok, errores }
}
