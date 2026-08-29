import type { MovimientoBanorte } from './parseBanorteTxt'
import { fechaMovimientoBanorte } from './parseBanorteTxt'
import type { MovimientoClara } from './parseClaraCsv'
import { fechaMovimientoClara } from './parseClaraCsv'
import type { CfdiExcelFila } from './parseCfdiRecibidosExcel'
import { filtrarFacturasConciliacion } from './parseCfdiRecibidosExcel'
import {
  diasEntre,
  formatoFechaCorta,
  montosCoinciden,
  normalizarUuid,
  nombresCoinciden,
  parseFechaCfdi,
} from './conciliacionUtils'

export type ConfianzaConciliacion = 'alta' | 'media' | 'baja'
export type EstadoConciliacion = 'conciliado' | 'no_localizado'
export type FuentePago = 'Clara' | 'Banorte' | 'Clara + Banorte'

export type FilaConciliacion = {
  factura: CfdiExcelFila
  estado: EstadoConciliacion
  fuente: FuentePago | ''
  confianza: ConfianzaConciliacion | ''
  fechaPago: string
  montoPagado: number | null
  diferencia: number | null
  referencia: string
  detalle: string
  movimientoClaraId: string
  movimientoBanorteId: string
}

export type ResumenConciliacion = {
  totalFacturas: number
  conciliadas: number
  noLocalizadas: number
  montoFacturas: number
  montoConciliado: number
  porFuente: { clara: number; banorte: number; ambos: number }
  porConfianza: { alta: number; media: number; baja: number }
}

export type ResultadoConciliacion = {
  filas: FilaConciliacion[]
  resumen: ResumenConciliacion
  claraSinFactura: MovimientoClara[]
  banorteSinFactura: MovimientoBanorte[]
  meta: {
    nombreCfdi: string
    nombreBanorte: string
    nombreClara: string
    generado: string
  }
}

type MatchInterno = {
  fuente: FuentePago
  confianza: ConfianzaConciliacion
  clara?: MovimientoClara
  banorte?: MovimientoBanorte
  detalle: string
}

function textoMovimientoClara(m: MovimientoClara): string {
  return `${m.transaccion} · ${m.fecha} · $${m.montoMxn.toFixed(2)}`
}

function textoMovimientoBanorte(m: MovimientoBanorte): string {
  const ben = m.beneficiario ? ` · ${m.beneficiario}` : ''
  return `${m.descripcion}${ben} · ${m.fecha} · $${m.retiro.toFixed(2)}`
}

function buscarClaraPorUuid(
  uuid: string,
  clara: MovimientoClara[],
  usados: Set<string>
): MovimientoClara | null {
  if (!uuid) return null
  return (
    clara.find((c) => !usados.has(c.id) && c.uuid && c.uuid === uuid) ?? null
  )
}

function buscarBanorteRfcMonto(
  rfc: string,
  monto: number,
  banorte: MovimientoBanorte[],
  usados: Set<string>
): MovimientoBanorte | null {
  if (!rfc) return null
  const rfcU = rfc.toUpperCase()
  return (
    banorte.find(
      (b) =>
        !usados.has(b.id) &&
        b.rfc === rfcU &&
        montosCoinciden(b.retiro, monto)
    ) ?? null
  )
}

function buscarClaraMontoNombre(
  factura: CfdiExcelFila,
  clara: MovimientoClara[],
  usados: Set<string>
): MovimientoClara | null {
  const candidatos = clara.filter(
    (c) =>
      !usados.has(c.id) &&
      montosCoinciden(c.montoMxn, factura.total) &&
      nombresCoinciden(c.transaccion, factura.emisorNombre)
  )
  if (candidatos.length === 1) return candidatos[0]
  return null
}

function buscarBanorteMontoNombre(
  factura: CfdiExcelFila,
  banorte: MovimientoBanorte[],
  usados: Set<string>,
  fechaFactura: Date | null
): MovimientoBanorte | null {
  let candidatos = banorte.filter(
    (b) =>
      !usados.has(b.id) &&
      montosCoinciden(b.retiro, factura.total) &&
      (nombresCoinciden(b.beneficiario, factura.emisorNombre) ||
        nombresCoinciden(b.descripcion, factura.emisorNombre) ||
        (factura.emisorRfc && b.rfc === factura.emisorRfc.toUpperCase()))
  )

  if (!candidatos.length) {
    candidatos = banorte.filter(
      (b) => !usados.has(b.id) && montosCoinciden(b.retiro, factura.total)
    )
  }

  if (fechaFactura && candidatos.length > 1) {
    const enVentana = candidatos.filter((b) => {
      const fb = fechaMovimientoBanorte(b)
      const dias = diasEntre(fechaFactura, fb)
      return dias != null && dias <= 45
    })
    if (enVentana.length === 1) candidatos = enVentana
  }

  if (candidatos.length === 1) return candidatos[0]
  return null
}

