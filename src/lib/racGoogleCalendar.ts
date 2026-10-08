/**
 * Sync de citas RAC → Google Calendar (misma cuenta de servicio y calendarios que AgendaW).
 * Un calendario por psicóloga de nivel:
 * - maternal/kinder → GOOGLE_CALENDAR_PSICOLOGA_EDUCATIVO
 * - primaria → GOOGLE_CALENDAR_PSICOLOGA_PRIMARIA
 * - secundaria → GOOGLE_CALENDAR_PSICOLOGA_SECUNDARIA
 */
import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

export type RacPsicologaCalendarLevel =
  | 'maternal'
  | 'kinder'
  | 'maternal-kinder'
  | 'educativo'
  | 'primaria'
  | 'secundaria'

function getAuthClient(impersonateEmail: string) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!email || !privateKey) {
    throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  }
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: SCOPES,
    subject: impersonateEmail,
  })
}

function formatLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

/** Mismo mapeo que AgendaW `getPsicologaCalendarId`. */
export function getRacPsicologaCalendarId(level: RacPsicologaCalendarLevel): string | null {
  if (level === 'maternal' || level === 'kinder' || level === 'maternal-kinder' || level === 'educativo') {
    return process.env.GOOGLE_CALENDAR_PSICOLOGA_EDUCATIVO?.trim() || null
  }
  if (level === 'primaria') {
    return process.env.GOOGLE_CALENDAR_PSICOLOGA_PRIMARIA?.trim() || null
  }
  if (level === 'secundaria') {
    return process.env.GOOGLE_CALENDAR_PSICOLOGA_SECUNDARIA?.trim() || null
  }
  return null
}

export function etiquetaNivelRacCalendar(level: RacPsicologaCalendarLevel): string {
  if (level === 'maternal' || level === 'kinder' || level === 'maternal-kinder' || level === 'educativo') {
    return 'Maternal / Kinder'
  }
  if (level === 'primaria') return 'Primaria'
  return 'Secundaria'
}

export type RacCalendarEventInput = {
  summary: string
  description?: string
  date: string
  time: string
  durationMinutes?: number
  /** Nivel del módulo RAC / AgendaW. Default secundaria (compat). */
  level?: RacPsicologaCalendarLevel
}

/** Crea evento en el calendario de psicología del nivel indicado. */
export async function createRacCitaCalendarEvent(
  eventData: RacCalendarEventInput
): Promise<{ ok: boolean; eventId?: string; error?: string; skipped?: boolean }> {
  const level = eventData.level ?? 'secundaria'
  const calendarId = getRacPsicologaCalendarId(level)
  if (!calendarId) {
    return {
      ok: false,
      skipped: true,
      error: `Sin calendar ID para nivel ${level}`,
    }
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return { ok: false, skipped: true, error: 'Sin credenciales Google Service Account' }
  }

  try {
    const auth = getAuthClient(calendarId)
    const calendar = google.calendar({ version: 'v3', auth })
    const timezone = 'America/Monterrey'
    const duration = eventData.durationMinutes ?? 45
    const [hour, minute] = eventData.time.split(':').map(Number)
    const startDate = new Date(`${eventData.date}T00:00:00`)
    startDate.setHours(hour, minute || 0, 0, 0)
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000)

    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: eventData.summary,
        description: eventData.description,
        start: { dateTime: formatLocal(startDate), timeZone: timezone },
        end: { dateTime: formatLocal(endDate), timeZone: timezone },
      },
    })
    return { ok: true, eventId: response.data.id ?? undefined }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[racGoogleCalendar] create error:', msg)
    return { ok: false, error: msg }
  }
}

/** Agenda de Dirección secundaria: citas que agendan los maestros. La asistente va como invitada. */
export const RAC_DIRECCION_SEC_CALENDAR = 'direccion.secundaria@winston93.edu.mx'
export const RAC_DIRECCION_SEC_INVITADOS = ['asistente.secundaria@winston93.edu.mx']

