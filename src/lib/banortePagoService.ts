import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { DetalleErrorPayw2 } from './banortePaywErrors'
import type { RespuestaPayw2 } from './banortePayw2'
import { formatearAlumnoRefParaReferencia, normalizarConceptoNo } from './pagoReferenciaColegiatura'

export function normalizarReferenciaBanorte(ref: string): string {
  return String(ref ?? '').replace(/\D/g, '').slice(0, 12)
}

export async function guardarMontoPendienteBanorte(
  supabase: AppDatabaseClient,
  referencia: string,
  monto: number
): Promise<void> {
  const ref = normalizarReferenciaBanorte(referencia)
  if (ref.length !== 12) throw new Error('Referencia de pago inválida (12 dígitos).')

  const { error } = await supabase.from('banorte_pago_pendiente').upsert(
    { referencia: ref, monto: Number(monto.toFixed(2)) },
    { onConflict: 'referencia' }
  )

  if (error) {
    if (error.code === '42P01') {
      throw new Error(
        'Falta la tabla banorte_pago_pendiente en Supabase. Ejecute sql/banorte_pago_pendiente_add.sql'
      )
    }
    throw new Error(error.message)
  }
}

export async function obtenerMontoPendienteBanorte(
  supabase: AppDatabaseClient,
  referencia: string
): Promise<number | null> {
  const ref = normalizarReferenciaBanorte(referencia)
  const { data, error } = await supabase
    .from('banorte_pago_pendiente')
    .select('monto')
    .eq('referencia', ref)
    .maybeSingle()

  if (error) {
    if (error.code === '42P01') return null
    console.error('obtenerMontoPendienteBanorte:', error.message)
    return null
  }

  if (data?.monto == null) return null
  return Number(data.monto)
}

