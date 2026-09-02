import {
  esRetiroPagoProveedor,
  extraerRfcBanorte,
  fechaMovimientoBanorte,
  type MovimientoBanorte,
} from './parseBanorteTxt'
import type { MovimientoClara } from './parseClaraCsv'
import { fechaMovimientoClara } from './parseClaraCsv'
import type { CfdiExcelFila } from './parseCfdiRecibidosExcel'
import { filtrarFacturasConciliacion } from './parseCfdiRecibidosExcel'
import {
  diasEntre,
  formatoFechaCorta,
  montosCoinciden,
  normalizarComercioClara,
  normalizarUuid,
  nombresCoinciden,
  parseFechaCfdi,
} from './conciliacionUtils'
import { detalleSimpleMatch } from './detalleSimplePago'

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
  detalleSimple: string
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

function rfcBanorteMovimiento(m: MovimientoBanorte): string {
  return (m.rfc || extraerRfcBanorte(m.detalle)).toUpperCase()
}

function claveClaraDedupe(c: MovimientoClara): string {
  return `${normalizarComercioClara(c.transaccion)}|${c.montoMxn.toFixed(2)}|${c.fecha.slice(0, 10)}`
}

function dedupeClara(candidatos: MovimientoClara[]): MovimientoClara[] {
  const vistos = new Set<string>()
  const out: MovimientoClara[] = []
  for (const c of candidatos) {
    const k = claveClaraDedupe(c)
    if (vistos.has(k)) continue
    vistos.add(k)
    out.push(c)
  }
  return out
}

function filtrarPorFechaUnica<T>(
  candidatos: T[],
  fechaFactura: Date | null,
  fechaDe: (item: T) => Date | null
): T[] {
  if (!fechaFactura || candidatos.length <= 1) return candidatos
  const enVentana = candidatos.filter((item) => {
    const fp = fechaDe(item)
    const dias = diasEntre(fechaFactura, fp)
    return dias != null && dias <= 45
  })
  return enVentana.length === 1 ? enVentana : candidatos
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
  usados: Set<string>,
  fechaFactura: Date | null = null
): MovimientoBanorte | null {
  if (!rfc) return null
  const rfcU = rfc.toUpperCase()
  let candidatos = banorte.filter(
    (b) =>
      !usados.has(b.id) &&
      rfcBanorteMovimiento(b) === rfcU &&
      montosCoinciden(b.retiro, monto)
  )
  candidatos = filtrarPorFechaUnica(candidatos, fechaFactura, fechaMovimientoBanorte)
  if (candidatos.length === 1) return candidatos[0]
  return candidatos[0] ?? null
}

function buscarClaraMontoNombre(
  factura: CfdiExcelFila,
  clara: MovimientoClara[],
  usados: Set<string>,
  fechaFactura: Date | null
): MovimientoClara | null {
  let candidatos = dedupeClara(
    clara.filter(
      (c) =>
        !usados.has(c.id) &&
        montosCoinciden(c.montoMxn, factura.total, true) &&
        nombresCoinciden(c.transaccion, factura.emisorNombre)
    )
  )
  candidatos = filtrarPorFechaUnica(candidatos, fechaFactura, fechaMovimientoClara)
  if (candidatos.length === 1) return candidatos[0]
  return null
}

function buscarClaraSoloMonto(
  factura: CfdiExcelFila,
  clara: MovimientoClara[],
  usados: Set<string>,
  fechaFactura: Date | null
): MovimientoClara | null {
  let candidatos = dedupeClara(
    clara.filter(
      (c) => !usados.has(c.id) && montosCoinciden(c.montoMxn, factura.total)
    )
  )
  candidatos = filtrarPorFechaUnica(candidatos, fechaFactura, fechaMovimientoClara)
  if (candidatos.length === 1) return candidatos[0]
  return null
}

function buscarBanorteMontoNombre(
  factura: CfdiExcelFila,
  banorte: MovimientoBanorte[],
  usados: Set<string>,
  fechaFactura: Date | null
): MovimientoBanorte | null {
  const rfcU = factura.emisorRfc.toUpperCase()
  let candidatos = banorte.filter(
    (b) =>
      !usados.has(b.id) &&
      montosCoinciden(b.retiro, factura.total, true) &&
      (nombresCoinciden(b.beneficiario, factura.emisorNombre) ||
        nombresCoinciden(b.descripcion, factura.emisorNombre) ||
        (rfcU && rfcBanorteMovimiento(b) === rfcU))
  )

  if (!candidatos.length) {
    candidatos = banorte.filter(
      (b) => !usados.has(b.id) && montosCoinciden(b.retiro, factura.total)
    )
    if (rfcU && candidatos.length > 1) {
      const porRfc = candidatos.filter((b) => rfcBanorteMovimiento(b) === rfcU)
      if (porRfc.length >= 1) candidatos = porRfc
    }
  }

  candidatos = filtrarPorFechaUnica(candidatos, fechaFactura, fechaMovimientoBanorte)

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
    usadosBanorte,
    fechaFactura
  )
  if (banorteRfc) {
    return {
      fuente: 'Banorte',
      confianza: 'alta',
      banorte: banorteRfc,
      detalle: `RFC y monto en Banorte: ${textoMovimientoBanorte(banorteRfc)}`,
    }
  }

  const claraNombre = buscarClaraMontoNombre(
    factura,
    clara,
    usadosClara,
    fechaFactura
  )
  if (claraNombre) {
    return {
      fuente: 'Clara',
      confianza: 'media',
      clara: claraNombre,
      detalle: `Monto y comercio en Clara: ${textoMovimientoClara(claraNombre)}`,
    }
  }

  const claraMonto = buscarClaraSoloMonto(factura, clara, usadosClara, fechaFactura)
  if (claraMonto) {
    return {
      fuente: 'Clara',
      confianza: 'baja',
      clara: claraMonto,
      detalle: `Monto único en Clara (sin coincidencia de nombre): ${textoMovimientoClara(claraMonto)}`,
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
      rfcBanorteMovimiento(banorteNombre) === factura.emisorRfc.toUpperCase()
        ? 'alta'
        : 'media'
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
  const banortePagos = opts.banorte.filter(esRetiroPagoProveedor)
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
        detalleSimple: '',
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
      detalleSimple: detalleSimpleMatch({
        clara: match.clara,
        banorte: match.banorte,
      }),
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
