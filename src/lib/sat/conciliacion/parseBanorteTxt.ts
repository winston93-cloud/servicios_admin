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

const RFC_RE = /RFC:\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i
const BENEF_RE = /BENEF:([^,]+)/i

function extraerRfc(detalle: string): string {
  const m = detalle.match(RFC_RE)
  return m ? m[1].toUpperCase() : ''
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
      rfc: extraerRfc(detalle),
      beneficiario: extraerBeneficiario(detalle) || descripcion,
    })
  }

  if (!movimientos.length) {
    throw new Error('No se encontraron movimientos en el archivo Banorte.')
  }
  return movimientos
}

export function movimientosPagoBanorte(movs: MovimientoBanorte[]): MovimientoBanorte[] {
  return movs.filter((m) => m.retiro > 0)
}

export function fechaMovimientoBanorte(m: MovimientoBanorte): Date | null {
  return parseFechaDmy(m.fecha) ?? parseFechaDmy(m.fechaOperacion)
}
