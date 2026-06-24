import { urlFacturoPorTiApi } from '../cfdiConfig'

export interface FacturoPorTiRespuesta {
  ok: boolean
  codigo: string
  mensaje: string
  informacionTecnica?: string
  uuid?: string
  xml?: string
  pdfBase64?: string
  raw?: unknown
}

export async function timbrarConFacturoPorTi(
  payload: object,
  bearer: string
): Promise<FacturoPorTiRespuesta> {
  const url = `${urlFacturoPorTiApi()}/servicios/timbrar/json`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(payload),
  })

  const raw = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!raw) {
    return {
      ok: false,
      codigo: 'HTTP',
      mensaje: `Respuesta inválida del PAC (${res.status})`,
      raw,
    }
  }

  const estatus = raw.estatus as Record<string, unknown> | undefined
  const codigo = String(estatus?.codigo ?? '').trim()
  const mensaje = String(estatus?.descripcion ?? 'Sin descripción')
  const informacionTecnica = estatus?.informacionTecnica
    ? String(estatus.informacionTecnica)
    : undefined

  const timbrado = raw.cfdiTimbrado as Record<string, unknown> | undefined
  const resp = timbrado?.respuesta as Record<string, unknown> | undefined

  return {
    ok: codigo === '000',
    codigo,
    mensaje,
    informacionTecnica,
    uuid: resp?.uuid ? String(resp.uuid) : undefined,
    xml: resp?.cfdixml ? String(resp.cfdixml) : undefined,
    pdfBase64: resp?.pdf ? String(resp.pdf) : undefined,
    raw,
  }
}

export interface FacturoPorTiTimbresRespuesta {
  ok: boolean
  emisor: 'churchill' | 'educativo'
  fechaCompra?: string
  timbresUtilizados?: number
  creditosRestantes?: number
  codigo: string
  mensaje: string
  raw?: unknown
}

export async function consultarTimbresFacturoPorTi(
  bearer: string,
  emisor: 'churchill' | 'educativo'
): Promise<FacturoPorTiTimbresRespuesta> {
  const url = `${urlFacturoPorTiApi()}/servicios/consultar/timbres`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
  })

  const raw = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!raw) {
    return {
      ok: false,
      emisor,
      codigo: 'HTTP',
      mensaje: `Respuesta inválida del PAC (${res.status})`,
      raw,
    }
  }

  const estatus = raw.estatus as Record<string, unknown> | undefined
  const codigo = String(estatus?.codigo ?? '').trim()
  const mensaje = String(estatus?.descripcion ?? 'Sin descripción')

  return {
    ok: codigo === '000',
    emisor,
    fechaCompra: raw.fechaCompra ? String(raw.fechaCompra) : undefined,
    timbresUtilizados: raw.timbresUtilizados != null ? Number(raw.timbresUtilizados) : undefined,
    creditosRestantes: raw.creditosRestantes != null ? Number(raw.creditosRestantes) : undefined,
    codigo,
    mensaje,
    raw,
  }
}

export interface FacturoPorTiCancelacionRespuesta {
  ok: boolean
  codigo: string
  mensaje: string
  informacionTecnica?: string
  raw?: unknown
}

export async function cancelarCfdiFacturoPorTi(
  payload: object,
  bearer: string
): Promise<FacturoPorTiCancelacionRespuesta> {
  const url = `${urlFacturoPorTiApi()}/servicios/cancelar/csd`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(payload),
  })

  const raw = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!raw) {
    return {
      ok: false,
      codigo: 'HTTP',
      mensaje: `Respuesta inválida del PAC (${res.status})`,
      raw,
    }
  }

  const estatus = raw.estatus as Record<string, unknown> | undefined
  const codigo = String(estatus?.codigo ?? '').trim()
  const mensaje = String(estatus?.descripcion ?? 'Sin descripción')
  const informacionTecnica = estatus?.informacionTecnica
    ? String(estatus.informacionTecnica)
    : undefined

  return {
    ok: codigo === '000',
    codigo,
    mensaje,
    informacionTecnica,
    raw,
  }
}
