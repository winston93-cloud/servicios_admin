import { parseFechaDmy, parseMoneyMx } from './conciliacionUtils'

export type MovimientoBanorte = {
  id: string
  cuenta: string
  fechaOperacion: string
  fecha: string
  referencia: string
  descripcion: string
  codTransac: string
  deposito: number
  retiro: number
  movimiento: string
  detalle: string
  rfc: string
  beneficiario: string
}

const RFC_PATTERNS = [
  /RFC:\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i,
  /R\.?\s*F\.?\s*C\.?\s*[.:]?\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i,
] as const
const BENEF_RE = /BENEF:([^,]+)/i

export function extraerRfcBanorte(detalle: string): string {
  for (const re of RFC_PATTERNS) {
    const m = detalle.match(re)
    if (m?.[1]) return m[1].toUpperCase()
  }
  return ''
}

function extraerBeneficiario(detalle: string): string {
  const m = detalle.match(BENEF_RE)
  return m ? m[1].trim() : ''
}

export function leerBanorteTxt(buffer: Buffer): MovimientoBanorte[] {
  const text = buffer.toString('latin1')
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) throw new Error('El archivo Banorte está vacío.')

  const header = lines[0].split('|')
  const idx = (name: string) => header.findIndex((h) => h.trim() === name)
  const iRetiros = idx('Retiros')
  const iDepositos = idx('Depósitos')
  if (iRetiros < 0) {
    throw new Error('El TXT Banorte no tiene el formato esperado (columna Retiros).')
  }

  const movimientos: MovimientoBanorte[] = []
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split('|')
    if (parts.length < 9) continue
    const retiro = parseMoneyMx(parts[iRetiros])
    const deposito = iDepositos >= 0 ? parseMoneyMx(parts[iDepositos]) : 0
    if (retiro <= 0 && deposito <= 0) continue

    const get = (name: string) => {
      const ix = idx(name)
      return ix >= 0 ? (parts[ix] ?? '') : ''
    }
    const detalle = get('Descripción Detallada')
    const descripcion = get('Descripción')
    movimientos.push({
      id: `ban-${i}`,
      cuenta: get('Cuenta'),
      fechaOperacion: get('Fecha De Operación'),
      fecha: get('Fecha'),
      referencia: get('Referencia'),
      descripcion,
      codTransac: get('Cod. Transac'),
      deposito,
      retiro,
      movimiento: get('Movimiento'),
      detalle,
      rfc: extraerRfcBanorte(detalle),
      beneficiario: extraerBeneficiario(detalle) || descripcion,
    })
  }

  if (!movimientos.length) {
    throw new Error('No se encontraron movimientos en el archivo Banorte.')
  }
  return movimientos
}

export function movimientosPagoBanorte(movs: MovimientoBanorte[]): MovimientoBanorte[] {
  return movs.filter(esRetiroPagoProveedor)
}

/** Retiros que pueden ser pago a proveedor (excluye comisiones, IVA banco, depósitos). */
export function esRetiroPagoProveedor(m: MovimientoBanorte): boolean {
  if (m.retiro <= 0) return false
  const t = `${m.descripcion} ${m.detalle} ${m.codTransac}`.toUpperCase()
  if (
    /COMISION|IVA COMISION|IVA ORDEN|I\.V\.A\. ORDEN|TRANSFERENCIA - ENVIO|DEPOSITO REFERENCIADO|CONCENTRACION DE PAGOS|INST WINSTON|CARGO DIARIO/.test(
      t
    )
  ) {
    return false
  }
  if (['600', '601', '517', '537'].includes(m.codTransac) && /COMISION|IVA|TRANSFERENCIA - ENVIO/.test(t)) {
    return false
  }
  return true
}

export function fechaMovimientoBanorte(m: MovimientoBanorte): Date | null {
  return parseFechaDmy(m.fecha) ?? parseFechaDmy(m.fechaOperacion)
}
