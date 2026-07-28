import { supabase } from '@/lib/insforge'
import {
  construirNombreCompleto,
  grupoALetra,
} from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import {
  enviarCorreoMasivo,
  brandingCorreoPorNivel,
  remitenteCorreoInstitucional,
} from '@/lib/emailServicios'

/** Mismos BCC internos que el legacy control_escolar/cambiar.php (familia comentada). */
const DESTINATARIOS_BIENVENIDA = [
  'alexx_mario33@hotmail.com',
  'isc.escobedo@gmail.com',
  'sistemas.desarrollo@winston93.edu.mx',
]

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

function htmlBienvenida(opts: {
  alumno: AlumnoControlEscolar
  nombreCompleto: string
  autorizadoPor: string
}): string {
  const { alumno, nombreCompleto, autorizadoPor } = opts
  const nivel = Number(alumno.alumno_nivel) || 3
  const { nombreInstitucion, logoUrl, logoAlt } = brandingCorreoPorNivel(nivel)
  const coordinacion =
    nivel <= 2 ? 'COORDINACIÓN KINDER' : nivel === 3 ? 'COORDINACIÓN PRIMARIA' : 'COORDINACIÓN SECUNDARIA'
  const from = remitenteCorreoInstitucional()

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.55;font-size:14px;">
  <p>Por medio del presente le damos la más cordial bienvenida.</p>
  <p>
    La documentación de <strong>${escapeHtml(nombreCompleto)}</strong>
    (ref. ${escapeHtml(String(alumno.alumno_ref))}) quedó marcada como completa.
    Ya puede imprimir su recibo final con código QR en el portal de inscripciones.
  </p>
  <p style="margin:20px 0 8px;color:#64748b;font-size:0.85rem;">
    Autorizado por: ${escapeHtml(autorizadoPor)} · ${escapeHtml(from)}
  </p>
  <p align="center" style="margin-top:28px;">
    <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(logoAlt)}" style="max-height:72px;" /><br><br>
    <span style="color:#6aa84f;font-size:16px;">${escapeHtml(nombreInstitucion)}</span><br>
    <span style="color:#073763;font-size:15px;">${escapeHtml(coordinacion)}</span><br>
    <strong style="color:#B00;font-size:12px;">Este correo ha sido enviado de manera automática; no responder.</strong>
  </p>
</body>
</html>`
}

/**
 * Autoriza documentación completa: inserta en `a_inscritos` (desbloquea recibo final)
 * y envía aviso de bienvenida (BCC internos, como el legacy).
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
    // Carrera: otro usuario autorizó al mismo tiempo.
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
  const correo = await enviarCorreoMasivo({
    to: DESTINATARIOS_BIENVENIDA,
    subject: 'Correo de Bienvenida',
    html: htmlBienvenida({ alumno, nombreCompleto, autorizadoPor }),
    nivel,
  })

  const nivelLbl = etiquetaNivelEscolar(alumno.alumno_nivel) || '—'
  const gradoLbl =
    etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado) || '—'
  const grupoLbl = grupoALetra(alumno.alumno_grupo) ?? '—'

  if (!correo.ok) {
    return {
      ok: true,
      correoEnviado: false,
      errorCorreo: correo.error,
      message: `${nombreCompleto} (${nivelLbl} · ${gradoLbl} · ${grupoLbl}): registro guardado, pero el correo de bienvenida falló.`,
      alumnoNombre: nombreCompleto,
      ctrl,
    }
  }

  return {
    ok: true,
    correoEnviado: true,
    message: `${nombreCompleto} (${nivelLbl} · ${gradoLbl} · ${grupoLbl}): documentación autorizada y correo de bienvenida enviado.`,
    alumnoNombre: nombreCompleto,
    ctrl,
  }
}
