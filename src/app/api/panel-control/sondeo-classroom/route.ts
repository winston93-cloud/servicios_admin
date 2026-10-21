import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { requireEmpleadoPortal } from '@/lib/portalApiEmpleadoAuth'
import { PANEL_CONTROL_USUARIOS } from '@/lib/panelControl/tipos'
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { equipo } from '@/lib/teamEnglish/teService'

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

const forma = (local: string) =>
  /^\d+$/.test(local) ? 'solo-numeros' : /^[a-z]+\.[a-z]+\d*$/.test(local) ? 'nombre.apellido' : /^[a-z]+\d+$/.test(local) ? 'letras+numeros' : 'otro'

type Gradebook = { calculationType?: string; displaySetting?: string; gradeCategories?: { name?: string; weight?: number; defaultGradeDenominator?: number }[] }

/** Sondeo temporal de solo lectura: estructura de Classroom de las teachers activas de Primaria. Sin datos de alumnos. */
export async function GET(request: Request) {
  const auth = requireEmpleadoPortal(request)
  if (!auth.ok) return auth.response
  if (!PANEL_CONTROL_USUARIOS.includes(Number(auth.session.usuario_id) || 0)) {
    return NextResponse.json({ error: 'Sin permiso.' }, { status: 403 })
  }
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!sa || !key) return NextResponse.json({ error: 'Falta la cuenta de servicio.' }, { status: 500 })

  const [teachers, alumnosRes] = await Promise.all([
    equipo(3, false),
    createDbAdmin().from('alumno').select('alumno_ref, alumno_nombre, alumno_app, alumno_apm').eq('alumno_nivel', 3).in('alumno_status', [1, 4, 5]),
  ])
  const alumnos = (alumnosRes.data ?? []) as Record<string, unknown>[]
  const refs = new Set(alumnos.map((a) => String(a.alumno_ref ?? '')))
  const nombres = new Set(alumnos.map((a) => norm(`${a.alumno_nombre} ${a.alumno_app} ${a.alumno_apm}`)))
  const apellidos = new Set(alumnos.map((a) => norm(`${a.alumno_app} ${a.alumno_apm}`)))

  const salida: unknown[] = []
  await Promise.all(
    teachers
      .filter((t) => t.email)
      .map(async (t) => {
        const fila: Record<string, unknown> = { grupos: t.grupos.join(','), maestro_id: t.maestro_id }
        salida.push(fila)
        const cr = google.classroom({ version: 'v1', auth: new google.auth.JWT({ email: sa, key, scopes: SCOPES, subject: t.email! }) })
        try {
          const cursos = (await cr.courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageSize: 50 })).data.courses ?? []
          fila.clases = await Promise.all(
            cursos.map(async (c) => {
              const d: Record<string, unknown> = { nombre: c.name, seccion: c.section ?? null }
              try {
                const gs = ((await cr.courses.get({ id: c.id! })).data as { gradebookSettings?: Gradebook }).gradebookSettings
                d.calificacion = {
                  calculo: gs?.calculationType ?? null,
                  muestra: gs?.displaySetting ?? null,
                  categorias: (gs?.gradeCategories ?? []).map((g) => ({ nombre: g.name, peso: g.weight != null ? g.weight / 10000 : null, puntos: g.defaultGradeDenominator ?? null })),
                }
              } catch (e) {
                d.calificacion = `error ${(e as Error).message.slice(0, 120)}`
              }
              try {
                const api = cr.courses as unknown as { getGradingPeriodSettings: (p: object) => Promise<{ data: { gradingPeriods?: { id?: string; title?: string; startDate?: object; endDate?: object }[] } }> }
                d.periodos = ((await api.getGradingPeriodSettings({ courseId: c.id })).data.gradingPeriods ?? []).map((p) => ({ titulo: p.title, inicio: p.startDate, fin: p.endDate }))
              } catch (e) {
                d.periodos = `error ${(e as Error).message.slice(0, 120)}`
              }
              const cw = (await cr.courses.courseWork.list({ courseId: c.id!, pageSize: 300 })).data.courseWork ?? []
              const porCat: Record<string, number> = {}
              for (const w of cw) {
                const cat = (w as { gradeCategory?: { name?: string } }).gradeCategory?.name ?? '(sin categoría)'
                porCat[cat] = (porCat[cat] ?? 0) + 1
              }
              d.tareas = {
                total: cw.length,
                calificables: cw.filter((w) => w.maxPoints != null).length,
                con_periodo: cw.filter((w) => (w as { gradingPeriodId?: unknown }).gradingPeriodId).length,
                por_categoria: porCat,
                puntos: [...new Set(cw.map((w) => w.maxPoints ?? 'sin'))].slice(0, 10),
                titulos: cw.slice(0, 12).map((w) => w.title),
              }
              const subs = (await cr.courses.courseWork.studentSubmissions.list({ courseId: c.id!, courseWorkId: '-', pageSize: 1000 })).data.studentSubmissions ?? []
              d.entregas = { total: subs.length, con_calificacion: subs.filter((s) => s.assignedGrade != null).length, con_borrador: subs.filter((s) => s.draftGrade != null).length }
              const st = (await cr.courses.students.list({ courseId: c.id!, pageSize: 100 })).data.students ?? []
              const correos = st.map((s) => s.profile?.emailAddress ?? '').filter(Boolean)
              const formas: Record<string, number> = {}
              for (const e of correos) {
                const f = forma(e.split('@')[0].toLowerCase())
                formas[f] = (formas[f] ?? 0) + 1
              }
              const nom = st.map((s) => norm(s.profile?.name?.fullName))
              d.alumnos = {
                total: st.length,
                con_correo: correos.length,
                dominios: [...new Set(correos.map((e) => e.split('@')[1]))],
                forma_correo: formas,
                digitos_correo_igual_matricula: correos.filter((e) => refs.has(e.split('@')[0].replace(/\D/g, ''))).length,
                nombre_completo_igual: nom.filter((n) => nombres.has(n)).length,
                apellidos_al_final_igual: nom.filter((n) => [...apellidos].some((a) => a && n.endsWith(a))).length,
              }
              return d
            }),
          )
        } catch (e) {
          fila.error = (e as Error).message.slice(0, 160)
        }
      }),
  )
  return NextResponse.json({ teachers_activas: teachers.length, alumnos_primaria: alumnos.length, salida }, { headers: { 'Cache-Control': 'no-store' } })
}
