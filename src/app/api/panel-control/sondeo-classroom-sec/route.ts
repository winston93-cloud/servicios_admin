import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { PANEL_CONTROL_USUARIOS } from '@/lib/panelControl/tipos'
import { createDbAdmin } from '@/lib/insforgeAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
]

const norm = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

type Row = Record<string, unknown>
type Gradebook = { calculationType?: string; gradeCategories?: { name?: string; weight?: number }[] }

/** Sondeo temporal de solo lectura: Classroom de los maestros de secundaria del catálogo. Sin datos de alumnos. */
export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  if (!PANEL_CONTROL_USUARIOS.includes(Number(auth.session.usuario_id) || 0)) {
    return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 })
  }
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!sa || !key) return NextResponse.json({ error: 'Falta la cuenta de servicio.' }, { status: 500 })

  const db = createDbAdmin()
  const [maestrosRes, asigRes, materiasRes, alumnosRes] = await Promise.all([
    db.from('boleta_maestro').select('maestro_id, maestro_nombre, maestro_app, maestro_email').eq('maestro_nivel', 4),
    db.from('boleta_maestro_grupo').select('maestro_id, materia_id, grupo_letra'),
    db.from('boleta_materia').select('materia_id, materia_nombre, materia_grado').eq('materia_nivel', 4),
    db.from('alumno').select('alumno_nombre, alumno_app, alumno_apm').eq('alumno_nivel', 4).in('alumno_status', [1, 4, 5]),
  ])
  const materias = new Map(((materiasRes.data ?? []) as Row[]).map((m) => [Number(m.materia_id), m]))
  const asig = ((asigRes.data ?? []) as Row[]).filter((a) => materias.has(Number(a.materia_id)))
  const alumnos = (alumnosRes.data ?? []) as Row[]
  const nombres = new Set(alumnos.map((a) => norm(`${a.alumno_nombre} ${a.alumno_app} ${a.alumno_apm}`)))
  const apellidos = alumnos.map((a) => norm(`${a.alumno_app} ${a.alumno_apm}`)).filter(Boolean)

  const salida: Row[] = []
  await Promise.all(
    ((maestrosRes.data ?? []) as Row[]).map(async (m) => {
      const id = Number(m.maestro_id)
      const fila: Row = {
        maestro_id: id,
        maestro: `${m.maestro_nombre ?? ''} ${m.maestro_app ?? ''}`.trim(),
        tiene_correo: Boolean(m.maestro_email),
        asignaciones: asig
          .filter((a) => Number(a.maestro_id) === id)
          .map((a) => {
            const mat = materias.get(Number(a.materia_id))!
            return `${mat.materia_grado}°${a.grupo_letra} ${mat.materia_nombre}`
          }),
      }
      salida.push(fila)
      if (!m.maestro_email) return
      const cr = google.classroom({
        version: 'v1',
        auth: new google.auth.JWT({ email: sa, key, scopes: SCOPES, subject: String(m.maestro_email) }),
      })
      try {
        const cursos = (await cr.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 60 })).data.courses ?? []
        fila.google = 'ok'
        fila.clases = await Promise.all(
          cursos.map(async (c) => {
            const d: Row = { nombre: c.name, seccion: c.section ?? null, creada: c.creationTime?.slice(0, 10) }
            try {
              const gs = ((await cr.courses.get({ id: c.id! })).data as { gradebookSettings?: Gradebook }).gradebookSettings
              d.calculo = gs?.calculationType ?? null
              d.categorias = (gs?.gradeCategories ?? []).map((g) => `${g.name}${g.weight != null ? ` ${g.weight / 10000}%` : ''}`)
            } catch (e) {
              d.calculo = `error ${(e as Error).message.slice(0, 80)}`
            }
            try {
              const api = cr.courses as unknown as {
                getGradingPeriodSettings: (p: object) => Promise<{ data: { gradingPeriods?: { title?: string }[] } }>
              }
              d.periodos = ((await api.getGradingPeriodSettings({ courseId: c.id })).data.gradingPeriods ?? []).map((p) => p.title)
            } catch {
              d.periodos = null
            }
            try {
              const cw = (await cr.courses.courseWork.list({ courseId: c.id!, pageSize: 300 })).data.courseWork ?? []
              d.tareas = cw.length
              d.tareas_sin_categoria = cw.filter((w) => !(w as { gradeCategory?: unknown }).gradeCategory).length
              d.tareas_con_periodo = cw.filter((w) => (w as { gradingPeriodId?: unknown }).gradingPeriodId).length
              d.ultima_tarea = cw.map((w) => w.creationTime ?? '').sort().pop()?.slice(0, 10) ?? null
              const subs =
                (await cr.courses.courseWork.studentSubmissions.list({ courseId: c.id!, courseWorkId: '-', pageSize: 1000 })).data
                  .studentSubmissions ?? []
              d.calificadas = subs.filter((s) => s.assignedGrade != null).length
              const st = (await cr.courses.students.list({ courseId: c.id!, pageSize: 100 })).data.students ?? []
              const nom = st.map((s) => norm(s.profile?.name?.fullName))
              d.alumnos = st.length
              d.empatan_nombre = nom.filter((n) => nombres.has(n)).length
              d.empatan_apellidos = nom.filter((n) => apellidos.some((a) => n.endsWith(a) || n.startsWith(a))).length
            } catch (e) {
              d.error = (e as Error).message.slice(0, 80)
            }
            return d
          })
        )
      } catch (e) {
        fila.google = `error ${(e as Error).message.slice(0, 120)}`
      }
    })
  )
  salida.sort((a, b) => String(a.maestro).localeCompare(String(b.maestro)))
  return NextResponse.json(
    { maestros_catalogo: salida.length, alumnos_secundaria: alumnos.length, salida },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
