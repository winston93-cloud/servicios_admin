import type { TablaMigracion } from './migracionTablasManifest'

const FECHA_FALLBACK = '1970-01-01T00:00:00.000Z'

/**
 * Columnas NOT NULL en InsForge que en MySQL pueden venir NULL o vacías.
 * Misma regla que scripts/migrate-supabase-to-insforge.mjs (espacio o valor fijo).
 */
const DEFAULTS_NOT_NULL_DESTINO: Partial<
  Record<string, Record<string, string>>
> = {
  alumno: {
    secret_key: ' ',
    motivo: ' ',
    responsable: ' ',
  },
  pago_detalle: {
    facturo: ' ',
    fact: ' ',
    pago_nombre: ' ',
    pago_forma: ' ',
    pago_folio: ' ',
    pago_hora: ' ',
    pago_emisora: ' ',
    pago_referencia: '000000000000',
  },
  datos_facturacion: {
    nexterior: '',
    ninterior: '',
    lada: '',
    numero: '',
  },
}

function aplicarDefaultsNotNull(
  tabla: string,
  fila: Record<string, unknown>
): Record<string, unknown> {
  const defaults = DEFAULTS_NOT_NULL_DESTINO[tabla]
  if (!defaults) return fila
  const out = { ...fila }
  for (const [col, valorDefecto] of Object.entries(defaults)) {
    const v = out[col]
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) {
      out[col] = valorDefecto
    }
  }
  return out
}

function claveNormalizada(key: string): string {
  const k = key.trim()
  const lower = k.toLowerCase()
  if (lower === 'visible' || k === 'Visible') return 'visible'
  if (lower === 'orden_visible' || k === 'Orden_Visible') return 'orden_visible'
  if (lower === 'porroga_id') return 'prorroga_id'
  return k
}

/** Columnas permitidas en InsForge por tabla (evita codigo, Orden_Visible, etc.). */
export const COLUMNAS_DESTINO: Partial<Record<string, string[]>> = {
  concepto_interno: ['concepto_id', 'concepto_clase', 'visible', 'orden_visible'],
  usuario: [
    'usuario_id',
    'perfil_id',
    'usuario_username',
    'usuario_password',
    'usuario_nombre',
    'usuario_app',
    'usuario_apm',
    'usuario_email',
    'usuario_status',
    'usuario_alta',
    'nivel',
  ],
  alumno_beca: [
    'alumno_beca_id',
    'alumno_id',
    'beca_id',
    'beca_porcentaje',
    'beca_estatus',
    'beca_ciclo_escolar',
    'beca_registro',
    'beca_actualizacion',
    'beca_p',
  ],
  pago_prorroga: ['prorroga_id', 'alumno_id', 'prorroga_fecha', 'correccion'],
}

function esFechaInvalida(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true
  const s = String(valor).trim()
  return !s || s.startsWith('0000-00-00') || /-00/.test(s)
}

function adaptarConceptoInterno(fila: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fila)) {
    out[claveNormalizada(k)] = v
  }
  if (out.visible === null || out.visible === undefined || out.visible === '') {
    out.visible = 1
  }
  if (out.orden_visible === null || out.orden_visible === undefined || out.orden_visible === '') {
    out.orden_visible = 0
  }
  return out
}

function adaptarAlumnoBeca(fila: Record<string, unknown>): Record<string, unknown> {
  const out = { ...fila }
  if (esFechaInvalida(out.beca_registro)) out.beca_registro = FECHA_FALLBACK
  if (esFechaInvalida(out.beca_actualizacion)) out.beca_actualizacion = FECHA_FALLBACK
  if (out.beca_p === null || out.beca_p === undefined || String(out.beca_p).trim() === '') {
    out.beca_p = '0'
  }
  return out
}

function filtrarColumnas(
  fila: Record<string, unknown>,
  columnas: string[] | undefined
): Record<string, unknown> {
  if (!columnas?.length) return fila
  const out: Record<string, unknown> = {}
  for (const col of columnas) {
    if (col in fila) out[col] = fila[col]
  }
  return out
}

export function adaptarFilaParaDestino(
  def: TablaMigracion,
  fila: Record<string, unknown>
): Record<string, unknown> {
  let out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fila)) {
    out[claveNormalizada(k)] = v
  }

  if (def.id === 'concepto_interno') out = adaptarConceptoInterno(out)
  if (def.id === 'alumno_beca') out = adaptarAlumnoBeca(out)
  if (def.id === 'pago_prorroga') {
    if (out.porroga_id !== undefined && out.prorroga_id === undefined) {
      out.prorroga_id = out.porroga_id
      delete out.porroga_id
    }
    if (out.correccion === null || out.correccion === undefined) {
      out.correccion = 0
    }
  }

  const filtrada = filtrarColumnas(out, COLUMNAS_DESTINO[def.destino])
  return aplicarDefaultsNotNull(def.destino, filtrada)
}

export function mensajeErrorDestino(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? 'Error desconocido')
  const e = error as { message?: string; code?: string; details?: string; hint?: string }
  const partes = [e.message, e.details, e.hint, e.code].filter(Boolean)
  return partes.length ? partes.join(' — ') : JSON.stringify(error)
}
