import { urlPortalPagosAlumno } from './banorteConfig'
import {
  etiquetaCategoriaPayw,
  type DetalleErrorPayw2,
} from './banortePaywErrors'
import { htmlShellBanorte } from './banorteHtml'

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface DatosFormularioComercio {
  procesarUrl: string
  referencia: string
  montoFmt: string
  nivel: number
  eci: string
  xid: string
  cavv: string
  /** Estatus 3DS aprobado (legacy reenvía el mismo valor a Payworks). */
  status3d?: string
}

export interface PrefillComercio {
  customerRef1?: string
}

/** Payload seguro para console.log (sin CVV ni PAN completo). */
export type BanorteDebugPayw = {
  fase: 'comercio_3ds_ok' | 'payw_rechazo' | 'payw_error'
  referencia: string
  monto: string
  nivel: number
  eci: string
  status3d: string
  xidLen: number
  cavvLen: number
  xidTail?: string
  cavvTail?: string
  via?: 'proxy' | 'direct'
  merchantId?: string
  terminalId?: string
  cuenta?: string
  paywResult?: string | null
  authResult?: string | null
  paywCode?: string | null
  authCode?: string | null
  text?: string | null
  controlNumber?: string | null
  titulo?: string
  mensaje?: string
  categoria?: string
}

function scriptDebugBanorte(
  datos: DatosFormularioComercio,
  opts?: { error?: DetalleErrorPayw2; debug?: BanorteDebugPayw }
): string {
  const status3d = datos.status3d || '200'
  const base: BanorteDebugPayw = {
    fase: opts?.error ? 'payw_rechazo' : 'comercio_3ds_ok',
    referencia: datos.referencia,
    monto: datos.montoFmt,
    nivel: datos.nivel,
    eci: datos.eci,
    status3d,
    xidLen: datos.xid.length,
    cavvLen: datos.cavv.length,
    xidTail: datos.xid ? datos.xid.slice(-6) : undefined,
    cavvTail: datos.cavv ? datos.cavv.slice(-6) : undefined,
    ...(opts?.debug ?? {}),
    ...(opts?.error
      ? {
          titulo: opts.error.titulo,
          mensaje: opts.error.mensaje,
          categoria: opts.error.categoria,
          paywCode: opts.error.paywCode,
          authResult: opts.error.authResult,
        }
      : {}),
  }
  const json = JSON.stringify(base).replace(/</g, '\\u003c')
  return `<script>
(function () {
  var PAGE = ${json};
  console.group("%c[Banorte CE] paso 2 · diagnóstico", "color:#0b5;font-weight:bold");
  console.log("Copie este objeto y péguelo en el chat:", PAGE);
  console.table({
    referencia: PAGE.referencia,
    monto: PAGE.monto,
    nivel: PAGE.nivel,
    eci: PAGE.eci,
    status3d: PAGE.status3d,
    xidLen: PAGE.xidLen,
    cavvLen: PAGE.cavvLen,
    paywResult: PAGE.paywResult || "(aún no enviado)",
    authResult: PAGE.authResult || "—",
    paywCode: PAGE.paywCode || "—",
    text: PAGE.text || "—"
  });
  if (PAGE.fase === "payw_rechazo") {
    console.warn("[Banorte CE] Payworks rechazó el cargo", {
      via: PAGE.via || "—",
      merchantId: PAGE.merchantId || "—",
      terminalId: PAGE.terminalId || "—",
      cuenta: PAGE.cuenta || "—",
      nivel: PAGE.nivel,
      monto: PAGE.monto,
      titulo: PAGE.titulo,
      mensaje: PAGE.mensaje,
      categoria: PAGE.categoria,
      paywCode: PAGE.paywCode,
      authResult: PAGE.authResult,
      authCode: PAGE.authCode,
      text: PAGE.text,
      controlNumber: PAGE.controlNumber
    });
  }
  console.groupEnd();
  try { window.__BANORTE_CE_DEBUG__ = PAGE; } catch (e) {}

  var form = document.getElementById("banorte-pay-form");
  if (!form) return;
  form.addEventListener("submit", function () {
    var cardEl = document.getElementById("CARD_NUMBER");
    var expEl = document.getElementById("CARD_EXP");
    var nameEl = document.getElementById("CUSTOMER_REF1");
    var cvvEl = document.getElementById("SECURITY_CODE");
    var card = cardEl && cardEl.value ? String(cardEl.value).replace(/\\D/g, "") : "";
    var masked = card.length >= 4
      ? card.slice(0, 6) + "******" + card.slice(-4)
      : "(vacío)";
    var payload = {
      fase: "payw_submit",
      referencia: PAGE.referencia,
      monto: PAGE.monto,
      nivel: PAGE.nivel,
      eci: PAGE.eci,
      status3d: PAGE.status3d,
      xidLen: PAGE.xidLen,
      cavvLen: PAGE.cavvLen,
      customerRef1Len: nameEl && nameEl.value ? nameEl.value.length : 0,
      cardMasked: masked,
      cardLen: card.length,
      cardExp: expEl ? expEl.value : "",
      cvvLen: cvvEl && cvvEl.value ? String(cvvEl.value).replace(/\\D/g, "").length : 0
    };
    console.group("%c[Banorte CE] enviando a /procesar (Payworks)", "color:#06c;font-weight:bold");
    console.log("Copie este objeto:", payload);
    console.table(payload);
    console.groupEnd();
    try { window.__BANORTE_CE_LAST_SUBMIT__ = payload; } catch (e) {}
  });
})();
</script>`
}

