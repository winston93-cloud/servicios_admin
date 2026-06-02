import { obtenerCredencialesPayw2 } from '@/lib/banorteConfig'
import { htmlFormularioComercioElectronico } from '@/lib/banorteComercioFormHtml'
import { htmlResultadoBanorte, respuestaHtml } from '@/lib/banorteHtml'
import { obtenerDetalleErrorPayw2 } from '@/lib/banortePaywErrors'
import {
  normalizarReferenciaBanorte,
  registrarIntentoPaywFallido,
  registrarPagoBanorteExitoso,
} from '@/lib/banortePagoService'
import { ejecutarVentaPayw2 } from '@/lib/banortePayw2'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

function str(form: FormData, key: string): string {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

function datosFormularioDesdePost(
  request: Request,
  campos: Record<string, string>,
  referencia: string,
  nivel: number
) {
  const montoFmt = campos.AMOUNT || '0.00'
  return {
    procesarUrl: new URL('/portal-pagos/banorte/procesar', request.url).toString(),
    referencia,
    montoFmt,
    nivel,
    eci: campos.ECI,
    xid: campos.XID,
    cavv: campos.CAVV,
  }
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

  const importe = Number.parseFloat(amount)
  const supabase = createSupabaseAdmin()

  if (payw.paywResult !== 'A') {
    const detalle = obtenerDetalleErrorPayw2(payw)
    await registrarIntentoPaywFallido(
      supabase,
      referencia,
      Number.isFinite(importe) ? importe : 0,
      payw,
      detalle
    )
    const html = htmlFormularioComercioElectronico(
      datosFormularioDesdePost(request, campos, referencia, nivel),
      {
        error: detalle,
        prefill: { customerRef1: campos.CUSTOMER_REF1 },
      }
    )
    return respuestaHtml(html)
  }

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
