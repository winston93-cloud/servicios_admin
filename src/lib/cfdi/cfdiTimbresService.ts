import { bearerFacturoPorTi } from '../cfdiConfig'
import { consultarTimbresFacturoPorTi } from './facturoPorTiClient'
import type { CfdiEmisorClave } from './cfdiTypes'

export interface CfdiSaldoTimbres {
  emisor: CfdiEmisorClave
  label: string
  ok: boolean
  fechaCompra?: string
  timbresUtilizados?: number
  creditosRestantes?: number
  codigo: string
  mensaje: string
}

const LABELS: Record<CfdiEmisorClave, string> = {
  churchill: 'Instituto Winston Churchill',
  educativo: 'Instituto Educativo Winston',
}

export async function consultarSaldosTimbres(): Promise<CfdiSaldoTimbres[]> {
  const emisores: CfdiEmisorClave[] = ['churchill', 'educativo']
  const resultados: CfdiSaldoTimbres[] = []

  for (const emisor of emisores) {
    const bearer = bearerFacturoPorTi(emisor)
    if (!bearer) {
      resultados.push({
        emisor,
        label: LABELS[emisor],
        ok: false,
        codigo: 'CONFIG',
        mensaje: 'Falta FACTUROPORTI_BEARER en Vercel',
      })
      continue
    }

    const r = await consultarTimbresFacturoPorTi(bearer, emisor)
    resultados.push({
      emisor,
      label: LABELS[emisor],
      ok: r.ok,
      fechaCompra: r.fechaCompra,
      timbresUtilizados: r.timbresUtilizados,
      creditosRestantes: r.creditosRestantes,
      codigo: r.codigo,
      mensaje: r.mensaje,
    })
  }

  return resultados
}
