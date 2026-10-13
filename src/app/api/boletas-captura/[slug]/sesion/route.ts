import { jsonError, jsonOk } from '@/lib/boletasApi'
import { capturaConfigDeSlug, requireSesionCaptura } from '@/lib/boletasCapturaAuth'
import { gruposDeMaestro } from '@/lib/boletasCapturaGrupos'
import { etiquetaCicloBoletas } from '@/lib/boletasCiclo'
import { resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    const cfg = capturaConfigDeSlug((await params).slug)
    const s = requireSesionCaptura(cfg, req)
    const [grupos, ciclo] = await Promise.all([
      gruposDeMaestro(s.maestroId, cfg.niveles),
      resolverCicloEscolarSistemaValor(),
    ])
    return jsonOk({
      maestro: { id: s.maestroId, nombre: s.nombre, usuario: s.usuario },
      nivel: { slug: cfg.slug, titulo: cfg.titulo },
      ciclo: { valor: ciclo, etiqueta: etiquetaCicloBoletas(ciclo) },
      grupos,
    })
  } catch (e) {
    return jsonError(e)
  }
}
