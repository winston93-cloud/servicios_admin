import type { AppDatabaseClient } from '../dbTypes'
import { obtenerDatosFacturacionPorRef } from '../datosFacturacionService'
import { nivelCobroDesdeReferencia } from '../nivelCobroElectronico'
import { emisorClavePorNivel, obtenerConfigEmisor } from './cfdiEmisor'
import { resolverConcepto, formaPagoDesdeMetodo } from './cfdiConcepto'
import { institucionPorNivel } from './cfdiInstitucion'
import {
  construirPayloadNotaCredito,
  receptorDesdeDatosFacturacion,
  RECEPTOR_PUBLICO_GENERAL,
} from './cfdiPayload'
import { timbrarConFacturoPorTi } from './facturoPorTiClient'
import type { CfdiNotaCreditoResultado } from './cfdiTypes'

export const TIPOS_RELACION_NOTA: { value: string; label: string }[] = [
  { value: '01', label: 'Nota de crédito de los documentos relacionados' },
  { value: '02', label: 'Nota de débito de los documentos relacionados' },
  { value: '03', label: 'Devolución de mercancía sobre facturas o traslados previos' },
  { value: '04', label: 'Sustitución de los CFDI previos' },
  { value: '05', label: 'Traslados de mercancías facturados previamente' },
  { value: '06', label: 'Factura generada por los traslados previos' },
  { value: '07', label: 'CFDI por aplicación de anticipo' },
]

function alumnoRefDesdeReferencia(referencia: string): number {
  return Number(referencia.trim().slice(0, 5))
}

export async function emitirNotaCredito(
  db: AppDatabaseClient,
  referenciaPago: string,
  uuidRelacionado: string,
  tipoRelacion: string,
  creadoPor?: string
): Promise<CfdiNotaCreditoResultado> {
  const referencia = referenciaPago.trim()
  const uuid = uuidRelacionado.trim()
  const trelacion = tipoRelacion.trim()

  if (referencia.length < 9) {
    return {
      ok: false,
      referencia,
      codigo: 'INPUT',
      mensaje: 'Referencia inválida',
      emisor: 'churchill',
    }
  }
  if (!uuid) {
    return {
      ok: false,
      referencia,
      codigo: 'INPUT',
      mensaje: 'UUID relacionado obligatorio',
      emisor: 'churchill',
    }
  }

  const { data: pago, error: errPago } = await db
    .from('pago_detalle')
    .select('pago_referencia, pago_importe, pago_recargo, pago_forma, alumno_id')
    .eq('pago_referencia', referencia)
    .maybeSingle()

  if (errPago || !pago) {
    return {
      ok: false,
      referencia,
      codigo: 'NOT_FOUND',
      mensaje: errPago?.message ?? 'Pago no encontrado',
      emisor: 'churchill',
    }
  }

  const alumnoRef = alumnoRefDesdeReferencia(referencia)
  const { data: alumno, error: errAl } = await db
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_ciclo_escolar'
    )
    .eq('alumno_ref', alumnoRef)
    .maybeSingle()

  if (errAl || !alumno) {
    return {
      ok: false,
      referencia,
      codigo: 'NOT_FOUND',
      mensaje: `Alumno no encontrado (ref ${alumnoRef})`,
      emisor: 'churchill',
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
      codigo: 'CONFIG',
      mensaje: `Faltan credenciales PAC (${clave})`,
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
  const monto = Number(pago.pago_importe ?? 0) + Number(pago.pago_recargo ?? 0)
  const forma = formaPagoDesdeMetodo(pago.pago_forma ?? 'Transferencia')

  const payload = construirPayloadNotaCredito({
    emisor,
    receptor,
    concepto,
    institucion,
    monto,
    formaPago: forma,
    uuidRelacionado: uuid,
    tipoRelacion: trelacion,
  })

  const resp = await timbrarConFacturoPorTi(payload, emisor.bearer)

  await db.from('cfdi_nota_credito').insert({
    uuid: resp.uuid ?? null,
    uuid_relacionado: uuid,
    pago_referencia: referencia,
    emisor_rfc: emisor.rfc,
    total: monto,
    estado: resp.ok ? 'timbrada' : 'error',
    pac_respuesta: resp.raw ?? null,
    creado_por: creadoPor ?? null,
  })

  if (!resp.ok) {
    return {
      ok: false,
      referencia,
      codigo: resp.codigo,
      mensaje: resp.mensaje,
      emisor: clave,
      errorTecnico: resp.informacionTecnica,
    }
  }

  await db.from('pago_detalle').update({ facturo: 'SI' }).eq('pago_referencia', referencia)

  return {
    ok: true,
    referencia,
    codigo: resp.codigo,
    mensaje: resp.mensaje,
    uuid: resp.uuid,
    emisor: clave,
  }
}
