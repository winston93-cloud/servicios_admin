import { obtenerCredencialesPayw2 } from '@/lib/banorteConfig'
import { htmlResultadoBanorte, respuestaHtml } from '@/lib/banorteHtml'
import {
  normalizarReferenciaBanorte,
  registrarPagoBanorteExitoso,
} from '@/lib/banortePagoService'
import { ejecutarVentaPayw2, mensajeResultadoPayw2 } from '@/lib/banortePayw2'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

function str(form: FormData, key: string): string {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export async function POST(request: Request) {
  const form = await request.formData()
  const referencia = normalizarReferenciaBanorte(str(form, 'CONTROL_NUMBER'))
  const nivel = parseInt(str(form, 'ALUMNO_NIVEL'), 10) || 0
  const amount = str(form, 'AMOUNT')

  const campos = {
    CONTROL_NUMBER: referencia,
    CUSTOMER_REF1: str(form, 'CUSTOMER_REF1').slice(0, 28),
    CARD_NUMBER: str(form, 'CARD_NUMBER').replace(/\D/g, '').slice(0, 16),
    CARD_EXP: str(form, 'CARD_EXP'),
    SECURITY_CODE: str(form, 'SECURITY_CODE').replace(/\D/g, '').slice(0, 4),
    AMOUNT: amount,
    ECI: str(form, 'ECI'),
    STATUS_3D: str(form, 'STATUS_3D'),
    XID: str(form, 'XID'),
    CAVV: str(form, 'CAVV'),
    VERSION_3D: str(form, 'VERSION_3D') || '2',
  }

  if (referencia.length !== 12) {
    return respuestaHtml(
      htmlResultadoBanorte({
        exito: false,
        titulo: 'Datos inválidos',
        mensaje: 'Referencia de control inválida.',
      })
    )
  }

  let cred
  try {
    cred = obtenerCredencialesPayw2(nivel)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Credenciales Banorte no configuradas.'
    return respuestaHtml(
      htmlResultadoBanorte({
        exito: false,
        titulo: 'Error de configuración',
        mensaje: msg,
        referencia,
      })
    )
  }

  let payw
  try {
    payw = await ejecutarVentaPayw2(campos, cred)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo conectar con Banorte.'
    return respuestaHtml(
      htmlResultadoBanorte({
        exito: false,
        titulo: 'Error de conexión',
        mensaje: msg,
        referencia,
      })
    )
  }

  if (payw.paywResult !== 'A') {
    return respuestaHtml(
      htmlResultadoBanorte({
        exito: false,
        titulo: 'Pago no autorizado',
        mensaje: mensajeResultadoPayw2(payw),
        referencia,
        detalle: payw.authCode ? `Autorización: ${payw.authCode}` : undefined,
      })
    )
  }

  const importe = Number.parseFloat(amount)
  const supabase = createSupabaseAdmin()
  const registro = await registrarPagoBanorteExitoso(
    supabase,
    referencia,
    Number.isFinite(importe) ? importe : 0
  )

  if (!registro.ok) {
    return respuestaHtml(
      htmlResultadoBanorte({
        exito: false,
        titulo: 'Cargo aprobado, registro pendiente',
        mensaje: `Banorte aprobó el pago, pero hubo un problema al guardarlo: ${registro.mensaje}. Guarde su comprobante y contacte al plantel.`,
        referencia,
        detalle: payw.authCode ? `Código de autorización: ${payw.authCode}` : undefined,
      })
    )
  }

  return respuestaHtml(
    htmlResultadoBanorte({
      exito: true,
      titulo: registro.duplicado ? 'Pago ya registrado' : '¡Pago exitoso!',
      mensaje: registro.mensaje,
      referencia,
      detalle: payw.authCode ? `Autorización bancaria: ${payw.authCode}` : undefined,
    })
  )
}

export async function GET() {
  return respuestaHtml(
    htmlResultadoBanorte({
      exito: false,
      titulo: 'Método no permitido',
      mensaje: 'Use el formulario de comercio electrónico para procesar el pago.',
    }),
    405
  )
}
