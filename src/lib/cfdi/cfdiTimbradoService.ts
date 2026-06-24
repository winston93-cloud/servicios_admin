import type { AppDatabaseClient } from '../dbTypes'
import { obtenerDatosFacturacionPorRef } from '../datosFacturacionService'
import { construirRutaFactura } from '../portalFacturaRutas'
import { resolverConcepto, formaPagoDesdeMetodo } from './cfdiConcepto'
import { emisorClavePorNivel, obtenerConfigEmisor } from './cfdiEmisor'
import { institucionPorNivel } from './cfdiInstitucion'
import { construirPayloadFacturoPorTi, receptorDesdeDatosFacturacion, RECEPTOR_PUBLICO_GENERAL } from './cfdiPayload'
import { timbrarConFacturoPorTi } from './facturoPorTiClient'
import type { CfdiTimbradoLoteResultado, CfdiTimbradoResultado } from './cfdiTypes'

type PagoDetalle = {
  pago_id: number
  alumno_id: number | null
  pago_referencia: string | null
  pago_importe: number
  pago_recargo: number
  pago_forma: string | null
  pago_fecha: string | null
  pago_cancelado: number
  facturo: string | null
}

function alumnoRefDesdeReferencia(referencia: string): number {
  return Number(referencia.trim().slice(0, 5))
}

function montoPago(p: PagoDetalle): number {
  return Number(p.pago_importe ?? 0) + Number(p.pago_recargo ?? 0)
}

function yaFacturado(facturo: string | null | undefined): boolean {
  return String(facturo ?? '').trim().toUpperCase() === 'SI'
}

export function pacConfigurado(): boolean {
  return Boolean(obtenerConfigEmisor('churchill') && obtenerConfigEmisor('educativo'))
}

export async function listarPagosPendientesMes(
  db: AppDatabaseClient,
  mes: number,
  metodoPago: string
): Promise<PagoDetalle[]> {
  const year = new Date().getFullYear()
  const inicio = `${year}-${String(mes).padStart(2, '0')}-01`
  const fin = `${year}-${String(mes).padStart(2, '0')}-31`

  const { data, error } = await db
    .from('pago_detalle')
    .select(
      'pago_id, alumno_id, pago_referencia, pago_importe, pago_recargo, pago_forma, pago_fecha, pago_cancelado, facturo'
    )
    .eq('pago_forma', metodoPago)
    .gte('pago_fecha', inicio)
    .lte('pago_fecha', fin)

  if (error) throw new Error(error.message)

  return (data as PagoDetalle[]).filter(
    (p) =>
      !yaFacturado(p.facturo) &&
      Number(p.pago_cancelado) !== 3 &&
      Boolean(p.pago_referencia?.trim())
  )
}

export async function timbrarReferencia(
  db: AppDatabaseClient,
  referencia: string,
  metodoPago?: string,
  creadoPor?: string
): Promise<CfdiTimbradoResultado> {
  const ref = referencia.trim()
  if (ref.length < 9) {
    return {
      ok: false,
      referencia: ref,
      mensaje: 'Referencia inválida',
      emisor: 'churchill',
    }
  }

  const { data: pago, error: errPago } = await db
    .from('pago_detalle')
    .select(
      'pago_id, alumno_id, pago_referencia, pago_importe, pago_recargo, pago_forma, pago_fecha, pago_cancelado, facturo'
    )
    .eq('pago_referencia', ref)
    .maybeSingle()

  if (errPago) {
    return { ok: false, referencia: ref, mensaje: errPago.message, emisor: 'churchill' }
  }
  if (!pago) {
    return { ok: false, referencia: ref, mensaje: 'Pago no encontrado', emisor: 'churchill' }
  }

  const p = pago as PagoDetalle
  if (yaFacturado(p.facturo)) {
    return { ok: false, referencia: ref, mensaje: 'Ya estaba facturado', emisor: 'churchill' }
  }
  if (Number(p.pago_cancelado) === 3) {
    return { ok: false, referencia: ref, mensaje: 'Pago cancelado', emisor: 'churchill' }
  }

  const forma = metodoPago ?? p.pago_forma ?? 'Transferencia'
  return ejecutarTimbradoPago(db, p, forma, creadoPor)
}

