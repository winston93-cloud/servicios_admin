import { jsonError, jsonOk } from '@/lib/boletasApi'
import { capturaConfigDeSlug } from '@/lib/boletasCapturaAuth'
import { assertAlumnoDelGrupo, assertEditable, contextoCaptura } from '@/lib/boletasCapturaContexto'
import { ligarAlumnoClassroom } from '@/lib/boletasPrimariaEnClassroom'
import { resumenClassroomPrimariaEs, sincronizarClassroomPrimariaEs } from '@/lib/boletasPrimariaEsClassroom'
import { rutasPortalPrimaria } from '@/lib/boletasPrimariaRutas'
import { alumnosConProgresoPrimaria } from '@/lib/boletasPrimariaService'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Params = { params: Promise<{ slug: string }> }

const rutas = rutasPortalPrimaria('es')
export const GET = rutas.GET
export const PUT = rutas.PUT

/** Trae Classroom (solo mientras el grupo se puede editar) o liga a mano un alumno; lo demás, como siempre. */
export async function POST(req: Request, p: Params) {
  const body = (await req
    .clone()
    .json()
    .catch(() => ({}))) as Record<string, unknown>
  if (body.accion !== 'classroom' && body.accion !== 'ligar') return rutas.POST(req, p)
  try {
    const raw = { grado: body.grado, grupo: body.grupo, trimestre: body.trimestre }
    const ctx = await contextoCaptura(capturaConfigDeSlug((await p.params).slug), req, raw, 'primaria-es')
    const grupo = { ciclo: ctx.ciclo, trimestre: ctx.trimestre, grado: ctx.grado, grupo: ctx.grupo }
    if (body.accion === 'ligar') {
      assertEditable(ctx)
      const alumnoId = Number(body.alumnoId ?? 0)
      if (alumnoId) await assertAlumnoDelGrupo(ctx, alumnoId)
      await ligarAlumnoClassroom(String(body.googleId ?? ''), alumnoId, ctx.sesion.nombre)
    }
    const resumen = ctx.editable
      ? await sincronizarClassroomPrimariaEs({ ...grupo, forzar: body.accion === 'ligar' || body.forzar === true })
      : await resumenClassroomPrimariaEs(grupo)
    const alumnos = await alumnosConProgresoPrimaria('es', { grado: ctx.grado, grupo: ctx.grupo, trimestre: ctx.trimestre, ciclo: ctx.ciclo })
    return jsonOk({ classroom: resumen, congelado: !ctx.editable, alumnos })
  } catch (e) {
    return jsonError(e, 400)
  }
}
