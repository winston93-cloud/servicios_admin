import {
  esEstatus3dAprobado,
  obtenerDetalleError3dSecure,
} from '@/lib/banorte3dsErrors'
import { htmlFormularioComercioElectronico } from '@/lib/banorteComercioFormHtml'
import { obtenerCredencialesPayw2 } from '@/lib/banorteConfig'
import { htmlResultado3dSecureRechazo, htmlShellBanorte, respuestaHtml } from '@/lib/banorteHtml'
import {
  normalizarReferenciaBanorte,
  obtenerMontoPendienteBanorte,
} from '@/lib/banortePagoService'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

function str(form: FormData, key: string): string {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export async function POST(request: Request) {
  const form = await request.formData()
  const estatus3d = str(form, 'Estatus')
  const referencia3d = normalizarReferenciaBanorte(str(form, 'REFERENCIA3D'))
  const mensaje3d = str(form, 'MENSAJE')
  const eci = str(form, 'ECI')
  const xid = str(form, 'XID')
  const cavv = str(form, 'CAVV')

  if (!esEstatus3dAprobado(estatus3d)) {
    const detalle = obtenerDetalleError3dSecure(estatus3d, mensaje3d || null)
    const html = htmlResultado3dSecureRechazo(detalle, referencia3d || '—')
    return respuestaHtml(html, 200)
  }

  if (referencia3d.length !== 12) {
    const detalle = obtenerDetalleError3dSecure(null, null)
    return respuestaHtml(
      htmlResultado3dSecureRechazo(
        {
          ...detalle,
          titulo: 'Respuesta incompleta',
          mensaje: 'No se recibió una referencia válida desde 3D Secure.',
          sugerencia: 'Regrese al portal de pagos e inicie el pago de nuevo.',
        },
        '—'
      ),
      200
    )
  }

  const supabase = createSupabaseAdmin()
  const monto = await obtenerMontoPendienteBanorte(supabase, referencia3d)
  if (monto == null || monto <= 0) {
    return respuestaHtml(
      htmlResultado3dSecureRechazo(
        {
          aprobado: false,
          codigo: null,
          titulo: 'Sesión de pago expirada',
          mensaje: 'No se encontró el importe asociado a esta referencia.',
          sugerencia: 'El enlace de verificación expiró o ya fue usado. Inicie el pago nuevamente desde el portal.',
          categoria: 'sistema',
        },
        referencia3d
      ),
      200
    )
  }

  const ref5 = referencia3d.slice(0, 5)
  const { data: alumno } = await supabase
    .from('alumno')
    .select('alumno_nivel')
    .eq('alumno_ref', parseInt(ref5, 10))
    .maybeSingle()

  const nivel = Number(alumno?.alumno_nivel ?? 0)

  try {
    obtenerCredencialesPayw2(nivel)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Credenciales Banorte no configuradas.'
    return respuestaHtml(
      htmlResultado3dSecureRechazo(
        {
          aprobado: false,
          codigo: null,
          titulo: 'Pago en línea no disponible',
          mensaje: msg,
          sugerencia: 'Contacte al plantel. El cargo no se realizó.',
          categoria: 'sistema',
        },
        referencia3d
      ),
      200
    )
  }

  const montoFmt = monto.toFixed(2)
  const html = htmlFormularioComercioElectronico({
    procesarUrl: new URL('/portal-pagos/banorte/procesar', request.url).toString(),
    referencia: referencia3d,
    montoFmt,
    nivel,
    eci,
    xid,
    cavv,
  })

  return respuestaHtml(html)
}

export async function GET() {
  return respuestaHtml(
    htmlShellBanorte(
      'Comercio electrónico',
      2,
      '<section class="banorte-card"><p>Este enlace solo acepta respuestas POST de Banorte 3D Secure.</p></section>'
    ),
    405
  )
}