async function obtenerMaxPagoId(supabase: AppDatabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('pago_detalle')
    .select('pago_id')
    .order('pago_id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || data?.pago_id == null) return 0
  return Number(data.pago_id)
}

async function existePagoPorReferencia(
  supabase: AppDatabaseClient,
  referencia: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('pago_detalle')
    .select('pago_id', { count: 'exact', head: true })
    .eq('pago_referencia', referencia)

  if (error) {
    console.error('existePagoPorReferencia:', error.message)
    return true
  }
  return (count ?? 0) > 0
}

async function buscarAlumnoPorReferencia(
  supabase: AppDatabaseClient,
  referencia: string
): Promise<{ alumno_id: number; pago_nombre: string; alumno_nivel: number } | null> {
  const ref5 = formatearAlumnoRefParaReferencia(referencia.slice(0, 5))
  const refNum = parseInt(ref5, 10)

  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_id, alumno_nombre, alumno_app, alumno_apm, alumno_nivel')
    .eq('alumno_ref', refNum)
    .maybeSingle()

  if (error || !data) return null

  const pago_nombre =
    `${data.alumno_app ?? ''} ${data.alumno_apm ?? ''} ${data.alumno_nombre ?? ''}`.trim() ||
    'Alumno'

  return {
    alumno_id: data.alumno_id,
    pago_nombre,
    alumno_nivel: Number(data.alumno_nivel ?? 0),
  }
}

async function activarAlumnoInscripcion(
  supabase: AppDatabaseClient,
  referencia: string
): Promise<void> {
  if (normalizarConceptoNo(referencia.slice(5, 7)) !== '13') return
  const ref5 = formatearAlumnoRefParaReferencia(referencia.slice(0, 5))
  const refNum = parseInt(ref5, 10)
  const { error } = await supabase
    .from('alumno')
    .update({ alumno_status: 1 })
    .eq('alumno_ref', refNum)
  if (error) console.error('activarAlumnoInscripcion:', error.message)
}

export interface ResultadoRegistroPagoBanorte {
  ok: boolean
  mensaje: string
  duplicado?: boolean
  factura?: {
    ok: boolean
    mensaje: string
    /** Detalle PAC / técnico (secundario, no mezcla con el mensaje al papá). */
    detalleTecnico?: string
    uuid?: string
    pdfUrl?: string | null
    xmlUrl?: string | null
  }
}

/**
 * Registra pago en InsForge tras Payworks exitoso y intenta timbrar CFDI.
 * Si el PAC falla, el pago queda registrado (facturo vacío) para reintento admin.
 */
export async function registrarPagoBanorteExitoso(
  supabase: AppDatabaseClient,
  referencia: string,
  importe: number
): Promise<ResultadoRegistroPagoBanorte> {
  const ref = normalizarReferenciaBanorte(referencia)
  if (ref.length !== 12) {
    return { ok: false, mensaje: 'Referencia inválida.' }
  }

  if (await existePagoPorReferencia(supabase, ref)) {
    return {
      ok: true,
      mensaje: 'Este pago ya estaba registrado.',
      duplicado: true,
    }
  }

  const alumno = await buscarAlumnoPorReferencia(supabase, ref)
  if (!alumno) {
    return { ok: false, mensaje: 'No se encontró el alumno para esta referencia.' }
  }

  const pagoId = (await obtenerMaxPagoId(supabase)) + 1
  const ahora = new Date().toISOString()
  const hoy = ahora.slice(0, 10)

  const { error } = await supabase.from('pago_detalle').insert({
    pago_id: pagoId,
    alumno_id: alumno.alumno_id,
    pago_nombre: alumno.pago_nombre,
    pago_referencia: ref,
    pago_importe: importe,
    pago_recargo: 0,
    pago_forma: 'Comercio Electronico',
    pago_folio: null,
    pago_fecha: hoy,
    pago_hora: '09:00:00 a.m.',
    pago_emisora: 'S/E',
    pago_cancelado: 0,
    pago_registro: ahora,
    pago_actualizacion: ahora,
    facturo: '',
    fact: '',
  })

  if (error) {
    return { ok: false, mensaje: error.message }
  }

  await activarAlumnoInscripcion(supabase, ref)

  await supabase.from('banorte_pago_pendiente').delete().eq('referencia', ref)

  const factura = await intentarTimbrarTrasBanorte(supabase, ref)

  return {
    ok: true,
    mensaje: factura.ok
      ? 'Su pago con tarjeta quedó registrado correctamente.'
      : 'Su pago con tarjeta quedó registrado correctamente. El cargo a su tarjeta sí se realizó.',
    factura,
  }
}

/** Texto claro para el papá; el detalle PAC queda aparte. */
function mensajeFacturaPendienteParaPadre(codigo: string | null | undefined, tecnico?: string): {
  mensaje: string
  detalleTecnico?: string
} {
  const t = (tecnico ?? '').trim()
  const lower = t.toLowerCase()
  let mensaje =
    'La factura electrónica (CFDI) no se pudo emitir en este momento. Su pago ya está registrado; la escuela puede completar la factura después.'
  if (lower.includes('curp')) {
    mensaje =
      'La factura electrónica no se pudo emitir porque el CURP del alumno no es válido o está incompleto. Su pago ya quedó registrado; actualice el CURP en datos del alumno o solicite ayuda en caja.'
  } else if (lower.includes('rfc') || lower.includes('razón') || lower.includes('razon')) {
    mensaje =
      'La factura electrónica no se pudo emitir por un dato fiscal (RFC o razón social). Su pago ya quedó registrado; revise Alta de facturación o solicite ayuda en caja.'
  }
  const detalleTecnico = [codigo ? `Código PAC ${codigo}` : null, t || null].filter(Boolean).join(' — ') || undefined
  return { mensaje, detalleTecnico }
}

async function intentarTimbrarTrasBanorte(
  supabase: AppDatabaseClient,
  referencia: string
): Promise<NonNullable<ResultadoRegistroPagoBanorte['factura']>> {
  try {
    const { pacConfigurado, timbrarReferencia } = await import('./cfdi/cfdiTimbradoService')
    if (!pacConfigurado()) {
      return {
        ok: false,
        mensaje:
          'La factura electrónica no se pudo emitir ahora (configuración del servidor). Su pago ya quedó registrado.',
        detalleTecnico: 'Faltan credenciales PAC',
      }
    }
    const r = await timbrarReferencia(
      supabase,
      referencia,
      'Comercio Electronico',
      'banorte-ce'
    )
    if (r.ok) {
      return {
        ok: true,
        mensaje: 'Factura electrónica emitida correctamente.',
        uuid: r.uuid,
        pdfUrl: r.pdfUrl,
        xmlUrl: r.xmlUrl,
      }
    }
    console.error('Banorte CFDI:', r.codigo, r.mensaje, r.errorTecnico)
    const padre = mensajeFacturaPendienteParaPadre(
      r.codigo,
      [r.mensaje, r.errorTecnico].filter(Boolean).join(' — ')
    )
    return {
      ok: false,
      mensaje: padre.mensaje,
      detalleTecnico: padre.detalleTecnico,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al timbrar'
    console.error('Banorte CFDI exception:', msg)
    return {
      ok: false,
      mensaje:
        'La factura electrónica no se pudo emitir por un error temporal. Su pago ya quedó registrado.',
      detalleTecnico: msg,
    }
  }
}


/** Guarda intento fallido Payworks (Anexo A) para soporte y reportes. */
export async function registrarIntentoPaywFallido(
  supabase: AppDatabaseClient,
  referencia: string,
  importe: number,
  resp: RespuestaPayw2,
  detalle: DetalleErrorPayw2
): Promise<void> {
  const ref = normalizarReferenciaBanorte(referencia)
  const { error } = await supabase.from('banorte_payw_intento').insert({
    referencia: ref,
    importe: Number.isFinite(importe) ? Number(importe.toFixed(2)) : null,
    payw_result: resp.paywResult,
    payw_code: detalle.paywCode ?? resp.paywCode,
    auth_result: resp.authResult,
    auth_code: resp.authCode,
    mensaje_es: detalle.mensaje,
    mensaje_raw: resp.text,
  })
  if (error) {
    if (error.code === '42P01') {
      console.warn('banorte_payw_intento: ejecute sql/banorte_payw_intento_add.sql')
      return
    }
    console.error('registrarIntentoPaywFallido:', error.message)
  }
}