function intentarMatch(
  factura: CfdiExcelFila,
  clara: MovimientoClara[],
  banorte: MovimientoBanorte[],
  usadosClara: Set<string>,
  usadosBanorte: Set<string>
): MatchInterno | null {
  const uuid = normalizarUuid(factura.uuid)
  const fechaFactura = parseFechaCfdi(factura.fecha)

  const claraUuid = buscarClaraPorUuid(uuid, clara, usadosClara)
  if (claraUuid) {
    return {
      fuente: 'Clara',
      confianza: 'alta',
      clara: claraUuid,
      detalle: `UUID en Clara: ${textoMovimientoClara(claraUuid)}`,
    }
  }

  const banorteRfc = buscarBanorteRfcMonto(
    factura.emisorRfc,
    factura.total,
    banorte,
    usadosBanorte
  )
  if (banorteRfc) {
    return {
      fuente: 'Banorte',
      confianza: 'alta',
      banorte: banorteRfc,
      detalle: `RFC y monto en Banorte: ${textoMovimientoBanorte(banorteRfc)}`,
    }
  }

  const claraNombre = buscarClaraMontoNombre(factura, clara, usadosClara)
  if (claraNombre) {
    return {
      fuente: 'Clara',
      confianza: 'media',
      clara: claraNombre,
      detalle: `Monto y comercio en Clara: ${textoMovimientoClara(claraNombre)}`,
    }
  }

  const banorteNombre = buscarBanorteMontoNombre(
    factura,
    banorte,
    usadosBanorte,
    fechaFactura
  )
  if (banorteNombre) {
    const confianza: ConfianzaConciliacion =
      banorteNombre.rfc === factura.emisorRfc.toUpperCase() ? 'alta' : 'media'
    return {
      fuente: 'Banorte',
      confianza,
      banorte: banorteNombre,
      detalle: `Monto en Banorte: ${textoMovimientoBanorte(banorteNombre)}`,
    }
  }

  return null
}

export function ejecutarConciliacion(opts: {
  cfdiFilas: CfdiExcelFila[]
  clara: MovimientoClara[]
  banorte: MovimientoBanorte[]
  nombres: { cfdi: string; banorte: string; clara: string }
}): ResultadoConciliacion {
  const facturas = filtrarFacturasConciliacion(opts.cfdiFilas)
  const banortePagos = opts.banorte.filter((b) => b.retiro > 0)
  const usadosClara = new Set<string>()
  const usadosBanorte = new Set<string>()
  const filas: FilaConciliacion[] = []

  for (const factura of facturas) {
    const match = intentarMatch(
      factura,
      opts.clara,
      banortePagos,
      usadosClara,
      usadosBanorte
    )

    if (!match) {
      filas.push({
        factura,
        estado: 'no_localizado',
        fuente: '',
        confianza: '',
        fechaPago: '',
        montoPagado: null,
        diferencia: null,
        referencia: '',
        detalle: 'No se encontró pago en Clara ni Banorte',
        movimientoClaraId: '',
        movimientoBanorteId: '',
      })
      continue
    }

    if (match.clara) usadosClara.add(match.clara.id)
    if (match.banorte) usadosBanorte.add(match.banorte.id)

    const montoPagado =
      (match.clara?.montoMxn ?? 0) + (match.banorte?.retiro ?? 0) || null
    const fechaPago =
      match.clara && match.banorte
        ? `${match.clara.fecha} / ${match.banorte.fecha}`
        : match.clara?.fecha ?? match.banorte?.fecha ?? ''
    const referencia =
      match.clara && match.banorte
        ? `${match.clara.transaccion} · ${match.banorte.referencia || match.banorte.descripcion}`
        : match.clara?.transaccion ??
          match.banorte?.referencia ??
          match.banorte?.descripcion ??
          ''

    filas.push({
      factura,
      estado: 'conciliado',
      fuente: match.fuente,
      confianza: match.confianza,
      fechaPago,
      montoPagado,
      diferencia:
        montoPagado != null ? Math.round((montoPagado - factura.total) * 100) / 100 : null,
      referencia,
      detalle: match.detalle,
      movimientoClaraId: match.clara?.id ?? '',
      movimientoBanorteId: match.banorte?.id ?? '',
    })
  }

  const conciliadas = filas.filter((f) => f.estado === 'conciliado')
  const resumen: ResumenConciliacion = {
    totalFacturas: filas.length,
    conciliadas: conciliadas.length,
    noLocalizadas: filas.length - conciliadas.length,
    montoFacturas: filas.reduce((s, f) => s + f.factura.total, 0),
    montoConciliado: conciliadas.reduce((s, f) => s + f.factura.total, 0),
    porFuente: {
      clara: conciliadas.filter((f) => f.fuente === 'Clara').length,
      banorte: conciliadas.filter((f) => f.fuente === 'Banorte').length,
      ambos: conciliadas.filter((f) => f.fuente === 'Clara + Banorte').length,
    },
    porConfianza: {
      alta: conciliadas.filter((f) => f.confianza === 'alta').length,
      media: conciliadas.filter((f) => f.confianza === 'media').length,
      baja: conciliadas.filter((f) => f.confianza === 'baja').length,
    },
  }

  return {
    filas,
    resumen,
    claraSinFactura: opts.clara.filter((c) => !usadosClara.has(c.id)),
    banorteSinFactura: banortePagos.filter((b) => !usadosBanorte.has(b.id)),
    meta: {
      nombreCfdi: opts.nombres.cfdi,
      nombreBanorte: opts.nombres.banorte,
      nombreClara: opts.nombres.clara,
      generado: new Date().toISOString(),
    },
  }
}

export function etiquetaEstado(estado: EstadoConciliacion): string {
  return estado === 'conciliado' ? 'Conciliado' : 'No localizado'
}

export function fechaFacturaTexto(f: CfdiExcelFila): string {
  return formatoFechaCorta(parseFechaCfdi(f.fecha))
}

export { fechaMovimientoBanorte, fechaMovimientoClara }
