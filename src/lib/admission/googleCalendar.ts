import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

const LEVEL_LABELS: Record<string, string> = {
  maternal: 'Maternal',
  kinder: 'Kinder',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
}

/** Retorna el Calendar ID (correo) de la psicóloga según el nivel educativo */
export function getPsicologaCalendarId(level: string): string | null {
  if (level === 'maternal' || level === 'kinder') {
    return process.env.GOOGLE_CALENDAR_PSICOLOGA_EDUCATIVO ?? null
  }
  if (level === 'primaria') {
    return process.env.GOOGLE_CALENDAR_PSICOLOGA_PRIMARIA ?? null
  }
  if (level === 'secundaria') {
    return process.env.GOOGLE_CALENDAR_PSICOLOGA_SECUNDARIA ?? null
  }
  return null
}

/** Retorna TODOS los Calendar IDs para un nivel (primaria tiene 3, otros solo 1) */
export function getAllCalendarIdsForLevel(level: string): { psicologa: string; controlEscolar?: string; ingles?: string } | null {
  const psicologaId = getPsicologaCalendarId(level)
  if (!psicologaId) return null

  // Primaria: agregar calendars de control escolar e inglés
  if (level === 'primaria') {
    return {
      psicologa: psicologaId,
      controlEscolar: process.env.GOOGLE_CALENDAR_CONTROL_ESCOLAR_PRIMARIA ?? undefined,
      ingles: process.env.GOOGLE_CALENDAR_INGLES_PRIMARIA ?? undefined,
    }
  }

  // Otros niveles: solo psicóloga
  return { psicologa: psicologaId }
}

/** Retorna el Calendar ID (correo) de vinculación según el nivel educativo */
export function getVinculacionCalendarId(level: string): string | null {
  if (level === 'maternal' || level === 'kinder') {
    return process.env.GOOGLE_CALENDAR_VINCULACION_EDUCATIVO ?? null
  }
  // primaria y secundaria comparten plantel Winston
  return process.env.GOOGLE_CALENDAR_VINCULACION_WINSTON ?? null
}

function getAuthClient(impersonateEmail: string) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !privateKey) {
    throw new Error('Faltan variables de entorno de Google Service Account')
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: SCOPES,
    subject: impersonateEmail,
  })
}

export interface CalendarEventData {
  summary: string
  description?: string
  date: string      // 'YYYY-MM-DD'
  time: string      // 'HH:mm' o 'HH:mm:ss'
  durationMinutes?: number
  timezone?: string
}

export async function createCalendarEvent(
  calendarId: string,
  eventData: CalendarEventData
): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  try {
    const auth = getAuthClient(calendarId)
    const calendar = google.calendar({ version: 'v3', auth })

    const timezone = eventData.timezone ?? 'America/Monterrey'
    const duration = eventData.durationMinutes ?? 60
    const [hour, minute] = eventData.time.split(':').map(Number)

    const startDate = new Date(`${eventData.date}T00:00:00`)
    startDate.setHours(hour, minute, 0, 0)
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000)

    const formatLocal = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
    }

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
    console.warn('[googleCalendar] createCalendarEvent error:', msg)
    return { ok: false, error: msg }
  }
}

export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  eventData: CalendarEventData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const auth = getAuthClient(calendarId)
    const calendar = google.calendar({ version: 'v3', auth })

    const timezone = eventData.timezone ?? 'America/Monterrey'
    const duration = eventData.durationMinutes ?? 60
    const [hour, minute] = eventData.time.split(':').map(Number)

    const startDate = new Date(`${eventData.date}T00:00:00`)
    startDate.setHours(hour, minute, 0, 0)
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000)

    const formatLocal = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
    }

    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: {
        summary: eventData.summary,
        description: eventData.description,
        start: { dateTime: formatLocal(startDate), timeZone: timezone },
        end: { dateTime: formatLocal(endDate), timeZone: timezone },
      },
    })

    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[googleCalendar] updateCalendarEvent error:', msg)
    return { ok: false, error: msg }
  }
}

export async function deleteCalendarEvent(
  calendarId: string,
  eventId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const auth = getAuthClient(calendarId)
    const calendar = google.calendar({ version: 'v3', auth })

    await calendar.events.delete({ calendarId, eventId })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[googleCalendar] deleteCalendarEvent error:', msg)
    return { ok: false, error: msg }
  }
}

/** Construye la descripción del evento para una cita de admisión */
export function buildAdmisionEventDescription(data: {
  studentName: string
  level: string
  gradeLevel?: string
  parentName: string
  parentPhone: string
  parentEmail: string
  campus: string
}): string {
  const level = LEVEL_LABELS[data.level] ?? data.level
  const lines = [
    `Alumno: ${data.studentName}`,
    `Nivel: ${level}${data.gradeLevel ? ` - ${data.gradeLevel}` : ''}`,
    `Plantel: ${data.campus}`,
    ``,
    `Tutor: ${data.parentName}`,
    `Teléfono: ${data.parentPhone}`,
    `Correo: ${data.parentEmail}`,
  ]
  return lines.join('\n')
}

/** Construye la descripción del evento para un recorrido */
export function buildRecorridoEventDescription(data: {
  level: string
  parentName: string
  parentPhone: string
  parentEmail: string
  notes?: string
}): string {
  const level = LEVEL_LABELS[data.level] ?? data.level
  const lines = [
    `Nivel: ${level}`,
    ``,
    `Papá/Mamá: ${data.parentName}`,
    `Teléfono: ${data.parentPhone}`,
    `Correo: ${data.parentEmail}`,
  ]
  if (data.notes) lines.push(``, `Notas: ${data.notes}`)
  return lines.join('\n')
}