function rangoCita(date: string, time: string, durationMinutes: number) {
  const [hour, minute] = time.split(':').map(Number)
  const start = new Date(`${date}T00:00:00`)
  start.setHours(hour, minute || 0, 0, 0)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  return { start, end }
}

function calendarDireccion() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) return null
  return google.calendar({ version: 'v3', auth: getAuthClient(RAC_DIRECCION_SEC_CALENDAR) })
}

/** Eventos de Dirección que se cruzan con el horario (para avisar empalme). null = no se pudo revisar. */
export async function empalmesDireccionSec(
  date: string,
  time: string,
  durationMinutes = 45
): Promise<{ resumen: string; inicio: string; fin: string }[] | null> {
  const calendar = calendarDireccion()
  if (!calendar) return null
  const { start, end } = rangoCita(date, time, durationMinutes)
  const tz = '-06:00'
  try {
    const res = await calendar.events.list({
      calendarId: RAC_DIRECCION_SEC_CALENDAR,
      timeMin: `${formatLocal(start)}${tz}`,
      timeMax: `${formatLocal(end)}${tz}`,
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: 'America/Monterrey',
      maxResults: 20,
    })
    return (res.data.items ?? [])
      .filter((ev) => ev.status !== 'cancelled' && ev.transparency !== 'transparent' && ev.start?.dateTime)
      .map((ev) => ({
        resumen: ev.summary || 'Ocupado',
        inicio: String(ev.start?.dateTime ?? '').slice(11, 16),
        fin: String(ev.end?.dateTime ?? '').slice(11, 16),
      }))
  } catch (e) {
    console.warn('[racGoogleCalendar] empalmes Dirección:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function crearCitaDireccionSec(eventData: {
  summary: string
  description?: string
  date: string
  time: string
  durationMinutes?: number
}): Promise<{ ok: boolean; eventId?: string; error?: string; skipped?: boolean }> {
  const calendar = calendarDireccion()
  if (!calendar) return { ok: false, skipped: true, error: 'Sin credenciales Google Service Account' }
  const { start, end } = rangoCita(eventData.date, eventData.time, eventData.durationMinutes ?? 45)
  try {
    const response = await calendar.events.insert({
      calendarId: RAC_DIRECCION_SEC_CALENDAR,
      sendUpdates: 'all',
      requestBody: {
        summary: eventData.summary,
        description: eventData.description,
        start: { dateTime: formatLocal(start), timeZone: 'America/Monterrey' },
        end: { dateTime: formatLocal(end), timeZone: 'America/Monterrey' },
        attendees: RAC_DIRECCION_SEC_INVITADOS.map((email) => ({ email })),
      },
    })
    return { ok: true, eventId: response.data.id ?? undefined }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[racGoogleCalendar] crear cita Dirección:', msg)
    return { ok: false, error: msg }
  }
}

export async function moverCitaDireccionSec(
  eventId: string,
  date: string,
  time: string,
  durationMinutes = 45
): Promise<boolean> {
  const calendar = calendarDireccion()
  if (!calendar) return false
  const { start, end } = rangoCita(date, time, durationMinutes)
  try {
    await calendar.events.patch({
      calendarId: RAC_DIRECCION_SEC_CALENDAR,
      eventId,
      sendUpdates: 'all',
      requestBody: {
        start: { dateTime: formatLocal(start), timeZone: 'America/Monterrey' },
        end: { dateTime: formatLocal(end), timeZone: 'America/Monterrey' },
      },
    })
    return true
  } catch (e) {
    console.warn('[racGoogleCalendar] mover cita Dirección:', e instanceof Error ? e.message : e)
    return false
  }
}

export async function cancelarCitaDireccionSec(eventId: string): Promise<boolean> {
  const calendar = calendarDireccion()
  if (!calendar) return false
  try {
    await calendar.events.delete({ calendarId: RAC_DIRECCION_SEC_CALENDAR, eventId, sendUpdates: 'all' })
    return true
  } catch (e) {
    console.warn('[racGoogleCalendar] cancelar cita Dirección:', e instanceof Error ? e.message : e)
    return false
  }
}
