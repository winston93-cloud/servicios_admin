/**
 * Aviso a padres: beca activada tras firma electrónica en servicios_admin.
 */
import type { AppDatabaseClient } from '@/lib/dbTypes'
import { obtenerAlumnoPorId } from '@/lib/alumnoDatosService'
import { enviarCorreoMasivo } from '@/lib/emailServicios'
import type { AutorizacionFirmaRow } from './autorizacionFirmaService'
import { cicloBecaARenovarFirma, etiquetaCicloFirmaBeca } from './cicloFirmaBeca'
import {
  buildBecaActivadaEmailHtml,
  buildBecaActivadaEmailSubject,
  portalServiciosDashboardUrl,
} from './emailBecaActivada'

const REFS_PRUEBA = new Set([29904, 29903, 29902, 29901])
const EMAIL_PRUEBA =
  process.env.BECAS_EMAIL_ACCESO_FAMILIA?.trim() || 'isc.escobedo@gmail.com'

const NOMBRES_PRUEBA = ['ALAN', 'RUBEN', 'RUBÉN', 'LUIS', 'JUAN'] as const

function emailValido(raw: unknown): string | null {
  const e = String(raw || '')
    .trim()
    .toLowerCase()
  if (!e || !e.includes('@') || e.length < 5) return null
  return e
}

function esAlumnoPrueba(opts: {
  alumno_ref?: string | number | null
  alumno_app?: string | null
  alumno_apm?: string | null
  alumno_nombre?: string | null
}): boolean {
  const ref = Number(opts.alumno_ref)
  if (Number.isFinite(ref) && REFS_PRUEBA.has(ref)) return true
  const parts = [opts.alumno_app, opts.alumno_apm, opts.alumno_nombre]
    .map((p) => (p != null ? String(p).trim().toUpperCase() : ''))
    .filter(Boolean)
  const joined = parts.join(' ')
  const pruebas = (joined.match(/\bPRUEBA\b/g) || []).length
  if (pruebas < 2) return false
  return NOMBRES_PRUEBA.some((n) => joined.includes(n) || parts.includes(n))
}

async function fetchEmailsPadres(
  db: AppDatabaseClient,
  alumnoId: number
): Promise<string[]> {
  const { data, error } = await db
    .from('alumno_familiar')
    .select('tutor_id, familiar_email')
    .eq('alumno_id', alumnoId)
    .in('tutor_id', [1, 2])

  if (error) throw new Error(error.message)

  const seen = new Set<string>()
  const out: string[] = []
  for (const row of data || []) {
    const em = emailValido(row.familiar_email)
    if (!em || seen.has(em)) continue
    seen.add(em)
    out.push(em)
  }
  return out
}

function labelNivel(nivel: number | null | undefined): string {
  const n = Number(nivel)
  if (n === 1) return 'Maternal'
  if (n === 2) return 'Kinder'
  if (n === 3) return 'Primaria'
  if (n === 4) return 'Secundaria'
  return '—'
}

function labelGrado(nivel: number, grado: number | null | undefined): string {
  const g = Number(grado)
  if (!Number.isFinite(g)) return '—'
  if (nivel === 1) return g === 1 ? 'Maternal A' : 'Maternal B'
  if (nivel === 2) return `Kinder ${g}°`
  if (nivel === 3 && g >= 1 && g <= 6) return `${g}° Primaria`
  if (nivel === 4 && g >= 1 && g <= 3) return `${g}° Secundaria`
  return String(g)
}

function labelGrupo(grupo: number | string | null | undefined): string {
  if (grupo == null || grupo === '') return '—'
  const n = Number(grupo)
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return 'sin grupo asignado'
  if (n === 1) return 'A'
  if (n === 2) return 'B'
  if (n === 3) return 'C'
  return '—'
}

async function resolverPorcentajeBeca(
  db: AppDatabaseClient,
  auth: AutorizacionFirmaRow
): Promise<string> {
  if (auth.flujo === 'solicitud') {
    const { data } = await db
      .from('becas_solicitud')
      .select('beca_porcentaje_deseado')
      .eq('id', auth.expediente_id)
      .maybeSingle()
    const pct = Number(data?.beca_porcentaje_deseado ?? NaN)
    if (Number.isFinite(pct)) return `${Math.round(pct)}%`
  }

  const cicloOrigen = cicloBecaARenovarFirma()
  const { data: origen } = await db
    .from('alumno_beca')
    .select('beca_porcentaje')
    .eq('alumno_id', auth.alumno_id)
    .eq('beca_ciclo_escolar', cicloOrigen)
    .maybeSingle()

  const data =
    origen ??
    (
      await db
        .from('alumno_beca')
        .select('beca_porcentaje')
        .eq('alumno_id', auth.alumno_id)
        .maybeSingle()
    ).data

  const pct = Number(data?.beca_porcentaje ?? NaN)
  return Number.isFinite(pct) ? `${Math.round(pct)}%` : '—'
}

export type EmailAvisoBecaActivadaResult = {
  ok: boolean
  messageId?: string
  to?: string
  error?: string
}

export async function enviarAvisoBecaActivada(opts: {
  db: AppDatabaseClient
  auth: AutorizacionFirmaRow
  firmadoPor: string
}): Promise<EmailAvisoBecaActivadaResult> {
  const alumno = await obtenerAlumnoPorId(opts.auth.alumno_id)
  if (!alumno) {
    return { ok: false, error: 'Alumno no encontrado para aviso por correo.' }
  }

  const nombreCompleto = [alumno.alumno_app, alumno.alumno_apm, alumno.alumno_nombre]
    .map((p) => (p != null ? String(p).trim() : ''))
    .filter(Boolean)
    .join(' ')

  const nivel = Number(alumno.alumno_nivel)
  const grado = labelGrado(nivel, Number(alumno.alumno_grado))
  const grupo = labelGrupo(alumno.alumno_grupo)
  const porcentajeBeca = await resolverPorcentajeBeca(opts.db, opts.auth)

  const emailData = {
    alumnoNombre: nombreCompleto || 'Sin nombre',
    alumnoRef: String(alumno.alumno_ref ?? ''),
    nivelLabel: labelNivel(nivel),
    gradoGrupo: `${grado} / ${grupo}`,
    cicloLabel: etiquetaCicloFirmaBeca(opts.auth.ciclo_escolar),
    firmadoPor: opts.firmadoPor.trim(),
    porcentajeBeca,
    portalUrl: portalServiciosDashboardUrl(),
  }

  let destinatarios: string[]
  if (
    esAlumnoPrueba({
      alumno_ref: alumno.alumno_ref,
      alumno_app: alumno.alumno_app,
      alumno_apm: alumno.alumno_apm,
      alumno_nombre: alumno.alumno_nombre,
    })
  ) {
    destinatarios = [EMAIL_PRUEBA]
  } else {
    destinatarios = await fetchEmailsPadres(opts.db, opts.auth.alumno_id)
  }

  if (!destinatarios.length) {
    return {
      ok: false,
      error: 'No hay correo de padre/madre registrado para este alumno.',
    }
  }

  const sent = await enviarCorreoMasivo({
    to: destinatarios,
    subject: buildBecaActivadaEmailSubject(emailData),
    html: buildBecaActivadaEmailHtml(emailData),
    nivel: nivel,
  })

  if (!sent.ok) {
    return {
      ok: false,
      to: destinatarios.join(', '),
      error: sent.error || 'Error SMTP',
    }
  }

  return {
    ok: true,
    messageId: sent.messageId,
    to: destinatarios.join(', '),
  }
}
