import type { AppDatabaseClient } from '../dbTypes'
import { CFDI_EMISOR_CHURCHILL_RFC, CFDI_EMISOR_EDUCATIVO_RFC } from '../cfdiConfig'
import { emisorClavePorRfc, obtenerConfigEmisor } from './cfdiEmisor'
import { cancelarCfdiFacturoPorTi } from './facturoPorTiClient'
import type { CfdiCancelacionResultado, CfdiEmisorClave, CfdiMotivoCancelacion } from './cfdiTypes'

export interface CancelarCfdiInput {
  uuid: string
  folioSustitucion: string
  rfcEmisor: string
  rfcReceptor: string
  total: number
  motivo: CfdiMotivoCancelacion
  emisor?: CfdiEmisorClave
  creadoPor?: string
}

export const MOTIVOS_CANCELACION: { value: CfdiMotivoCancelacion; label: string }[] = [
  { value: '01', label: 'Comprobante emitido con errores con relación' },
  { value: '02', label: 'Comprobante emitido con errores sin relación' },
  { value: '03', label: 'No se llevó a cabo la operación' },
  {
    value: '04',
    label: 'Operación facturada individualmente y parte de factura global',
  },
]

export function emisorRfcDefault(clave: CfdiEmisorClave): string {
  return clave === 'churchill' ? CFDI_EMISOR_CHURCHILL_RFC : CFDI_EMISOR_EDUCATIVO_RFC
}

export async function cancelarCfdi(
  db: AppDatabaseClient,
  input: CancelarCfdiInput
): Promise<CfdiCancelacionResultado> {
  const uuid = input.uuid.trim()
  const clave =
    input.emisor ?? emisorClavePorRfc(input.rfcEmisor) ?? ('churchill' as CfdiEmisorClave)

  if (!uuid) {
    return { ok: false, uuid, codigo: 'INPUT', mensaje: 'UUID obligatorio', emisor: clave }
  }

  const emisor = obtenerConfigEmisor(clave)
  if (!emisor) {
    return {
      ok: false,
      uuid,
      codigo: 'CONFIG',
      mensaje: `Faltan credenciales PAC (${clave})`,
      emisor: clave,
    }
  }

  const payload = {
    RfcEmisor: input.rfcEmisor.trim().toUpperCase(),
    RfcReceptor: input.rfcReceptor.trim().toUpperCase(),
    Uuid: uuid,
    Motivo: input.motivo,
    FolioFiscalSustitucion: input.folioSustitucion.trim(),
    Total: input.total.toFixed(2),
    Certificado: emisor.csd,
    LlavePrivada: emisor.llavePrivada,
    Password: emisor.csdPassword,
  }

  const resp = await cancelarCfdiFacturoPorTi(payload, emisor.bearer)

  await db.from('cfdi_cancelacion').insert({
    uuid,
    folio_sustitucion: input.folioSustitucion.trim() || null,
    motivo: input.motivo,
    emisor_rfc: input.rfcEmisor.trim().toUpperCase(),
    receptor_rfc: input.rfcReceptor.trim().toUpperCase(),
    total: input.total,
    estado: resp.ok ? 'cancelada' : 'error',
    pac_respuesta: resp.raw ?? null,
    creado_por: input.creadoPor ?? null,
  })

  if (!resp.ok) {
    return {
      ok: false,
      uuid,
      codigo: resp.codigo,
      mensaje: resp.mensaje,
      emisor: clave,
      errorTecnico: resp.informacionTecnica,
    }
  }

  return {
    ok: true,
    uuid,
    codigo: resp.codigo,
    mensaje: resp.mensaje,
    emisor: clave,
  }
}