async function ejecutarTimbradoPago(
  db: AppDatabaseClient,
  pago: PagoDetalle,
  metodoPago: string,
  creadoPor?: string,
  tipoOperacion: string = 'timbrado_individual'
): Promise<CfdiTimbradoResultado> {
  const referencia = String(pago.pago_referencia).trim()
  const alumnoRef = alumnoRefDesdeReferencia(referencia)

  const { data: alumno, error: errAl } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel')
    .eq('alumno_ref', alumnoRef)
    .maybeSingle()

  if (errAl || !alumno) {
    const clave = emisorClavePorNivel(4)
    return {
      ok: false,
      referencia,
      mensaje: `Alumno no encontrado (ref ${alumnoRef})`,
      emisor: clave,
    }
  }

  const nivel = Number(alumno.alumno_nivel ?? 0)
  const clave = emisorClavePorNivel(nivel)
  const emisor = obtenerConfigEmisor(clave)
  if (!emisor) {
    return {
      ok: false,
      referencia,
      mensaje: `Faltan credenciales PAC (${clave}) en variables de entorno`,
      emisor: clave,
    }
  }

  const datosFiscales = await obtenerDatosFacturacionPorRef(db, alumnoRef)
  const receptor = datosFiscales
    ? receptorDesdeDatosFacturacion(datosFiscales)
    : RECEPTOR_PUBLICO_GENERAL

  const { data: detalle } = await db
    .from('alumno_detalles')
    .select('alumno_curp')
    .eq('alumno_id', alumno.alumno_id)
    .maybeSingle()

  const nombreCompleto = `${alumno.alumno_nombre ?? ''} ${alumno.alumno_app ?? ''} ${alumno.alumno_apm ?? ''}`.trim()
  const institucion = institucionPorNivel(
    nivel,
    nombreCompleto,
    String(detalle?.alumno_curp ?? '')
  )

  const concepto = resolverConcepto(referencia, clave)
  const monto = montoPago(pago)
  const payload = construirPayloadFacturoPorTi({
    emisor,
    receptor,
    concepto,
    institucion,
    monto,
    formaPago: formaPagoDesdeMetodo(metodoPago),
  })

  const resp = await timbrarConFacturoPorTi(payload, emisor.bearer)

  const rutaLegacy = construirRutaFactura(
    String(alumno.alumno_ref),
    referencia.slice(5, 7),
    Number(referencia.slice(7, 9)) || 0
  )

  await db.from('cfdi_timbrado').insert({
    uuid: resp.uuid ?? null,
    pago_referencia: referencia,
    alumno_ref: alumnoRef,
    emisor_rfc: emisor.rfc,
    receptor_rfc: receptor.rfc,
    total: monto,
    serie: emisor.serie,
    folio: '0',
    tipo_operacion: tipoOperacion,
    estado: resp.ok ? 'timbrado' : 'error',
    pac_codigo: resp.codigo,
    pac_mensaje: resp.mensaje,
    xml_storage_path: resp.ok && rutaLegacy ? `${rutaLegacy}.xml` : null,
    pdf_storage_path: resp.ok && rutaLegacy ? `${rutaLegacy}.pdf` : null,
    creado_por: creadoPor ?? null,
  })

  if (!resp.ok) {
    return {
      ok: false,
      referencia,
      codigo: resp.codigo,
      mensaje: resp.mensaje,
      errorTecnico: resp.informacionTecnica,
      emisor: clave,
    }
  }

  const { error: updErr } = await db
    .from('pago_detalle')
    .update({ facturo: 'SI' })
    .eq('pago_referencia', referencia)

  if (updErr) {
    return {
      ok: false,
      referencia,
      codigo: resp.codigo,
      mensaje: `Timbrado OK pero falló actualizar pago_detalle: ${updErr.message}`,
      uuid: resp.uuid,
      emisor: clave,
    }
  }

  return {
    ok: true,
    referencia,
    codigo: resp.codigo,
    mensaje: resp.mensaje,
    uuid: resp.uuid,
    emisor: clave,
  }
}

export async function timbrarPorMes(
  db: AppDatabaseClient,
  mes: number,
  metodoPago: string,
  creadoPor?: string
): Promise<CfdiTimbradoLoteResultado> {
  const pagos = await listarPagosPendientesMes(db, mes, metodoPago)
  const resultados: CfdiTimbradoResultado[] = []

  for (const pago of pagos) {
    const r = await ejecutarTimbradoPago(db, pago, metodoPago, creadoPor, 'timbrado_mes')
    resultados.push(r)
  }

  const exitosos = resultados.filter((r) => r.ok).length
  return {
    procesados: resultados.length,
    exitosos,
    fallidos: resultados.length - exitosos,
    resultados,
  }
}
