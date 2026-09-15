import { createDbAdmin } from '@/lib/insforgeAdmin'
import { enviarCorreoMasivo, urlBaseCorreos } from '@/lib/emailServicios'
import { etiquetaTipoReporte } from '@/lib/racCatalogo'
import { escapeHtml, htmlCorreoRac } from '@/lib/racCorreo'

export type RacPanelEnvio = 'secundaria' | 'primaria' | 'maternal-kinder'

function emailInstitucionalPorPanel(panel: RacPanelEnvio, perfilId: number): string | null {
  if (perfilId === 4) {
    if (panel === 'maternal-kinder') return 'psicologia.kinder@winston93.edu.mx'
    if (panel === 'primaria') return 'psicologia.primaria@winston93.edu.mx'
    return 'psicologia.secundaria@winston93.edu.mx'
  }
  if (perfilId === 5) {
    if (panel === 'secundaria') return 'prefectura.secundaria@winston93.edu.mx'
    return null
  }
  if (perfilId === 6 || perfilId === 2) {
    if (panel === 'secundaria') return 'coordsec.iwc@winston93.edu.mx'
    return null
  }
  return null
}

export function instruccionesReenvioPanel(
  panel: RacPanelEnvio,
  tipoReporte: number
): { url: string; pasosHtml: string; pestaña: string } {
  const base = urlBaseCorreos()
  if (panel === 'maternal-kinder') {
    const url = `${base}/reportes-conducta/maternal-kinder`
    const pestaña = tipoReporte === 8 ? 'Avisos de atención' : 'Listado / bandeja'
    return {
      url,
      pestaña,
      pasosHtml: `<ol style="margin:8px 0 0;padding-left:1.25rem;line-height:1.55">
        <li>Entra a <b>Reportes académicos y de conducta</b> → <b>Maternal / Kinder</b>.</li>
        <li>Abre la pestaña <b>${escapeHtml(pestaña)}</b>.</li>
        <li>En la fila del alumno, pulsa <b>Enviar</b> (si aún no salió) o <b>Reenviar</b>.</li>
      </ol>`,
    }
  }
  if (panel === 'primaria') {
    const url = `${base}/reportes-conducta/primaria`
    const pestaña = tipoReporte === 8 ? 'Avisos de atención' : 'Listado / bandeja'
    return {
      url,
      pestaña,
      pasosHtml: `<ol style="margin:8px 0 0;padding-left:1.25rem;line-height:1.55">
        <li>Entra a <b>Reportes académicos y de conducta</b> → <b>Primaria</b>.</li>
        <li>Abre la pestaña <b>${escapeHtml(pestaña)}</b>.</li>
        <li>En la fila del alumno, pulsa <b>Enviar</b> o <b>Reenviar</b>.</li>
      </ol>`,
    }
  }
  const url = `${base}/reportes-conducta/secundaria`
  const pestaña = tipoReporte === 8 ? 'Avisos de atención' : tipoReporte === 5 ? 'Informes' : 'Listado'
  return {
    url,
    pestaña,
    pasosHtml: `<ol style="margin:8px 0 0;padding-left:1.25rem;line-height:1.55">
      <li>Entra a <b>Reportes académicos y de conducta</b> → <b>Secundaria</b>.</li>
      <li>Abre la pestaña <b>${escapeHtml(pestaña)}</b>.</li>
      <li>En la fila del alumno, pulsa <b>Enviar</b> o <b>Reenviar</b>.</li>
    </ol>`,
  }
}

async function emailsStaffDeReporte(opts: {
  perfilId: number
  usuarioId: number
  panel: RacPanelEnvio
}): Promise<string[]> {
  const db = createDbAdmin()
  const out: string[] = []
  if (opts.perfilId === 1) {
    const { data } = await db
      .from('boleta_maestro')
      .select('maestro_email')
      .eq('maestro_id', opts.usuarioId)
      .maybeSingle()
    const email = String(data?.maestro_email ?? '')
      .trim()
      .toLowerCase()
    if (email.includes('@')) out.push(email)
  } else {
    const { data } = await db
      .from('usuario')
      .select('usuario_email')
      .eq('usuario_id', opts.usuarioId)
      .maybeSingle()
    const email = String(data?.usuario_email ?? '')
      .trim()
      .toLowerCase()
    if (email.includes('@')) out.push(email)
  }
  const institucional = emailInstitucionalPorPanel(opts.panel, opts.perfilId)
  if (institucional) out.push(institucional.toLowerCase())
  return [...new Set(out)]
}

/**
 * Cuando falla el correo a la familia, avisa a la cuenta institucional
 * (y al correo del usuario que capturó, si existe) con instrucciones de reenvío.
 */
export async function avisarStaffFalloEnvioRac(opts: {
  panel: RacPanelEnvio
  perfilId: number
  usuarioId: number
  alumnoNombre: string
  alumnoRef: string | number
  tipoReporte: number
  motivoError: string
  reporteId?: number
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const to = await emailsStaffDeReporte({
      panel: opts.panel,
      perfilId: opts.perfilId,
      usuarioId: opts.usuarioId,
    })
    if (!to.length) {
      return { ok: false, error: 'Sin correo institucional para avisar el fallo' }
    }
    const tipoLabel = etiquetaTipoReporte(opts.tipoReporte)
    const guia = instruccionesReenvioPanel(opts.panel, opts.tipoReporte)
    const subject = `RAC: no se envió «${tipoLabel}» — ${opts.alumnoNombre}`
    const html = htmlCorreoRac({
      titulo: 'Aviso interno · correo no enviado',
      enlace: guia.url,
      cuerpoHtml: `<p>Hola:</p>
        <p>Se <b>guardó</b> un registro de <b>${escapeHtml(tipoLabel)}</b> en el sistema, pero
        <b>el correo a la familia no salió</b>.</p>
        <p><b>Alumno:</b> ${escapeHtml(opts.alumnoNombre)}
        (control ${escapeHtml(String(opts.alumnoRef ?? ''))})
        ${opts.reporteId ? ` · folio interno ${opts.reporteId}` : ''}.</p>
        <p><b>Motivo técnico:</b> ${escapeHtml(opts.motivoError || 'error de envío')}</p>
        <p>Puedes enviarlo o reenviarlo desde el panel:</p>
        ${guia.pasosHtml}
        <p style="margin-top:14px">Enlace directo al módulo:
        <a href="${escapeHtml(guia.url)}">${escapeHtml(guia.url)}</a></p>`,
    })
    return enviarCorreoMasivo({
      to,
      subject,
      html,
      nivel: opts.panel === 'maternal-kinder' ? 2 : opts.panel === 'primaria' ? 3 : 4,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo avisar al staff' }
  }
}
