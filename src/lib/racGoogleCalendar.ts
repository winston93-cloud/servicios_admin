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
