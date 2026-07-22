import { supabase } from '@/lib/insforge'
import {
  construirNombreCompleto,
  grupoALetra,
} from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import {
  enviarCorreoMasivo,
  remitenteCorreoInstitucional,
} from '@/lib/emailServicios'

/** Destinatarios de aviso de baja (mismo set que el legacy). */
const DESTINATARIOS_AVISO_BAJA = [
  'isc.escobedo@gmail.com',
  'dg@winston93.edu.mx',
  'sistemas@winston93.edu.mx',
  'sistemas3@winston93.edu.mx',
]

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ahoraMysql(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export type AlumnoParaBaja = {
  alumno_id: number
  alumno_ref: string
  alumno_nombre: string
  alumno_app: string
  alumno_apm: string
  alumno_nivel: number
  alumno_grado: string | number | null
  alumno_grupo: string | number | null
  alumno_status: number
  alumno_ciclo_escolar: string | number | null
}

export type ResultadoBajaAdministrativa = {
  ok: boolean
  message: string
  correoEnviado?: boolean
  errorCorreo?: string
}

async function cargarAlumnoPorRef(ref: string): Promise<AlumnoParaBaja | null> {
  const { data, error } = await supabase
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_ciclo_escolar'
    )
    .eq('alumno_ref', ref)
    .neq('alumno_status', 0)
    .order('alumno_ciclo_escolar', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error cargando alumno para baja:', error)
    throw new Error(error.message)
  }

  const row = (data ?? [])[0]
  return row ? (row as AlumnoParaBaja) : null
}

function htmlAvisoBaja(opts: {
  alumno: AlumnoParaBaja
  realizadoPor: string
  fechaHora: string
}): string {
  const { alumno, realizadoPor, fechaHora } = opts
  const nivel = etiquetaNivelEscolar(alumno.alumno_nivel) || 'Sin definir'
  const grado =
    etiquetaGradoEscolar(alumno.alumno_nivel, alumno.alumno_grado) ||
    String(alumno.alumno_grado ?? '—')
  const grupo = grupoALetra(alumno.alumno_grupo) ?? '—'
  const from = remitenteCorreoInstitucional()

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;color:#1e293b;line-height:1.55;">
  <h2 style="margin:0 0 16px;color:#0f172a;">Baja general procesada</h2>
  <p style="margin:0 0 16px;">Se ha procesado una baja general para el siguiente alumno:</p>
  <p style="margin:0 0 8px;">
    <strong>Nombre:</strong> ${escapeHtml(alumno.alumno_nombre ?? '')}<br>
    <strong>Apellido paterno:</strong> ${escapeHtml(alumno.alumno_app ?? '')}<br>
    <strong>Apellido materno:</strong> ${escapeHtml(alumno.alumno_apm ?? '')}<br>
    <strong>Referencia:</strong> ${escapeHtml(String(alumno.alumno_ref))}<br>
    <strong>Nivel:</strong> ${escapeHtml(nivel)}<br>
    <strong>Grado:</strong> ${escapeHtml(grado)}<br>
    <strong>Grupo:</strong> ${escapeHtml(grupo)}<br>
    <strong>Fecha y hora:</strong> ${escapeHtml(fechaHora)}<br>
    <strong>Baja realizada por:</strong> ${escapeHtml(realizadoPor)}
  </p>
  <p style="margin:20px 0 0;color:#64748b;font-size:0.85rem;">
    Enviado desde ${escapeHtml(from)} (buzón de servicios / envíos masivos).
  </p>
</body>
</html>`
}

/**
 * Baja general: `alumno_status = 0` en todas las filas con esa referencia
 * (comportamiento legacy), luego aviso por el buzón de envíos masivos.
 */
export async function procesarBajaAdministrativa(opts: {
  alumnoRef: string
  realizadoPor: string
}): Promise<ResultadoBajaAdministrativa> {
  const ref = opts.alumnoRef.trim()
  const realizadoPor = opts.realizadoPor.trim() || 'Usuario no identificado'

  if (!ref) {
    return { ok: false, message: 'No se proporcionó la referencia del alumno' }
  }

  const alumno = await cargarAlumnoPorRef(ref)
  if (!alumno) {
    return { ok: false, message: 'No se encontró el alumno o ya está dado de baja' }
  }

  const fechaHora = ahoraMysql()
  const { data: updated, error: updErr } = await supabase
    .from('alumno')
    .update({
      alumno_status: 0,
      alumno_actualizacion: fechaHora,
    })
    .eq('alumno_ref', ref)
    .neq('alumno_status', 0)
    .select('alumno_id')

  if (updErr) {
    console.error('Error actualizando baja:', updErr)
    return { ok: false, message: updErr.message }
  }

  if (!updated?.length) {
    return { ok: false, message: 'No se encontró el alumno o ya está dado de baja' }
  }

  const nombreCompleto = construirNombreCompleto(
    alumno.alumno_nombre,
    alumno.alumno_app,
    alumno.alumno_apm
  )
  const subject = `Baja General - ${nombreCompleto}`
  const html = htmlAvisoBaja({ alumno, realizadoPor, fechaHora })

  const envio = await enviarCorreoMasivo({
    to: DESTINATARIOS_AVISO_BAJA,
    subject,
    html,
    nivel: Number(alumno.alumno_nivel) || 3,
  })

  if (envio.ok) {
    return {
      ok: true,
      message: 'Baja procesada correctamente y correo enviado',
      correoEnviado: true,
    }
  }

  return {
    ok: true,
    message: `Baja procesada correctamente pero hubo un error al enviar el correo: ${envio.error ?? 'desconocido'}`,
    correoEnviado: false,
    errorCorreo: envio.error,
  }
}
