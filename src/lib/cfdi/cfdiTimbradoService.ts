import type { AppDatabaseClient } from '../dbTypes'
import { createInsforgeAdmin } from '../insforgeAdmin'
import { obtenerDatosFacturacionPorRef } from '../datosFacturacionService'
import { crearNombreArchivoFactura } from '../portalFacturaRutas'
import { nivelCobroDesdeReferencia } from '../nivelCobroElectronico'
import { resolverConcepto, formaPagoDesdeMetodo } from './cfdiConcepto'
import { emisorClavePorNivel, obtenerConfigEmisor } from './cfdiEmisor'
import { institucionPorNivel } from './cfdiInstitucion'
import { construirPayloadFacturoPorTi, receptorDesdeDatosFacturacion, RECEPTOR_PUBLICO_GENERAL } from './cfdiPayload'
import { guardarArchivosCfdi } from './cfdiStorage'
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
  metodoPago?: string
): Promise<PagoDetalle[]> {
  const year = new Date().getFullYear()
  const inicio = `${year}-${String(mes).padStart(2, '0')}-01`
  const fin = `${year}-${String(mes).padStart(2, '0')}-31`

  let query = db
    .from('pago_detalle')
    .select(
      'pago_id, alumno_id, pago_referencia, pago_importe, pago_recargo, pago_forma, pago_fecha, pago_cancelado, facturo'
    )
    .gte('pago_fecha', inicio)
    .lte('pago_fecha', fin)

  if (metodoPago) {
    query = query.eq('pago_forma', metodoPago)
  }

  const { data, error } = await query

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
  tipoOperacion: string = 'timbrado_individual',
  forzarPublicoGeneral = false
): Promise<CfdiTimbradoResultado> {
  const referencia = String(pago.pago_referencia).trim()
  const alumnoRef = alumnoRefDesdeReferencia(referencia)

  const { data: alumno, error: errAl } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_ciclo_escolar'
    )
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

  const nivel = nivelCobroDesdeReferencia(
    {
      alumno_nivel: Number(alumno.alumno_nivel ?? 0),
      alumno_grado: Number(alumno.alumno_grado ?? 0),
      alumno_ciclo_escolar: Number(alumno.alumno_ciclo_escolar ?? 0),
    },
    referencia
  )
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

  const datosFiscales = forzarPublicoGeneral
    ? null
    : await obtenerDatosFacturacionPorRef(db, alumnoRef)
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

  if (!emisor.logoBase64) {
    console.warn(`[cfdi] Logotipo vacío para emisor ${clave}; el PDF saldrá sin escudo`)
  } else {
    console.info(`[cfdi] Logotipo ${clave}: ${emisor.logoBase64.length} chars base64`)
  }

  const resp = await timbrarConFacturoPorTi(payload, emisor.bearer)

  const nombreBase = crearNombreArchivoFactura(
    String(alumno.alumno_ref),
    referencia.slice(5, 7),
    Number(referencia.slice(7, 9)) || 0
  )

  let xmlPath: string | null = nombreBase ? `${nombreBase}.xml` : null
  let pdfPath: string | null = nombreBase ? `${nombreBase}.pdf` : null
  let pdfUrl: string | null = null
  let xmlUrl: string | null = null

  if (resp.ok && (resp.xml || resp.pdfBase64)) {
    try {
      const archivos = await guardarArchivosCfdi(createInsforgeAdmin(), {
        alumnoRef: alumno.alumno_ref,
        conceptoNo: referencia.slice(5, 7),
        ciclo: Number(referencia.slice(7, 9)) || 0,
        xml: resp.xml,
        pdfBase64: resp.pdfBase64,
      })
      if (archivos.xmlKey) xmlPath = archivos.xmlKey
      if (archivos.pdfKey) pdfPath = archivos.pdfKey
      xmlUrl = archivos.xmlUrl
      pdfUrl = archivos.pdfUrl
    } catch (e) {
      console.error(
        'guardarArchivosCfdi:',
        e instanceof Error ? e.message : e
      )
    }
  }

  const pacMensaje = resp.ok
    ? resp.mensaje
    : [resp.mensaje, resp.informacionTecnica?.trim()]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(' — ')

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
    pac_mensaje: pacMensaje,
    xml_storage_path: resp.ok ? xmlPath : null,
    pdf_storage_path: resp.ok ? pdfPath : null,
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
      pdfUrl,
      xmlUrl,
    }
  }

  return {
    ok: true,
    referencia,
    codigo: resp.codigo,
    mensaje: resp.mensaje,
    uuid: resp.uuid,
    emisor: clave,
    pdfUrl: pdfUrl ?? (pdfPath ? `/api/facturacion/archivo?f=${encodeURIComponent(pdfPath)}` : null),
    xmlUrl: xmlUrl ?? (xmlPath ? `/api/facturacion/archivo?f=${encodeURIComponent(xmlPath)}` : null),
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

export async function timbrarPublicoGeneralPorMes(
  db: AppDatabaseClient,
  mes: number,
  creadoPor?: string
): Promise<CfdiTimbradoLoteResultado> {
  const pagos = await listarPagosPendientesMes(db, mes)
  const resultados: CfdiTimbradoResultado[] = []

  for (const pago of pagos) {
    const forma = pago.pago_forma ?? 'Transferencia'
    const r = await ejecutarTimbradoPago(
      db,
      pago,
      forma,
      creadoPor,
      'timbrado_publico_mes',
      true
    )
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
