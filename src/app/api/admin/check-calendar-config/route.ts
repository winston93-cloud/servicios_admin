import { NextResponse } from 'next/server'

/**
 * Endpoint de diagnóstico: verifica qué variables de calendar están configuradas
 */
export async function GET() {
  const calendars = {
    psicologa_educativo: !!process.env.GOOGLE_CALENDAR_PSICOLOGA_EDUCATIVO,
    psicologa_primaria: !!process.env.GOOGLE_CALENDAR_PSICOLOGA_PRIMARIA,
    psicologa_secundaria: !!process.env.GOOGLE_CALENDAR_PSICOLOGA_SECUNDARIA,
    vinculacion_educativo: !!process.env.GOOGLE_CALENDAR_VINCULACION_EDUCATIVO,
    vinculacion_winston: !!process.env.GOOGLE_CALENDAR_VINCULACION_WINSTON,
    control_escolar_primaria: !!process.env.GOOGLE_CALENDAR_CONTROL_ESCOLAR_PRIMARIA,
    ingles_primaria: !!process.env.GOOGLE_CALENDAR_INGLES_PRIMARIA,
    service_account: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key_configured: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  }

  return NextResponse.json({ calendars, timestamp: new Date().toISOString() })
}
