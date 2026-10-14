import { requireAdmin, requireBoletasSession } from '@/lib/boletasAuth'
import { jsonError } from '@/lib/boletasApi'
import { cicloEscolarActualBoletas } from '@/lib/boletasCiclo'
import { generarBoletaPdfBuffer, generarBoletasGrupoPdfBuffer } from '@/lib/boletasPdf'
import { esGradoSecundaria, esGrupoSecundaria } from '@/lib/boletasSecundariaCatalog'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Boleta en PDF: `alumnoId` (una) o `grado` + `grupo` (todo el grupo). `periodo` = último trimestre impreso. */
export async function GET(req: Request) {
  try {
    requireAdmin(await requireBoletasSession(req))
    const url = new URL(req.url)
    const q = (k: string) => url.searchParams.get(k)
    const ciclo = Number(q('ciclo') ?? cicloEscolarActualBoletas())
    const periodo = q('periodo') ? Number(q('periodo')) : undefined
    const alumnoId = Number(q('alumnoId'))
    const grado = Number(q('grado'))
    const grupo = String(q('grupo') ?? '').toUpperCase()

    let buf: Buffer
    let nombre: string
    if (alumnoId) {
      buf = await generarBoletaPdfBuffer({ alumnoId, ciclo, periodo })
      nombre = `boleta_${alumnoId}_${ciclo}.pdf`
    } else if (esGradoSecundaria(grado) && esGrupoSecundaria(grupo)) {
      buf = await generarBoletasGrupoPdfBuffer({ ciclo, grado, grupo, periodo })
      nombre = `boletas_${grado + 6}${grupo}_t${periodo ?? 3}_${ciclo}.pdf`
    } else {
      return Response.json({ error: 'Indica alumnoId, o grado y grupo.' }, { status: 400 })
    }
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombre}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    return jsonError(e, 400)
  }
}
