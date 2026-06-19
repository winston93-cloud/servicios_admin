'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/admission/admissionInsforge'
import { revalidatePath } from 'next/cache'
import type { AdmissionLevel } from '@/types/admissionDatabase'
import { alumnoGradoParaMySQL } from '@/lib/admission/alumnoGradoMysql'
import { bookingConflictLevels, normalizeAppointmentTime } from '@/lib/admission/admissionBooking'
import { fetchPendingRescheduleTimes } from '@/lib/admission/pendingRescheduleSlots'
import { createAlumnoInMySQL, checkAlumnoExists as checkAlumnoExistsInMySQL, type AlumnoData } from '@/lib/admission/mysql'
import {
  sendRecorridoConfirmationToParent,
  sendRecorridoNotificationToDirector,
  sendRecorridoReagendacionToParent,
  sendRecorridoReagendacionToDirector,
  sendAdmissionConfirmation,
  sendSecundariaTemarios,
} from '@/lib/admission/email'
import nodemailer from 'nodemailer'
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getVinculacionCalendarId,
  getAllCalendarIdsForLevel,
  buildRecorridoEventDescription,
} from '@/lib/admission/googleCalendar'

const INTERNAL_APPROVAL_EMAIL = 'sistemas.desarrollo@winston93.edu.mx'

/** Mismos niveles que `src/app/admin/page.tsx` (admission_appointments.level). */
const ADMIN_ROLE_LEVELS: Record<string, string[]> = {
  psi_mk:  ['maternal', 'kinder'],
  psi_pri: ['primaria'],
  psi_sec: ['secundaria'],
  vin_mk:  ['maternal', 'kinder'],
  vin_pri: ['primaria', 'secundaria'],
}

async function getAdminAllowedLevelsFromSession(): Promise<string[]> {
  const cookieStore = await cookies()
  const role = cookieStore.get('admin_session')?.value ?? ''
  return ADMIN_ROLE_LEVELS[role] ?? []
}

function getCampusNameByLevelForEmail(level: string): string {
  if (level === 'maternal' || level === 'kinder') return 'Instituto Educativo Winston'
  return 'Winston Churchill'
}

const LEVEL_LABELS_EMAIL: Record<string, string> = {
  maternal: 'Maternal',
  kinder: 'Kinder',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
}

function makeInternalTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx',
      pass: process.env.MAIL_PASS,
    },
  })
}

async function notifyInternalAlumnoApproved(input: {
  alumno_ref: number
  alumnoNombre: string
  alumnoApp: string
  alumnoApm: string
  nivel: string
  grado: string
  ciclo: string
  appointmentId: string
  appointmentDate?: string | null
  appointmentTime?: string | null
}) {
  // Notificación 100% interna: no afecta UX si falla.
  try {
    const trans = makeInternalTransporter()
    const fullName = [input.alumnoNombre, input.alumnoApp, input.alumnoApm].filter(Boolean).join(' ').trim()
    const when = [input.appointmentDate, input.appointmentTime].filter(Boolean).join(' · ')
    const subject = `[Admisión] Aprobado y creado en alumno — ref ${input.alumno_ref}`
    const html = `<!doctype html>
<html>
<body style="font-family:Arial,sans-serif;color:#0f172a;max-width:720px;margin:0 auto;padding:16px;">
  <h2 style="margin:0 0 10px;">Aprobación de ingreso (interno)</h2>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
    <p style="margin:0 0 8px;"><strong>Alumno:</strong> ${fullName || '—'}</p>
    <p style="margin:0 0 8px;"><strong>alumno_ref:</strong> ${input.alumno_ref}</p>
    <p style="margin:0 0 8px;"><strong>Nivel / grado:</strong> ${input.nivel || '—'} / ${input.grado || '—'}</p>
    <p style="margin:0 0 8px;"><strong>Ciclo:</strong> ${input.ciclo || '—'}</p>
    <p style="margin:0 0 8px;"><strong>Cita:</strong> ${when || '—'}</p>
    <p style="margin:0;"><strong>Appointment ID:</strong> ${input.appointmentId}</p>
  </div>
  <p style="margin:12px 0 0;color:#64748b;font-size:12px;">
    Enviado automáticamente por AgendaW. (Sin notificación al usuario final)
  </p>
</body>
</html>`

    await trans.sendMail({
      from: `"AgendaW (interno)" <${process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx'}>`,
      to: INTERNAL_APPROVAL_EMAIL,
      subject,
      html,
    })
  } catch (e) {
    console.warn('[notifyInternalAlumnoApproved] Error enviando correo interno:', e)
  }
}

