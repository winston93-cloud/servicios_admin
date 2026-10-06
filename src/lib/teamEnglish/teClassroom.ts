import { google, type classroom_v1 } from 'googleapis'
import { TeError } from './teService'
import type { TeClassroomCurso, TeClassroomResumen } from './teTypes'

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

function clienteClassroom(email: string): classroom_v1.Classroom {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!sa || !key) throw new TeError('Falta configurar la cuenta de servicio de Google.', 500)
  const auth = new google.auth.JWT({ email: sa, key, scopes: SCOPES, subject: email })
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

/** Solo lectura: clases activas donde el correo es maestro. */
export async function resumenClassroomTeacher(rawEmail: unknown): Promise<TeClassroomResumen> {
  const email = normalizarCorreoTeacher(rawEmail)
  const cr = clienteClassroom(email)
  try {
    const r = await cr.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 50 })
    const cursos = await Promise.all((r.data.courses ?? []).map((c) => resumenCurso(cr, c)))
    return { email, cursos }
  } catch (e) {
    const msg = (e as { response?: { data?: { error?: string; error_description?: string } }; message?: string })
    const codigo = msg.response?.data?.error
    if (codigo === 'unauthorized_client') {
      throw new TeError('Google aún no autoriza los permisos de Classroom para la cuenta de servicio.', 502)
    }
    if (codigo === 'invalid_grant') throw new TeError(`Google no reconoce el correo ${email}.`, 404)
    throw new TeError(`Classroom: ${msg.message ?? 'error'}`, 502)
  }
}
