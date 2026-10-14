import { jsonError, jsonOk } from '@/lib/boletasApi'
import { capturaConfigDeSlug, requireSesionCaptura, supervisaModulo } from '@/lib/boletasCapturaAuth'
import { gruposDeMaestro, gruposSupervision } from '@/lib/boletasCapturaGrupos'
import { etiquetaCicloBoletas } from '@/lib/boletasCiclo'
import { resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function GET(req: Request, { params }: Params) {
  try {
    const cfg = capturaConfigDeSlug((await params).slug)
    const s = requireSesionCaptura(cfg, req)
    const ciclo = await resolverCicloEscolarSistemaValor()
    const grupos =
      cfg.slug === 'secundaria'
        ? []
        : s.supervisor
          ? (await gruposSupervision(cfg.slug, ciclo)).filter((g) => supervisaModulo(s, g.modulo))
          : await gruposDeMaestro(s.maestroId, cfg.niveles)
    return jsonOk({
      maestro: { id: s.maestroId, nombre: s.nombre, usuario: s.usuario },
      supervisor: Boolean(s.supervisor),
      nivel: { slug: cfg.slug, titulo: cfg.titulo },
      ciclo: { valor: ciclo, etiqueta: etiquetaCicloBoletas(ciclo) },
      grupos,
    })
  } catch (e) {
    return jsonError(e)
  }
}