// Verificar disponibilidad completa
export async function getFullyBookedDates(level: AdmissionLevel, excludeAppointmentId?: string): Promise<string[]> {
  try {
    const supabase = createAdminClient()
    
    // 1. Obtener total de slots disponibles por día para este nivel
    const { count: totalSlots, error: countError } = await supabase
      .from('admission_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('level', level)
    
    if (countError || !totalSlots) return []

    // 2. Obtener conteo de citas por fecha (solo futuras o recientes para no cargar todo)
    // Filtramos citas canceladas. Si hay excludeAppointmentId, la excluimos.
    const today = new Date().toISOString().split('T')[0]
    
    let query = supabase
      .from('admission_appointments')
      .select('appointment_date')
      .in('level', bookingConflictLevels(level))
      .neq('status', 'cancelled')
      .gte('appointment_date', today)
    
    if (excludeAppointmentId) {
      query = query.neq('id', excludeAppointmentId)
    }

    const { data: appointments, error: appError } = await query
    
    if (appError || !appointments) return []

    // 3. Agrupar y contar
    const counts: Record<string, number> = {}
    appointments.forEach(a => {
      counts[a.appointment_date] = (counts[a.appointment_date] || 0) + 1
    })

    // 4. Filtrar fechas llenas
    return Object.keys(counts).filter(date => counts[date] >= totalSlots)
  } catch (e) {
    console.error('Error checking full dates:', e)
    return []
  }
}

export async function getAdmissionAppointments(filters?: { date?: string; level?: string; levels?: string[]; status?: string }) {
  let supabase
  try {
    supabase = createAdminClient()
  } catch {
    return []
  }
  let query = supabase
    .from('admission_appointments')
    .select('*')
    .order('appointment_date', { ascending: false })
    .order('appointment_time', { ascending: true })

  if (filters?.date)   query = query.eq('appointment_date', filters.date)
  if (filters?.status) query = query.eq('status', filters.status)

  // levels[] tiene prioridad sobre level string
  if (filters?.levels && filters.levels.length > 0) {
    query = query.in('level', filters.levels)
  } else if (filters?.level) {
    query = query.eq('level', filters.level)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

/** Búsqueda para panel: por nombre (alumno/tutor), fecha de agendación (created_at) o fecha de examen (appointment_date) */
export async function searchAdmissionAppointments(params: {
  name?: string
  createdDate?: string
  appointmentDate?: string
  levels?: string[]
}) {
  let supabase
  try {
    supabase = createAdminClient()
  } catch {
    return []
  }
  let query = supabase
    .from('admission_appointments')
    .select('*')
    .order('appointment_date', { ascending: false })
    .order('created_at', { ascending: false })

  const name = params.name?.trim()
  if (name && name.length >= 2) {
    const safe = name.replace(/'/g, "''")
    query = query.or(`student_name.ilike.%${safe}%,parent_name.ilike.%${safe}%`)
  }
  if (params.createdDate) {
    const start = `${params.createdDate}T00:00:00.000Z`
    const end = `${params.createdDate}T23:59:59.999Z`
    query = query.gte('created_at', start).lte('created_at', end)
  }
  if (params.appointmentDate) {
    query = query.eq('appointment_date', params.appointmentDate)
  }
  if (params.levels && params.levels.length > 0) {
    query = query.in('level', params.levels)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function updateAppointment(
  id: string,
  updates: {
    appointment_date?: string
    appointment_time?: string
    status?: string
    notes?: string
    // Cambio directo de ciclo escolar (sin autorización)
    school_cycle?: string | null
    student_name?: string
    student_last_name_p?: string | null
    student_last_name_m?: string | null
  }
) {
  const supabase = createAdminClient()

  // Si se está cancelando, obtener event IDs para eliminar de calendars
  const isBeingCancelled = updates.status === 'cancelled'
  let currentAppointment: { level?: string; google_event_id?: string; google_event_id_control_escolar?: string; google_event_id_ingles?: string } | null = null
  
  if (isBeingCancelled) {
    const { data } = await supabase
      .from('admission_appointments')
      .select('level, google_event_id, google_event_id_control_escolar, google_event_id_ingles')
      .eq('id', id)
      .single()
    currentAppointment = data
  }

  if (updates.appointment_date != null && updates.appointment_time != null) {
    const { data: current } = await supabase.from('admission_appointments').select('level').eq('id', id).single()
    if (current?.level) {
      const { data: existing } = await supabase
        .from('admission_appointments')
        .select('id')
        .eq('appointment_date', updates.appointment_date)
        .eq('appointment_time', updates.appointment_time)
        .in('level', bookingConflictLevels(current.level))
        .neq('id', id)
        .neq('status', 'cancelled')
        .limit(1)
      if (existing?.length) {
        throw new Error('Ese horario ya está ocupado por otra cita de preescolar. Elige otra fecha u horario.')
      }

      const pending = await fetchPendingRescheduleTimes(
        supabase,
        updates.appointment_date,
        current.level,
        id
      )
      if (pending.includes(normalizeAppointmentTime(updates.appointment_time))) {
        throw new Error('Ese horario tiene una reagendación pendiente de autorización. Elige otra fecha u horario.')
      }
    }
  }

  const { error } = await supabase
    .from('admission_appointments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  // Si se canceló la cita, eliminar eventos de Google Calendar
  if (isBeingCancelled && currentAppointment) {
    const calendars = getAllCalendarIdsForLevel(currentAppointment.level || '')
    if (calendars) {
      try {
        // Eliminar evento de psicóloga
        if (currentAppointment.google_event_id) {
          await deleteCalendarEvent(calendars.psicologa, currentAppointment.google_event_id)
        }
        // Si es primaria, eliminar también de control escolar e inglés
        if (currentAppointment.level === 'primaria') {
          if (calendars.controlEscolar && currentAppointment.google_event_id_control_escolar) {
            await deleteCalendarEvent(calendars.controlEscolar, currentAppointment.google_event_id_control_escolar)
          }
          if (calendars.ingles && currentAppointment.google_event_id_ingles) {
            await deleteCalendarEvent(calendars.ingles, currentAppointment.google_event_id_ingles)
          }
        }
      } catch (e) {
        console.warn('[updateAppointment] Error eliminando eventos de calendar:', e)
      }
    }
  }

  revalidatePath('/admin')
}

/**
 * Marca una cita como completada y crea el alumno en MySQL
 * Retorna el alumno_ref asignado en MySQL
 */
export async function completeAdmissionAndCreateAlumno(appointmentId: string): Promise<{
  success: boolean
  alumno_ref?: number
  message: string
}> {
  try {
    const supabase = createAdminClient()
    
    // Obtener datos completos de la cita y expediente
    const { data: appointment } = await supabase
      .from('admission_appointments')
      .select('*')
      .eq('id', appointmentId)
      .single()
    
    if (!appointment) {
      return { success: false, message: 'No se encontró la cita' }
    }

    const { data: expediente } = await supabase
      .from('expediente_inicial')
      .select('*')
      .eq('appointment_id', appointmentId)
      .single()

    if (!expediente) {
      return { success: false, message: 'El alumno no ha llenado el expediente inicial' }
    }

    // Mapear nivel a número para MySQL
    const nivelMap: Record<string, string> = {
      maternal: '1',
      kinder: '2',
      primaria: '3',
      secundaria: '4',
    }

    // Verificar si ya existe el alumno
    const existingRef = await checkAlumnoExistsInMySQL(
      expediente.nombre_alumno || appointment.student_name,
      expediente.apellido_paterno_alumno || appointment.student_last_name_p || ''
    )

    if (existingRef) {
      return {
        success: false,
        message: `El alumno ya existe con referencia ${existingRef}`,
      }
    }

    // Convertir ciclo "2025-2026" → "22", "2026-2027" → "23" (año final - 2004)
    // Priorizamos el ciclo editable en admin (appointment.school_cycle) para que el cambio
    // de las psicólogas se refleje sin pedir autorización.
    const rawCiclo = appointment.school_cycle || expediente.ciclo_escolar || ''
    const parsedCiclo = (() => {
      const parts = rawCiclo.split('-')
      if (parts.length >= 2) {
        const endYear = parseInt(parts[parts.length - 1].trim(), 10)
        if (!isNaN(endYear) && endYear > 2000) return String(endYear - 2004)
      }
      return rawCiclo
    })()

  const alumno_grado_parsed = alumnoGradoParaMySQL(
      appointment.level,
      appointment.grade_level || expediente.grado || ''
    )

    // Crear alumno en MySQL
    const alumnoData: AlumnoData = {
      alumno_app: expediente.apellido_paterno_alumno || appointment.student_last_name_p || '',
      alumno_apm: expediente.apellido_materno_alumno || appointment.student_last_name_m || '',
      alumno_nombre: expediente.nombre_alumno || appointment.student_name || '',
      alumno_nivel: nivelMap[appointment.level] || '1',
      alumno_grado: alumno_grado_parsed,
      alumno_grupo: '',
      alumno_status: '2',
      alumno_nuevo_ingreso: '1', // Nuevo ingreso de agenda
      alumno_ciclo_escolar: parsedCiclo,
    }

    const alumno_ref = await createAlumnoInMySQL(alumnoData)

    // Actualizar status en Supabase
    await supabase
      .from('admission_appointments')
      .update({ 
        status: 'completed',
        alumno_ref,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)

    // Notificación interna (no interrumpe el flujo)
    await notifyInternalAlumnoApproved({
      alumno_ref,
      alumnoNombre: expediente.nombre_alumno || appointment.student_name || '',
      alumnoApp: expediente.apellido_paterno_alumno || appointment.student_last_name_p || '',
      alumnoApm: expediente.apellido_materno_alumno || appointment.student_last_name_m || '',
      nivel: appointment.level || '',
      grado: appointment.grade_level || '',
      ciclo: appointment.school_cycle || expediente.ciclo_escolar || '',
      appointmentId,
      appointmentDate: appointment.appointment_date ?? null,
      appointmentTime: appointment.appointment_time ?? null,
    })

    return {
      success: true,
      alumno_ref,
      message: `✓ Alta exitosa. Alumno creado con referencia: ${alumno_ref}`,
    }
  } catch (error) {
    console.error('[completeAdmission]', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al crear alumno en MySQL',
    }
  }
}

/**
 * Aprueba directamente el ingreso de un alumno migrado del sistema anterior
 * (sin requerir expediente inicial)
 */
export async function completeAdmissionLegacy(appointmentId: string): Promise<{
  success: boolean
  alumno_ref?: number
  message: string
}> {
  try {
    const supabase = createAdminClient()

    const { data: appointment } = await supabase
      .from('admission_appointments')
      .select('*')
      .eq('id', appointmentId)
      .single()

    if (!appointment) return { success: false, message: 'No se encontró la cita' }
    if (appointment.origin !== 'legacy') return { success: false, message: 'Esta función solo aplica para alumnos del sistema anterior' }

    const nivelMap: Record<string, string> = {
      maternal: '1', kinder: '2', primaria: '3', secundaria: '4',
    }

    const alumno_grado = alumnoGradoParaMySQL(appointment.level, appointment.grade_level)

    // Convertir ciclo "2025-2026" → "22"
    const rawCiclo = appointment.school_cycle || ''
    const parsedCiclo = (() => {
      const parts = rawCiclo.split('-')
      if (parts.length >= 2) {
        const endYear = parseInt(parts[parts.length - 1].trim(), 10)
        if (!isNaN(endYear) && endYear > 2000) return String(endYear - 2004)
      }
      return rawCiclo
    })()

    const existingRef = await checkAlumnoExistsInMySQL(
      appointment.student_name,
      appointment.student_last_name_p || ''
    )
    if (existingRef) {
      return { success: false, message: `El alumno ya existe con referencia ${existingRef}` }
    }

    const alumnoData: AlumnoData = {
      alumno_app: appointment.student_last_name_p || '',
      alumno_apm: appointment.student_last_name_m || '',
      alumno_nombre: appointment.student_name || '',
      alumno_nivel: nivelMap[appointment.level] || '1',
      alumno_grado,
      alumno_grupo: '',
      alumno_status: '2',
      alumno_nuevo_ingreso: '1',
      alumno_ciclo_escolar: parsedCiclo,
    }

    const alumno_ref = await createAlumnoInMySQL(alumnoData)

    await supabase
      .from('admission_appointments')
      .update({ status: 'completed', alumno_ref, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)

    // Notificación interna (no interrumpe el flujo)
    await notifyInternalAlumnoApproved({
      alumno_ref,
      alumnoNombre: appointment.student_name || '',
      alumnoApp: appointment.student_last_name_p || '',
      alumnoApm: appointment.student_last_name_m || '',
      nivel: appointment.level || '',
      grado: appointment.grade_level || '',
      ciclo: appointment.school_cycle || '',
      appointmentId,
      appointmentDate: appointment.appointment_date ?? null,
      appointmentTime: appointment.appointment_time ?? null,
    })

    return { success: true, alumno_ref, message: `✓ Alta exitosa. Alumno creado con referencia: ${alumno_ref}` }
  } catch (error) {
    console.error('[completeAdmissionLegacy]', error)
    return { success: false, message: error instanceof Error ? error.message : 'Error al crear alumno en MySQL' }
  }
}

/**
 * Verifica si existen expedientes para múltiples citas en una sola consulta
 */
export async function checkExpedientesBatch(appointmentIds: string[]): Promise<Record<string, boolean>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('expediente_inicial')
    .select('appointment_id')
    .in('appointment_id', appointmentIds)
  
  const map: Record<string, boolean> = {}
  data?.forEach((row: { appointment_id: string | null }) => {
    if (row.appointment_id) map[row.appointment_id] = true
  })
  return map
}

export async function checkExpedienteExists(appointmentId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('expediente_inicial')
    .select('id')
    .eq('appointment_id', appointmentId)
    .single()
  return !!data
}

export async function createManualExpedienteForAppointment(appointmentId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Si ya existe, no hacer nada (idempotente)
    const { data: existing } = await supabase
      .from('expediente_inicial')
      .select('id')
      .eq('appointment_id', appointmentId)
      .maybeSingle()
    if (existing?.id) return { ok: true }

    const { data: appt, error: apptErr } = await supabase
      .from('admission_appointments')
      .select('*')
      .eq('id', appointmentId)
      .single()

    if (apptErr || !appt) return { ok: false, error: apptErr?.message ?? 'No se encontró la cita' }

    const row = {
      appointment_id: appointmentId,
      nivel: appt.level ?? null,
      grado: appt.grade_level ?? null,
      ciclo_escolar: appt.school_cycle ?? null,
      nombre_alumno: appt.student_name ?? null,
      apellido_paterno_alumno: appt.student_last_name_p ?? null,
      apellido_materno_alumno: appt.student_last_name_m ?? null,
      telefono_principal: appt.parent_phone ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('expediente_inicial').insert(row)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/admin')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error creando expediente manual' }
  }
}

/**
 * Reenvía al tutor el mismo correo de confirmación de cita (enlace a requisitos / expediente y documentación),
 * con copia interna a sistemas. En Secundaria también reenvía el correo de temarios adjuntos, como al agendar.
 */
export async function resendAdmissionParentEmails(appointmentId: string): Promise<{
  ok: boolean
  error?: string
  confirmationOk?: boolean
  temariosOk?: boolean
  temariosSkipped?: boolean
}> {
  try {
    const allowedLevels = await getAdminAllowedLevelsFromSession()
    const supabase = createAdminClient()
    const { data: appt, error: apptErr } = await supabase
      .from('admission_appointments')
      .select('*')
      .eq('id', appointmentId)
      .single()

    if (apptErr || !appt) {
      return { ok: false, error: apptErr?.message ?? 'No se encontró la cita' }
    }

    if (allowedLevels.length > 0 && !allowedLevels.includes(appt.level)) {
      return { ok: false, error: 'No tienes permiso para reenviar información de esta cita.' }
    }

    const parentEmail = (appt.parent_email || '').trim()
    if (!parentEmail) {
      return { ok: false, error: 'La cita no tiene correo del tutor registrado.' }
    }

    const studentName = [appt.student_name, appt.student_last_name_p, appt.student_last_name_m]
      .filter(Boolean)
      .join(' ')
      .trim()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://agendaw.vercel.app'
    const expedienteUrl = `${baseUrl.replace(/\/$/, '')}/expediente_inicial?cita=${appointmentId}`

    const confirmation = await sendAdmissionConfirmation(
      parentEmail,
      {
        parentName: appt.parent_name?.trim() || 'Padre o madre de familia',
        studentName: studentName || appt.student_name || 'Aspirante',
        appointmentDate: appt.appointment_date,
        appointmentTime: appt.appointment_time || 'Por confirmar',
        campusName: getCampusNameByLevelForEmail(appt.level),
        levelLabel: LEVEL_LABELS_EMAIL[appt.level] || appt.level,
        level: appt.level,
        expedienteUrl,
      },
      { cc: INTERNAL_APPROVAL_EMAIL }
    )

    let temariosOk: boolean | undefined
    let temariosSkipped = true
    if (appt.level === 'secundaria' && appt.grade_level) {
      temariosSkipped = false
      const tr = await sendSecundariaTemarios(
        parentEmail,
        {
          parentName: appt.parent_name?.trim() || 'Padre o madre de familia',
          studentName: studentName || appt.student_name || 'Aspirante',
          appointmentDate: appt.appointment_date,
          gradeLevel: appt.grade_level,
        },
        { cc: INTERNAL_APPROVAL_EMAIL }
      )
      temariosOk = tr.ok
    }

    const ok =
      confirmation.ok &&
      (temariosSkipped || temariosOk === true)

    let combinedError: string | undefined
    if (!ok) {
      const parts: string[] = []
      if (!confirmation.ok) parts.push(confirmation.error ? `Confirmación: ${confirmation.error}` : 'Confirmación: error')
      if (!temariosSkipped && temariosOk === false) parts.push('Temarios: no se pudo enviar')
      combinedError = parts.join(' · ')
    }

    revalidatePath('/admin')
    return {
      ok,
      error: combinedError,
      confirmationOk: confirmation.ok,
      temariosOk,
      temariosSkipped,
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error al reenviar correos',
    }
  }
}

export async function getBlockedDates(level?: AdmissionLevel) {
  let supabase
  try {
    supabase = createAdminClient()
  } catch {
    return []
  }
  let query = supabase.from('blocked_dates').select('*').order('block_date', { ascending: true })
  if (level) query = query.eq('level', level)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function blockDate(block_date: string, level: AdmissionLevel, reason?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('blocked_dates').insert({ block_date, level, reason })
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin')
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al bloquear el día.'
    return { ok: false, error: msg }
  }
}

export async function unblockDate(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('blocked_dates').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin')
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al desbloquear.'
    return { ok: false, error: msg }
  }
}

// Horarios por nivel (1, 2 o 3 por día; lunes a viernes)
export async function getSchedules(level?: AdmissionLevel) {
  let supabase
  try {
    supabase = createAdminClient()
  } catch {
    return []
  }
  let query = supabase.from('admission_schedules').select('*').order('sort_order', { ascending: true }).order('time_slot', { ascending: true })
  if (level) query = query.eq('level', level)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function addSchedule(level: AdmissionLevel, time_slot: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const normalized = time_slot.trim().slice(0, 5)
    if (!/^\d{1,2}:\d{2}$/.test(normalized)) return { ok: false, error: 'Formato de hora inválido (usa HH:MM)' }
    const { data: existing } = await supabase.from('admission_schedules').select('id').eq('level', level).eq('time_slot', normalized).maybeSingle()
    if (existing) return { ok: false, error: 'Ese horario ya existe para este nivel' }
    const { data: max } = await supabase.from('admission_schedules').select('sort_order').eq('level', level).order('sort_order', { ascending: false }).limit(1).maybeSingle()
    const sort_order = (max?.sort_order ?? -1) + 1
    const { error } = await supabase.from('admission_schedules').insert({ level, time_slot: normalized, sort_order })
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin')
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al agregar horario.'
    return { ok: false, error: msg }
  }
}

export async function removeSchedule(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('admission_schedules').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin')
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al eliminar horario.'
    return { ok: false, error: msg }
  }
}

// --- Recorridos programados ---
const RECORRIDO_LEVELS = ['maternal', 'kinder', 'primaria', 'secundaria'] as const
type TourLevel = (typeof RECORRIDO_LEVELS)[number]

function plantelGroup(level: TourLevel): 'maternal_kinder' | 'primaria_secundaria' {
  return level === 'maternal' || level === 'kinder' ? 'maternal_kinder' : 'primaria_secundaria'
}

export async function getRecorridos() {
  let supabase
  try {
    supabase = createAdminClient()
  } catch {
    return []
  }
  const { data, error } = await supabase
    .from('tour_recorridos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createRecorrido(input: {
  level: TourLevel
  tour_date: string
  tour_time: string
  student_name?: string
  parent_name: string
  parent_phone: string
  parent_email: string
  notes?: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const group = plantelGroup(input.level)
    const otherLevels = group === 'maternal_kinder' ? ['maternal', 'kinder'] : ['primaria', 'secundaria']
    const timeNorm = input.tour_time.trim().slice(0, 5)
    if (!/^\d{1,2}:\d{2}$/.test(timeNorm)) return { ok: false, error: 'Hora inválida (usa HH:MM)' }
    const { data: conflict } = await supabase
      .from('tour_recorridos')
      .select('id')
      .eq('tour_date', input.tour_date)
      .eq('tour_time', timeNorm)
      .in('level', otherLevels)
      .limit(1)
      .maybeSingle()
    if (conflict) {
      return {
        ok: false,
        error: `Ya existe un recorrido para ese día y hora en el plantel (${group === 'maternal_kinder' ? 'Maternal/Kinder' : 'Primaria/Secundaria'}). Elige otro horario.`,
      }
    }
    const row = {
      level: input.level,
      tour_date: input.tour_date,
      tour_time: timeNorm,
      student_name: input.student_name?.trim() || null,
      parent_name: input.parent_name.trim(),
      parent_phone: input.parent_phone.trim(),
      parent_email: input.parent_email.trim(),
      notes: input.notes?.trim() || null,
    }
    const { data: inserted, error } = await supabase.from('tour_recorridos').insert(row).select('id').single()
    if (error || !inserted) return { ok: false, error: error?.message ?? 'Error al crear recorrido' }

    const levelLabel = { maternal: 'Maternal', kinder: 'Kinder', primaria: 'Primaria', secundaria: 'Secundaria' }[input.level]
    const parentData = {
      parentName: row.parent_name,
      parentEmail: row.parent_email,
      parentPhone: row.parent_phone,
      levelLabel,
      level: input.level,
      tourDate: row.tour_date,
      tourTime: row.tour_time,
    }
    const [parentResult, directorResult] = await Promise.all([
      sendRecorridoConfirmationToParent(parentData),
      sendRecorridoNotificationToDirector(input.level, parentData),
    ])
    const calendarUpdates: Record<string, unknown> = {
      email_parent_sent: parentResult.ok,
      email_director_sent: directorResult.ok,
      updated_at: new Date().toISOString(),
    }

    // Crear evento en Google Calendar de vinculación
    const calendarId = getVinculacionCalendarId(input.level)
    if (calendarId) {
      try {
        const calResult = await createCalendarEvent(calendarId, {
          summary: `Recorrido ${levelLabel}: ${row.parent_name}`,
          description: buildRecorridoEventDescription({
            level: input.level,
            parentName: row.parent_name,
            parentPhone: row.parent_phone,
            parentEmail: row.parent_email,
            notes: row.notes ?? undefined,
          }),
          date: row.tour_date,
          time: row.tour_time,
          durationMinutes: 30,
        })
        if (calResult.ok && calResult.eventId) {
          calendarUpdates.google_event_id = calResult.eventId
        } else {
          console.warn('[createRecorrido] Google Calendar error:', calResult.error)
        }
      } catch (e) {
        console.warn('[createRecorrido] Google Calendar excepción:', e)
      }
    }

    await supabase.from('tour_recorridos').update(calendarUpdates).eq('id', inserted.id)
    if (!parentResult.ok) console.error('[createRecorrido] Error email al papá:', parentResult.error)
    if (!directorResult.ok) console.error('[createRecorrido] Error email a directora:', directorResult.error)

    revalidatePath('/admin')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al crear recorrido.' }
  }
}

export async function updateRecorrido(
  id: string,
  input: {
    level?: TourLevel
    tour_date?: string
    tour_time?: string
    student_name?: string
    parent_name?: string
    parent_phone?: string
    parent_email?: string
    notes?: string
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { data: current } = await supabase.from('tour_recorridos').select('level, tour_date, tour_time, parent_name, parent_phone, parent_email').eq('id', id).single()
    if (!current) return { ok: false, error: 'Recorrido no encontrado' }
    const level = (input.level ?? current.level) as TourLevel
    const tour_date = input.tour_date ?? current.tour_date
    const tour_time = (input.tour_time ?? current.tour_time).trim().slice(0, 5)
    if (!/^\d{1,2}:\d{2}$/.test(tour_time)) return { ok: false, error: 'Hora inválida (usa HH:MM)' }
    const group = plantelGroup(level)
    const otherLevels = group === 'maternal_kinder' ? ['maternal', 'kinder'] : ['primaria', 'secundaria']
    const { data: conflict } = await supabase
      .from('tour_recorridos')
      .select('id')
      .eq('tour_date', tour_date)
      .eq('tour_time', tour_time)
      .in('level', otherLevels)
      .neq('id', id)
      .limit(1)
      .maybeSingle()
    if (conflict) {
      return {
        ok: false,
        error: `Ya existe otro recorrido para ese día y hora en el plantel (${group === 'maternal_kinder' ? 'Maternal/Kinder' : 'Primaria/Secundaria'}).`,
      }
    }
    const dateOrTimeChanged =
      (input.tour_date != null && input.tour_date !== current.tour_date) ||
      (input.tour_time != null && tour_time !== (current.tour_time ?? '').trim().slice(0, 5))

    const finalParentName = (input.parent_name ?? current.parent_name)?.trim() ?? ''
    const finalParentPhone = (input.parent_phone ?? current.parent_phone)?.trim() ?? ''
    const finalParentEmail = (input.parent_email ?? current.parent_email)?.trim() ?? ''

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      ...(input.level != null && { level: input.level }),
      ...(input.tour_date != null && { tour_date: input.tour_date }),
      ...(input.tour_time != null && { tour_time }),
      ...(input.student_name !== undefined && { student_name: input.student_name?.trim() || null }),
      ...(input.parent_name != null && { parent_name: input.parent_name.trim() }),
      ...(input.parent_phone != null && { parent_phone: input.parent_phone.trim() }),
      ...(input.parent_email != null && { parent_email: input.parent_email.trim() }),
      ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
    }
    const { error } = await supabase.from('tour_recorridos').update(updates).eq('id', id)
    if (error) return { ok: false, error: error.message }

    // Actualizar evento en Google Calendar si cambió fecha/hora
    if (dateOrTimeChanged) {
      const { data: recorridoRow } = await supabase
        .from('tour_recorridos')
        .select('google_event_id')
        .eq('id', id)
        .single()
      const existingEventId = recorridoRow?.google_event_id
      const calendarId = getVinculacionCalendarId(level)
      if (calendarId && existingEventId) {
        try {
          const levelLabel = { maternal: 'Maternal', kinder: 'Kinder', primaria: 'Primaria', secundaria: 'Secundaria' }[level]
          await updateCalendarEvent(calendarId, existingEventId, {
            summary: `Recorrido ${levelLabel}: ${finalParentName}`,
            description: buildRecorridoEventDescription({
              level,
              parentName: finalParentName,
              parentPhone: finalParentPhone,
              parentEmail: finalParentEmail,
            }),
            date: tour_date,
            time: tour_time,
            durationMinutes: 30,
          })
        } catch (e) {
          console.warn('[updateRecorrido] Google Calendar error:', e)
        }
      }
    }

    if (dateOrTimeChanged) {
      const levelLabel = { maternal: 'Maternal', kinder: 'Kinder', primaria: 'Primaria', secundaria: 'Secundaria' }[level]
      const parentData = {
        parentName: finalParentName,
        parentPhone: finalParentPhone,
        parentEmail: finalParentEmail,
        levelLabel,
        level,
        tourDate: tour_date,
        tourTime: tour_time,
      }
      const [parentResult, directorResult] = await Promise.all([
        sendRecorridoReagendacionToParent(parentData),
        sendRecorridoReagendacionToDirector(level, parentData),
      ])
      await supabase
        .from('tour_recorridos')
        .update({
          email_parent_sent: parentResult.ok,
          email_director_sent: directorResult.ok,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (!parentResult.ok) console.error('[updateRecorrido] Error email reagendación al papá:', parentResult.error)
      if (!directorResult.ok) console.error('[updateRecorrido] Error email reagendación a directora:', directorResult.error)
    }

    revalidatePath('/admin')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al actualizar recorrido.' }
  }
}

export async function deleteRecorrido(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()

    // Obtener google_event_id antes de eliminar
    const { data: recorridoRow } = await supabase
      .from('tour_recorridos')
      .select('google_event_id, level')
      .eq('id', id)
      .single()

    const { error } = await supabase.from('tour_recorridos').delete().eq('id', id)
    if (error) return { ok: false, error: error.message }

    // Eliminar evento de Google Calendar
    if (recorridoRow?.google_event_id && recorridoRow?.level) {
      const calendarId = getVinculacionCalendarId(recorridoRow.level)
      if (calendarId) {
        try {
          await deleteCalendarEvent(calendarId, recorridoRow.google_event_id)
        } catch (e) {
          console.warn('[deleteRecorrido] Google Calendar error:', e)
        }
      }
    }

    revalidatePath('/admin')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error al eliminar recorrido.' }
  }
}
