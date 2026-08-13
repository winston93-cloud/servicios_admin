import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { listarAsignacionesMaestro } from '@/lib/boletasCapturaService'
import { listarAsignacionesGrupos, listarMaterias } from '@/lib/boletasAdminService'

export async function GET(req: Request) {
  try {
    const session = await requireBoletasSession(req)
    if (session.role === 'maestro') {
      return jsonOk({ asignaciones: await listarAsignacionesMaestro(session.id) })
    }
    // Admin: todas las asignaciones secundaria enriquecidas
    const [grupos, materias] = await Promise.all([listarAsignacionesGrupos(), listarMaterias()])
    const matMap = new Map(materias.map((m) => [Number(m.materia_id), m]))
    const asignaciones = grupos
      .map((g) => {
        const m = matMap.get(Number(g.materia_id))
        if (!m) return null
        return {
          grupo_id: Number(g.grupo_id),
          materia_id: Number(g.materia_id),
          materia_nombre: String(m.materia_nombre),
          materia_grado: Number(m.materia_grado),
          grupo_letra: String(g.grupo_letra ?? ''),
          maestro_id: Number(g.maestro_id),
        }
      })
      .filter(Boolean)
    return jsonOk({ asignaciones })
  } catch (e) {
    return jsonError(e)
  }
}
