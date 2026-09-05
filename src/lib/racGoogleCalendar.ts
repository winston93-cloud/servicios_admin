/**
 * Sync de citas RAC → Google Calendar (misma cuenta de servicio que AgendaW).
 * Destino por defecto: calendario de psicología secundaria.
 */
import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

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

export type RacCalendarEventInput = {
  summary: string
  description?: string
  date: string
  time: string
  durationMinutes?: number
}

/** Crea evento en el calendario de Psicología Secundaria (AgendaW). */
export async function createRacCitaCalendarEvent(
  eventData: RacCalendarEventInput
): Promise<{ ok: boolean; eventId?: string; error?: string; skipped?: boolean }> {
  const calendarId = process.env.GOOGLE_CALENDAR_PSICOLOGA_SECUNDARIA?.trim()
  if (!calendarId) {
    return { ok: false, skipped: true, error: 'Sin GOOGLE_CALENDAR_PSICOLOGA_SECUNDARIA' }
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