function scriptPersistenciaTarjeta(referencia: string): string {
  const ref = esc(referencia)
  return `<script>
(function () {
  var ref = "${ref}";
  var key = "banorte_ce_" + ref;
  var form = document.getElementById("banorte-pay-form");
  if (!form) return;
  var ids = ["CUSTOMER_REF1", "CARD_NUMBER", "CARD_EXP"];
  function save() {
    try {
      var d = {};
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.value) d[id] = el.value;
      });
      localStorage.setItem(key, JSON.stringify(d));
      sessionStorage.setItem(key, JSON.stringify(d));
    } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (!raw) return;
      var d = JSON.parse(raw);
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && d[id]) el.value = d[id];
      });
      var nameEl = document.getElementById("CUSTOMER_REF1");
      var countEl = document.getElementById("char-count");
      if (nameEl && countEl && nameEl.value) {
        var rest = 28 - nameEl.value.length;
        countEl.textContent = rest + " caracteres restantes";
      }
    } catch (e) {}
  }
  form.addEventListener("input", save);
  form.addEventListener("submit", save);
  load();
})();
(function () {
  var input = document.getElementById("CUSTOMER_REF1");
  var count = document.getElementById("char-count");
  if (!input || !count) return;
  input.addEventListener("input", function () {
    var rest = 28 - input.value.length;
    count.textContent = rest + " caracteres restantes";
    count.className = rest === 0 ? "banorte-char-count banorte-char-count--warn" : "banorte-char-count";
  });
})();
</script>`
}

function htmlBannerErrorPayw(detalle: DetalleErrorPayw2, referencia: string): string {
  const codigoBadge = detalle.paywCode
    ? `<p class="banorte-result-code" aria-label="Código Payworks">Código <strong>${esc(detalle.paywCode)}</strong> · ${esc(etiquetaCategoriaPayw(detalle.categoria))}</p>`
    : ''
  const tecnico = detalle.detalleTecnico
    ? `<p class="banorte-result-tecnico"><span>Registro técnico:</span> ${esc(detalle.detalleTecnico)}</p>`
    : ''
  return `
    <section class="banorte-card banorte-error-banner" role="alert">
      <div class="banorte-error-banner-head">
        <span class="banorte-error-banner-icon" aria-hidden="true">!</span>
        <div>
          <p class="banorte-result-eyebrow">Paso 2 de 2 · Comercio electrónico</p>
          <h2 class="banorte-error-banner-title">${esc(detalle.titulo)}</h2>
        </div>
      </div>
      <p class="banorte-error-banner-msg">${esc(detalle.mensaje)}</p>
      ${codigoBadge}
      <div class="banorte-result-hint">
        <p class="banorte-result-hint-title">Qué puede hacer</p>
        <p>${esc(detalle.sugerencia)}</p>
      </div>
      ${tecnico}
      <p class="banorte-ref">Referencia <code>${esc(referencia)}</code> · La verificación 3D Secure sigue vigente</p>
    </section>`
}

