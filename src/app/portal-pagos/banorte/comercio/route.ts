import { mensajeError3dSecure } from '@/lib/banorte3dsErrors'
import { obtenerCredencialesPayw2 } from '@/lib/banorteConfig'
import { htmlShellBanorte, respuestaHtml } from '@/lib/banorteHtml'
import {
  normalizarReferenciaBanorte,
  obtenerMontoPendienteBanorte,
} from '@/lib/banortePagoService'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function str(form: FormData, key: string): string {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export async function POST(request: Request) {
  const form = await request.formData()
  const estatus3d = str(form, 'Estatus')
  const referencia3d = normalizarReferenciaBanorte(str(form, 'REFERENCIA3D'))
  const eci = str(form, 'ECI')
  const xid = str(form, 'XID')
  const cavv = str(form, 'CAVV')

  if (estatus3d !== '200') {
    const code = Number(estatus3d)
    const html = htmlResultadoError(
      referencia3d || '—',
      Number.isNaN(code) ? null : code,
      mensajeError3dSecure(estatus3d)
    )
    return respuestaHtml(html, 200)
  }

  if (referencia3d.length !== 12) {
    return respuestaHtml(
      htmlResultadoError('—', null, 'No se recibió una referencia válida desde 3D Secure.'),
      200
    )
  }

  const supabase = createSupabaseAdmin()
  const monto = await obtenerMontoPendienteBanorte(supabase, referencia3d)
  if (monto == null || monto <= 0) {
    return respuestaHtml(
      htmlResultadoError(
        referencia3d,
        null,
        'No se encontró el importe del pago. Vuelva al portal e inicie de nuevo.'
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

  let cred
  try {
    cred = obtenerCredencialesPayw2(nivel)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Credenciales Banorte no configuradas.'
    return respuestaHtml(htmlResultadoError(referencia3d, null, msg), 200)
  }

  const montoFmt = monto.toFixed(2)
  const procesarUrl = new URL('/portal-pagos/banorte/procesar', request.url).toString()

  const contenido = `
    <section class="banorte-card">
      <h1 class="banorte-card-title">Formulario 2 de 2</h1>
      <p class="banorte-card-lead">Verificación aprobada. Confirme el cargo con los datos de su tarjeta.</p>
      <dl class="banorte-summary">
        <div><dt>Referencia</dt><dd><code>${esc(referencia3d)}</code></dd></div>
        <div><dt>Total</dt><dd class="banorte-amount">$${esc(montoFmt)}</dd></div>
      </dl>
      <form method="POST" action="${esc(procesarUrl)}" accept-charset="UTF-8" class="banorte-form-grid" id="banorte-pay-form">
        <input type="hidden" name="CONTROL_NUMBER" value="${esc(referencia3d)}" />
        <input type="hidden" name="ECI" value="${esc(eci)}" />
        <input type="hidden" name="STATUS_3D" value="200" />
        <input type="hidden" name="XID" value="${esc(xid)}" />
        <input type="hidden" name="CAVV" value="${esc(cavv)}" />
        <input type="hidden" name="VERSION_3D" value="2" />
        <input type="hidden" name="AMOUNT" value="${esc(montoFmt)}" />
        <input type="hidden" name="ALUMNO_NIVEL" value="${esc(String(nivel))}" />

        <div class="banorte-field">
          <label for="CUSTOMER_REF1">Nombre del cliente (máx. 28 caracteres)</label>
          <input type="text" name="CUSTOMER_REF1" id="CUSTOMER_REF1" maxlength="28" required placeholder="Como aparece en la tarjeta" />
          <span class="banorte-char-count" id="char-count">28 caracteres restantes</span>
        </div>
        <div class="banorte-field">
          <label for="CARD_NUMBER">Número de tarjeta</label>
          <input type="text" name="CARD_NUMBER" id="CARD_NUMBER" inputmode="numeric" maxlength="16" pattern="[0-9]{16}" required autocomplete="cc-number" />
        </div>
        <div class="banorte-field banorte-field--half">
          <label for="CARD_EXP">Vencimiento (MM/AA)</label>
          <input type="text" name="CARD_EXP" id="CARD_EXP" placeholder="MM/AA" maxlength="5" pattern="[0-9]{2}/[0-9]{2}" required autocomplete="cc-exp" />
        </div>
        <div class="banorte-field banorte-field--half">
          <label for="SECURITY_CODE">CVV</label>
          <input type="password" name="SECURITY_CODE" id="SECURITY_CODE" inputmode="numeric" maxlength="4" pattern="[0-9]{3,4}" required autocomplete="cc-csc" />
        </div>
        <div class="banorte-actions" style="grid-column:1/-1">
          <button type="submit" class="banorte-btn banorte-btn--primary">Realizar pago</button>
        </div>
      </form>
      <p class="banorte-secure-note"><span aria-hidden="true">🔒</span> El cargo se procesa en los servidores seguros de Banorte Payworks.</p>
    </section>
    <script>
      (function () {
        var input = document.getElementById('CUSTOMER_REF1');
        var count = document.getElementById('char-count');
        if (!input || !count) return;
        input.addEventListener('input', function () {
          var rest = 28 - input.value.length;
          count.textContent = rest + ' caracteres restantes';
          count.className = rest === 0 ? 'banorte-char-count banorte-char-count--warn' : 'banorte-char-count';
        });
      })();
    </script>`

  const html = htmlShellBanorte(
    'Comercio electrónico',
    2,
    contenido,
    '/portal-pagos/banorte/comercio.png'
  )

  return respuestaHtml(html)
}

function htmlResultadoError(referencia: string, code: number | null, mensaje: string): string {
  const codeHtml = code != null ? `<p class="banorte-ref">Código <strong>${code}</strong></p>` : ''
  const contenido = `
    <section class="banorte-card banorte-result banorte-result--error">
      <div class="banorte-result-icon">!</div>
      <h1 class="banorte-result-title">Verificación no aprobada</h1>
      <p class="banorte-result-msg">${esc(mensaje)}</p>
      ${codeHtml}
      <p class="banorte-ref">Referencia <code>${esc(referencia)}</code></p>
      <a href="/portal-pagos" class="banorte-btn banorte-btn--primary">Volver al portal</a>
    </section>`
  return htmlShellBanorte('Error 3D Secure', 'resultado', contenido)
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
