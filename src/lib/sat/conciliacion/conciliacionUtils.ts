/** Centavos fijos para RFC/UUID; flexible solo si ya hubo coincidencia de nombre. */
const TOLERANCIA_MONTO_ESTRICTA = 0.05
const TOLERANCIA_MONTO_FLEX_PROP = 0.002
const TOLERANCIA_MONTO_FLEX_TOPE = 0.2

export function parseMoneyMx(raw: string | number | null | undefined): number {
  if (raw == null || raw === '') return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  const s = String(raw).replace(/\$/g, '').replace(/,/g, '').trim()
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function normalizarUuid(raw: string | null | undefined): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-F0-9]/g, '')
}

export function normalizarTexto(raw: string | null | undefined): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokensNombre(raw: string | null | undefined, minLen = 4): string[] {
  const stop = new Set([
    'SA',
    'DE',
    'CV',
    'RL',
    'SC',
    'DEL',
    'LOS',
    'LAS',
    'THE',
    'INC',
    'MEXICO',
    'MEX',
    'COM',
  ])
  return normalizarTexto(raw)
    .split(' ')
    .filter((t) => t.length >= minLen && !stop.has(t))
}

const ALIAS_COMERCIO: Record<string, string[]> = {
  CHEDRAUI: ['TIENDAS CHEDRAUI', 'CHEDRAUI'],
  SORIANA: ['TIENDAS SORIANA', 'CITYCLUB', 'CITY CLUB'],
  MERCADOPAGO: ['MERCADOPAGO', 'MERPAGO', 'MERCADOL', 'MERCADOLIBRE'],
  PAYPAL: ['PAYPAL', 'PAY PAL'],
  PARISINA: ['GRUPO PARISINA', 'PARISINA'],
  GOLFO: ['M N DEL GOLFO', 'MN DEL GOLF', 'FERRETERIA MN'],
}

function tokensConAlias(raw: string): string[] {
  const base = tokensNombre(raw, 3)
  const norm = normalizarTexto(raw)
  const extra: string[] = []
  for (const [key, aliases] of Object.entries(ALIAS_COMERCIO)) {
    if (aliases.some((a) => norm.includes(normalizarTexto(a)))) extra.push(key)
  }
  return [...new Set([...base, ...extra])]
}

export function nombresCoinciden(a: string, b: string): boolean {
  const ta = tokensConAlias(a)
  const tb = tokensConAlias(b)
  if (!ta.length || !tb.length) return false
  return ta.some((t) => tb.some((u) => u.includes(t) || t.includes(u)))
}

export function toleranciaMonto(monto: number, flexible = false): number {
  if (!flexible) return TOLERANCIA_MONTO_ESTRICTA
  const abs = Math.abs(monto)
  if (abs < 500) return 0.15
  return Math.min(
    TOLERANCIA_MONTO_FLEX_TOPE,
    Math.max(TOLERANCIA_MONTO_ESTRICTA, abs * TOLERANCIA_MONTO_FLEX_PROP)
  )
}

export function montosCoinciden(a: number, b: number, flexible = false): boolean {
  const ref = Math.max(Math.abs(a), Math.abs(b))
  return Math.abs(a - b) <= toleranciaMonto(ref, flexible)
}

export function normalizarComercioClara(raw: string): string {
  return normalizarTexto(raw).replace(/PAY\s+PAL/g, 'PAYPAL')
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        inQ = !inQ
      }
    } else if (ch === ',' && !inQ) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim())
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = (vals[i] ?? '').trim()
    })
    return row
  })
}

export function parseFechaCfdi(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export function parseFechaDmy(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function parseFechaIso(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export function diasEntre(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null
  const ms = Math.abs(a.getTime() - b.getTime())
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export function formatoFechaCorta(d: Date | null): string {
  if (!d) return ''
  return d.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}
