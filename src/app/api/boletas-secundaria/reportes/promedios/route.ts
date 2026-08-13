import { requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError, jsonOk } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { reportePromediosAlumnos, reportePromediosMaterias } from '@/lib/boletasReportes'

export async function GET(req: Request) {
  try {
    await requireBoletasSession(req)
    const url = new URL(req.url)
    const ciclo = Number(url.searchParams.get('ciclo') ?? cicloEscolarActualBoletas())
    const tipo = url.searchParams.get('tipo') || 'alumnos'
    const grado = Number(url.searchParams.get('grado') || 0) || undefined
    const grupo = Number(url.searchParams.get('grupo') || 0) || undefined
    const periodo = Number(url.searchParams.get('periodo') || 1)

    if (tipo === 'materias') {
      return jsonOk({
        tipo,
        ciclo,
        periodo,
        filas: await reportePromediosMaterias({ ciclo, periodo, grado }),
      })
    }

    return jsonOk({
      tipo: 'alumnos',
      ciclo,
      filas: await reportePromediosAlumnos({ ciclo, grado, grupo }),
    })
  } catch (e) {
    return jsonError(e)
  }
}
