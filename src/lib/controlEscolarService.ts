import { supabase } from '@/lib/insforge'
import {
  construirNombreCompleto,
  grupoALetra,
} from '@/lib/alumnoBusquedaServicios'
import { TUTOR_ID_MADRE, TUTOR_ID_PADRE } from '@/lib/alumnoFamiliarTutor'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import {
  enviarCorreoMasivo,
  type AdjuntoCorreo,
} from '@/lib/emailServicios'
import fs from 'node:fs'
import path from 'node:path'

const URL_PORTAL_SERVICIOS = 'https://servicios-admin.vercel.app'
const CID_CONFETI = 'confeti-bienvenida@winston'

function archivoConfetiPorNivel(nivel: number): string {
  return Number(nivel) <= 2 ? 'confeti-educativo.gif' : 'confeti.gif'
}

function urlConfetiHosted(nivel: number): string {
  return `${URL_PORTAL_SERVICIOS}/control-escolar/${archivoConfetiPorNivel(nivel)}`
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export type AlumnoControlEscolar = {
  alumno_id: number
  alumno_ref: string
  alumno_nombre: string
  alumno_app: string
  alumno_apm: string
  alumno_nivel: number
  alumno_grado: string | number | null
  alumno_grupo: string | number | null
  alumno_status: number | null
  alumno_ciclo_escolar: string | number | null
  alumno_nuevo_ingreso: number | null
}

export type ResultadoAutorizacionDocs = {
  ok: boolean
  message: string
  yaExistia?: boolean
  correoEnviado?: boolean
  errorCorreo?: string
  alumnoNombre?: string
  ctrl?: string
  destinatarios?: string[]
}

/** Últimos 5 dígitos de la referencia — misma clave que `enReciboFinal` del portal. */
export function ctrlDesdeAlumnoRef(alumnoRef: string | number): string {
  return String(alumnoRef).replace(/\D/g, '').slice(-5)
}

function fechaLegacyDdMmYyyy(d = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Imágenes del pie legacy (`fondoe.png` / `fondow.png`) — URL pública del hosting escolar. */
export function urlPieCorreoBienvenida(nivel: number): string {
  const archivo = nivel <= 2 ? 'fondoe.png' : 'fondow.png'
  // Mismas URLs que control_escolar/cambiar.php (fiables en clientes de correo).
  // Copia local en public/control-escolar/ por si se retira el PHP.
  return `https://www.winston93.edu.mx/control_escolar/${archivo}`
}

function coordinacionPorNivel(nivel: number): string {
  if (nivel <= 2) return 'COORDINACIÓN KINDER'
  if (nivel === 3) return 'COORDINACIÓN PRIMARIA'
  return 'COORDINACIÓN SECUNDARIA'
}

function institucionPorNivel(nivel: number): string {
  return nivel <= 2 ? 'INSTITUTO EDUCATIVO WINSTON' : 'INSTITUTO WINSTON CHURCHILL'
}

/**
 * Banner animado: imagen legacy (fondoe/fondow) ampliada de fondo + confeti encima.
 * Incrustado inline (cid) porque el JS no corre en clientes de correo.
 */
export function htmlCorreoBienvenidaControlEscolar(nivel: number): string {
  const n = Number(nivel) || 3
  const institucion = institucionPorNivel(n)
  const coord = coordinacionPorNivel(n)
  const portal = URL_PORTAL_SERVICIOS
  const confetiHosted = urlConfetiHosted(n)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bienvenida</title>
</head>
<body style="margin:0;padding:0;background:#fff8f0;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff8f0;">
    <tr>
      <td align="center" style="padding:12px 8px;">
        <table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #fde68a;">
          <tr>
            <td align="center" style="padding:0;background:#fffbeb;line-height:0;">
              <!-- Fondo institucional completo (sin recorte) + confeti -->
              <img src="cid:${CID_CONFETI}" alt="¡Felicidades!" width="680" style="display:block;width:100%;max-width:680px;height:auto;border:0;" />
              <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
                <img src="${escapeHtml(confetiHosted)}" alt="" width="1" height="1" />
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 28px 8px;">
              <p style="margin:0;font-size:30px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">
                ¡Felicidades!
              </p>
              <p style="margin:8px 0 0;font-size:16px;font-weight:600;color:#b45309;">
                Ya formas parte de la comunidad Winston
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 8px;font-size:15px;line-height:1.65;color:#334155;">
              <p style="margin:0 0 14px;">
                Por medio del presente le damos la más cordial bienvenida.
              </p>
              <p style="margin:0 0 18px;">
                Ya puede imprimir su <strong>recibo final con código QR</strong> en el portal de Servicios Administrativos:
              </p>
              <p style="margin:0 0 22px;text-align:center;">
                <a href="${escapeHtml(portal)}" target="_blank" rel="noopener noreferrer"
                  style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">
                  Abrir portal · Recibo final
                </a>
              </p>
              <p style="margin:0;text-align:center;font-size:13px;color:#64748b;">
                <a href="${escapeHtml(portal)}" style="color:#0369a1;word-break:break-all;">${escapeHtml(portal)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 24px 28px;">
              <font size="4" style="color:#6aa84f;font-family:helvetica;">${escapeHtml(institucion)}<br>
              <font size="4" style="color:#073763;font-family:helvetica;">${escapeHtml(coord)}<br>
              <i><strong style="color:#B00;font-size:12px;">Este correo ha sido enviado de manera automática, no responder este correo porque no será leído.</strong></i></font></font>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function adjuntoConfetiBienvenida(nivel = 3): AdjuntoCorreo | null {
  const archivo = archivoConfetiPorNivel(nivel)
  const candidatos = [
    path.join(process.cwd(), 'public/control-escolar', archivo),
    path.join(process.cwd(), 'public', 'control-escolar', archivo),
  ]
  for (const p of candidatos) {
    try {
      if (fs.existsSync(p)) {
        return {
          filename: archivo,
          content: fs.readFileSync(p),
          contentType: 'image/gif',
          cid: CID_CONFETI,
          contentDisposition: 'inline',
        }
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

export async function alumnoDocumentacionAutorizada(
  alumnoRef: string | number
): Promise<boolean> {
  const ctrl = ctrlDesdeAlumnoRef(alumnoRef)
  if (!ctrl) return false

  const { count, error } = await supabase
    .from('a_inscritos')
    .select('ctrl', { count: 'exact', head: true })
    .eq('ctrl', ctrl)

  if (error) {
    console.error('a_inscritos consulta:', error)
    return false
  }
  return (count ?? 0) > 0
}

async function cargarAlumnoPorRef(ref: string): Promise<AlumnoControlEscolar | null> {
  const { data, error } = await supabase
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar, alumno_nuevo_ingreso'
    )
    .eq('alumno_ref', ref)
    .order('alumno_ciclo_escolar', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error cargando alumno control escolar:', error)
    throw new Error(error.message)
  }

  const row = (data ?? [])[0]
  return row ? (row as AlumnoControlEscolar) : null
}

/** Correos de mamá/papá con `familiar_recibir_email = 1` (mismo criterio que correo masivo). */
export async function emailsPadresParaBienvenida(
  alumnoId: number
): Promise<string[]> {
  const { data, error } = await supabase
    .from('alumno_familiar')
    .select('familiar_email, tutor_id, familiar_recibir_email, familiar_nombre')
    .eq('alumno_id', alumnoId)
    .in('tutor_id', [TUTOR_ID_MADRE, TUTOR_ID_PADRE])
    .eq('familiar_recibir_email', 1)
    .order('familiar_id', { ascending: true })

  if (error) {
    console.error('Error emails padres bienvenida:', error)
    return []
  }

  const emails: string[] = []
  for (const row of data ?? []) {
    const email = String(row.familiar_email ?? '').trim()
    if (!emailValido(email)) continue
    if (!emails.includes(email.toLowerCase())) {
      emails.push(email.toLowerCase())
    }
  }
  return emails
}

/**
 * Autoriza documentación completa: inserta en `a_inscritos` (desbloquea recibo final)
 * y envía correo de bienvenida a papás (buzón de correos masivos).
 */
export async function autorizarDocumentacionCompleta(opts: {
  alumnoRef: string
  autorizadoPor: string
  documentacionCompleta: boolean
}): Promise<ResultadoAutorizacionDocs> {
  const ref = String(opts.alumnoRef ?? '').trim()
  const autorizadoPor = opts.autorizadoPor.trim() || 'Usuario no identificado'

  if (!ref) {
    return { ok: false, message: 'Indica la referencia / No. de control del alumno.' }
  }
  if (!opts.documentacionCompleta) {
    return {
      ok: false,
      message: 'Debes marcar «Documentación completa» para guardar la autorización.',
    }
  }

  const alumno = await cargarAlumnoPorRef(ref)
  if (!alumno) {
    return { ok: false, message: 'No. de control / referencia incorrecto.' }
  }

  const ctrl = ctrlDesdeAlumnoRef(alumno.alumno_ref)
  if (!ctrl) {
    return { ok: false, message: 'La referencia del alumno no es válida.' }
  }

  const nombreCompleto = construirNombreCompleto(
    alumno.alumno_nombre,
    alumno.alumno_app,
    alumno.alumno_apm
  )
  const yaOk = await alumnoDocumentacionAutorizada(ctrl)
  if (yaOk) {
    return {
      ok: true,
      yaExistia: true,
      message: `${nombreCompleto}: la documentación ya estaba autorizada (recibo final habilitado).`,
      alumnoNombre: nombreCompleto,
      ctrl,
    }
  }

  const fecha = fechaLegacyDdMmYyyy()
  const nombreRegistro = `${nombreCompleto}   < Registro Guardado >`
  const { error: insertError } = await supabase.from('a_inscritos').insert({
    codigo: nombreRegistro,
    fecha,
    ctrl,
    nombre: nombreRegistro,
    estatus: 'Documentos Completos',
    autorizado_por: autorizadoPor,
  })

  if (insertError) {
    if (/unique|duplicate/i.test(insertError.message)) {
      return {
        ok: true,
        yaExistia: true,
        message: `${nombreCompleto}: la documentación ya estaba autorizada.`,
        alumnoNombre: nombreCompleto,
        ctrl,
      }
    }
    console.error('a_inscritos insert:', insertError)
    return {
      ok: false,
      message:
        insertError.message.includes('a_inscritos') || insertError.code === '42P01'
          ? 'Falta la tabla a_inscritos en InsForge. Ejecuta: node scripts/apply-insforge-sql.mjs migrations/20260728120000_a_inscritos_control_escolar.sql'
          : insertError.message,
    }
  }

  const nivel = Number(alumno.alumno_nivel) || 3
  const nivelLbl = etiquetaNivelEscolar(alumno.alumno_nivel) || '—'
  const gradoLbl =
    etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado) || '—'
  const grupoLbl = grupoALetra(alumno.alumno_grupo) ?? '—'

  const destinatarios = await emailsPadresParaBienvenida(alumno.alumno_id)
  if (!destinatarios.length) {
    return {
      ok: true,
      correoEnviado: false,
      errorCorreo: 'Sin correo de mamá/papá con recibir email activo',
      message: `${nombreCompleto} (${nivelLbl} · ${gradoLbl} · ${grupoLbl}): documentación autorizada, pero no hay correo de padres para enviar la bienvenida.`,
      alumnoNombre: nombreCompleto,
      ctrl,
      destinatarios: [],
    }
  }

  const confeti = adjuntoConfetiBienvenida(nivel)
  const correo = await enviarCorreoMasivo({
    to: destinatarios,
    subject: 'Correo de Bienvenida',
    html: htmlCorreoBienvenidaControlEscolar(nivel),
    nivel,
    attachments: confeti ? [confeti] : undefined,
  })

  if (!correo.ok) {
    return {
      ok: true,
      correoEnviado: false,
      errorCorreo: correo.error,
      destinatarios,
      message: `${nombreCompleto} (${nivelLbl} · ${gradoLbl} · ${grupoLbl}): registro guardado, pero el correo de bienvenida falló.`,
      alumnoNombre: nombreCompleto,
      ctrl,
    }
  }

  return {
    ok: true,
    correoEnviado: true,
    destinatarios,
    message: `${nombreCompleto} (${nivelLbl} · ${gradoLbl} · ${grupoLbl}): documentación autorizada y correo de bienvenida enviado a papás.`,
    alumnoNombre: nombreCompleto,
    ctrl,
  }
}

/** Solo para prueba manual: envía el HTML de bienvenida sin tocar a_inscritos. */
export async function enviarPruebaCorreoBienvenida(opts: {
  to: string
  nivel?: number
}): Promise<{ ok: boolean; error?: string }> {
  const nivel = opts.nivel ?? 3
  const confeti = adjuntoConfetiBienvenida(nivel)
  const result = await enviarCorreoMasivo({
    to: [opts.to],
    subject: '[PRUEBA] Correo de Bienvenida — Control Escolar',
    html: htmlCorreoBienvenidaControlEscolar(nivel),
    nivel,
    attachments: confeti ? [confeti] : undefined,
  })
  return { ok: result.ok, error: result.error }
}