export function htmlFormularioComercioElectronico(
  datos: DatosFormularioComercio,
  opts?: { prefill?: PrefillComercio; error?: DetalleErrorPayw2; debug?: BanorteDebugPayw }
): string {
  const nombre = opts?.prefill?.customerRef1 ?? ''
  const errorBlock = opts?.error ? htmlBannerErrorPayw(opts.error, datos.referencia) : ''
  const okBanner = opts?.error
    ? ''
    : `<div class="banorte-ok-banner" role="status">
      <span class="banorte-ok-banner-icon" aria-hidden="true">✓</span>
      <div>
        <p class="banorte-ok-banner-title">Verificación 3D Secure aprobada</p>
        <p class="banorte-ok-banner-text">Su banco confirmó la identidad. Continúe con el cargo (paso 2 de 2).</p>
      </div>
    </div>`

  const contenido = `
    ${errorBlock}
    ${okBanner}
    <section class="banorte-card">
      <h1 class="banorte-card-title">Formulario 2 de 2 · Comercio electrónico</h1>
      <p class="banorte-card-lead">${opts?.error ? 'Corrija los datos y vuelva a intentar el cargo. No necesita repetir 3D Secure.' : 'Confirme el cargo. Si ya verificó su tarjeta en el paso anterior, los datos se cargan automáticamente; solo confirme el CVV.'}</p>
      <p class="banorte-secure-note" style="margin:0 0 0.75rem">Abra la consola del navegador (F12 → Consola). Busque <code>[Banorte CE]</code> y copie el objeto si falla el cargo.</p>
      <dl class="banorte-summary">
        <div><dt>Referencia</dt><dd><code>${esc(datos.referencia)}</code></dd></div>
        <div><dt>Total</dt><dd class="banorte-amount">$${esc(datos.montoFmt)}</dd></div>
      </dl>
      <form method="POST" action="${esc(datos.procesarUrl)}" accept-charset="UTF-8" class="banorte-form-grid" id="banorte-pay-form">
        <input type="hidden" name="CONTROL_NUMBER" value="${esc(datos.referencia)}" />
        <input type="hidden" name="ECI" value="${esc(datos.eci)}" />
        <input type="hidden" name="STATUS_3D" value="${esc(datos.status3d || '200')}" />
        <input type="hidden" name="XID" value="${esc(datos.xid)}" />
        <input type="hidden" name="CAVV" value="${esc(datos.cavv)}" />
        <input type="hidden" name="VERSION_3D" value="2" />
        <input type="hidden" name="AMOUNT" value="${esc(datos.montoFmt)}" />
        <input type="hidden" name="ALUMNO_NIVEL" value="${esc(String(datos.nivel))}" />
        <div class="banorte-field">
          <label for="CUSTOMER_REF1">Nombre del cliente (máx. 28 caracteres)</label>
          <input type="text" name="CUSTOMER_REF1" id="CUSTOMER_REF1" maxlength="28" required placeholder="Como aparece en la tarjeta" value="${esc(nombre)}" />
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
          <a href="${esc(urlPortalPagosAlumno())}" class="banorte-btn banorte-btn--ghost">Volver al portal</a>
        </div>
      </form>
      <p class="banorte-secure-note"><span aria-hidden="true">🔒</span> Comercio electrónico Banorte · cargo seguro vía Payworks.</p>
    </section>
    ${scriptPersistenciaTarjeta(datos.referencia)}
    ${scriptDebugBanorte(datos, opts)}`

  return htmlShellBanorte('Comercio electrónico', 2, contenido, '/portal-pagos/banorte/comercio.png')
}
