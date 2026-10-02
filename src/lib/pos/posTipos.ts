/** Tipos y utilidades del POS de Desayunos compartidos entre cliente y servidor. */

export const POS_ZONA_HORARIA = 'America/Monterrey'

export type PosClienteTipo = 'alumno' | 'maestro' | 'externo'

export interface PosCliente {
  /** alumno_ref, `P{maestro_id}` o `E{personal.id}`. */
  ref: string
  nombre: string
  tipo: PosClienteTipo
  nivel: number | null
  grado: string | null
  grupo: string | null
}

export interface PosProducto {
  id: number
  nombre: string
  abreviatura: string
  costo: number
  montoLudi: number
  codigoReporte: string | null
  orden: number
  activo: boolean
}

export interface PosProductoInput {
  id?: number
  nombre: string
  abreviatura: string
  costo: number
  montoLudi: number
  codigoReporte: string | null
  activo: boolean
}

export interface PosExterno {
  id: number
  nombre: string
  app: string
  apm: string
  nombreCompleto: string
}

export interface PosExternoInput {
  id?: number
  nombre: string
  app: string
  apm: string
}

export interface PosVentaLinea {
  productoId: number
  /** YYYY-MM-DD */
  fecha: string
  cantidad: number
}

export interface PosVentaRequest {
  ref: string
  cliente: string
  lineas: PosVentaLinea[]
  recibido: number
}

export interface PosVentaResultado {
  orden: string
  total: number
  recibido: number
  cambio: number
  partidas: number
}

export interface PosPago {
  id: number
  ref: string
  cliente: string
  tipo: PosClienteTipo
  nivel: number | null
  grado: string | null
  grupo: string | null
  descripcion: string
  productoId: number | null
  codigo: string | null
  costo: number
  ludi: number
  cantidad: number
  fecha: string
  orden: string
  estatus: number
  entregado: boolean
}

export interface PosResumenServicio {
  codigo: string
  servicio: string
  precio: number
  ludiUnitario: number
  cantidad: number
  total: number
  ludi: number
  caja: number
}

export interface PosResumenDia {
  fecha: string
  servicios: PosResumenServicio[]
  totalVendido: number
  totalLudi: number
  totalCaja: number
  totalClientes: number
}

export interface PosReporteContable {
  inicio: string
  fin: string
  catalogo: PosProducto[]
  dias: PosResumenDia[]
  totalVendido: number
  totalLudi: number
  totalCaja: number
  totalClientes: number
}

/** Fecha local de México (YYYY-MM-DD), sin el desfase de `toISOString()`. */
export function fechaMx(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: POS_ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function esFechaIso(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

/** Convierte YYYY-MM-DD a Date local (mediodía para evitar saltos por horario). */
export function fechaIsoADate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function dateAFechaIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function sumarDias(iso: string, dias: number): string {
  const d = fechaIsoADate(iso)
  d.setDate(d.getDate() + dias)
  return dateAFechaIso(d)
}

export function esFinDeSemana(iso: string): boolean {
  const dia = fechaIsoADate(iso).getDay()
  return dia === 0 || dia === 6
}

/** Próximo día hábil (lunes a viernes) a partir de `iso`, inclusive. */
export function diaHabilDesde(iso: string): string {
  let f = iso
  while (esFinDeSemana(f)) f = sumarDias(f, 1)
  return f
}

export function fechaLarga(iso: string): string {
  return fechaIsoADate(iso).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function fechaCorta(iso: string): string {
  return fechaIsoADate(iso).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

const MONEDA = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
})

export function moneda(n: number): string {
  return MONEDA.format(Number.isFinite(n) ? n : 0)
}

export function tipoClienteDeRef(ref: string): PosClienteTipo {
  if (/^P\d+$/i.test(ref)) return 'maestro'
  if (/^E\d+$/i.test(ref)) return 'externo'
  return 'alumno'
}

export const NIVEL_ETIQUETA: Record<number, string> = {
  1: 'Maternal',
  2: 'Kinder',
  3: 'Primaria',
  4: 'Secundaria',
}

export function etiquetaCliente(c: Pick<PosCliente, 'tipo' | 'nivel' | 'grado' | 'grupo'>): string {
  if (c.tipo === 'maestro') return 'Personal docente'
  if (c.tipo === 'externo') return 'Externo'
  const nivel = c.nivel != null ? NIVEL_ETIQUETA[c.nivel] ?? `Nivel ${c.nivel}` : ''
  const grado = c.grado ? `${c.grado}°` : ''
  const grupo = c.grupo ? ` ${c.grupo}` : ''
  return [nivel, `${grado}${grupo}`.trim()].filter(Boolean).join(' · ')
}
