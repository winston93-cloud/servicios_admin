'use server'

import { createAdminClient } from '@/lib/admission/admissionInsforge'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import nodemailer from 'nodemailer'
import type { AdmissionLevel, PermissionRequest } from '@/types/admissionDatabase'
import { bookingConflictLevels, normalizeAppointmentTime } from '@/lib/admission/admissionBooking'
import { fetchPendingRescheduleTimes } from '@/lib/admission/pendingRescheduleSlots'
import {
  getAllCalendarIdsForLevel,
  updateCalendarEvent,
  buildAdmisionEventDescription,
} from '@/lib/admission/googleCalendar'

// Tabla exclusiva del flujo de admisión (evita colisión con permission_requests de RH)
const PERMISSION_TABLE = 'admission_permission_requests'

const DIRECTOR_EMAILS: Record<AdmissionLevel, string> = {
  maternal_kinder: 'direccion.kinder@winston93.edu.mx',
  primaria:        'direccion.primaria@winston93.edu.mx',
  secundaria:      'direccion.secundaria@winston93.edu.mx',
}

const LEVEL_LABELS: Record<AdmissionLevel, string> = {
  maternal_kinder: 'Maternal y Kinder',
  primaria:        'Primaria',
  secundaria:      'Secundaria',
}

const TYPE_LABELS: Record<string, string> = {
  reagendar: 'Reagendación de cita',
  horario:   'Cambio de horario',
  bloqueo:   'Bloqueo de día',
}

const ROLE_LABELS: Record<string, string> = {
  psi_mk:  'Psicología – Maternal y Kinder',
  psi_pri: 'Psicología – Primaria',
  psi_sec: 'Psicología – Secundaria',
  vin_mk:  'Vinculación – Maternal y Kinder',
  vin_pri: 'Vinculación – Primaria y Secundaria',
}

export async function getUserRoleLabel(): Promise<string> {
  try {
    const cookieStore = await cookies()
    const role = cookieStore.get('admin_session')?.value ?? ''
    return role ? (ROLE_LABELS[role] ?? role) : 'Sistema'
  } catch (error) {
    console.error('[getUserRoleLabel] Error:', error)
    return 'Sistema'
  }
}

function makeTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx',
      pass: process.env.MAIL_PASS,
    },
  })
}

// ─── CREAR SOLICITUD (desde panel psicólogas) ─────────────────────────────
export async function createPermissionRequest(data: {
  type:  'reagendar' | 'horario' | 'bloqueo'
  level: AdmissionLevel
  // reagendar
  appointment_id?: string
  student_name?:   string
  current_date?:   string
  current_time?:   string
  proposed_date?:  string
  proposed_time?:  string
  proposed_grade?: string
  // horario
  horario_action?:   'agregar' | 'eliminar'
  horario_time_new?: string
  horario_time_old?: string
  // bloqueo
  bloqueo_date?:     string
  bloqueo_date_end?: string
  bloqueo_time?:     string
  bloqueo_reason?:   string
  // mensaje
  psych_message?: string
  requested_by?:  string
}) {
  try {
    const supabase = createAdminClient()

    // Si no se pasó requested_by, obtenerlo de la sesión actual
    let requestedBy = data.requested_by
    if (!requestedBy) {
      try {
        requestedBy = await getUserRoleLabel()
      } catch (error) {
        console.error('[createPermissionRequest] Error getting user role:', error)
        requestedBy = 'Sistema'
      }
    }

    if (
      data.type === 'reagendar' &&
      data.proposed_date &&
      data.proposed_time &&
      data.proposed_time !== 'Por confirmar'
    ) {
      const conflictLevels = bookingConflictLevels(data.level)
      const proposedTime = normalizeAppointmentTime(data.proposed_time)

      let apptQuery = supabase
        .from('admission_appointments')
        .select('id')
        .eq('appointment_date', data.proposed_date)
        .eq('appointment_time', data.proposed_time)
        .in('level', conflictLevels)
        .neq('status', 'cancelled')
        .limit(1)
      if (data.appointment_id) apptQuery = apptQuery.neq('id', data.appointment_id)
      const { data: existingAppt } = await apptQuery
      if (existingAppt?.length) {
        return { ok: false as const, error: 'Ese horario ya está ocupado por otra cita. Elige otra fecha u horario.' }
      }

      const pending = await fetchPendingRescheduleTimes(
        supabase,
        data.proposed_date,
        data.level,
        data.appointment_id
      )
      if (pending.includes(proposedTime)) {
        return { ok: false as const, error: 'Ese horario ya tiene una reagendación pendiente de autorización.' }
      }
    }

    const { data: inserted, error } = await supabase
      .from(PERMISSION_TABLE)
      .insert([{
        type:  data.type,
        level: data.level,
        appointment_id:  data.appointment_id,
        student_name:    data.student_name,
        appt_date:       data.current_date,
        appt_time:       data.current_time,
        proposed_date:   data.proposed_date,
        proposed_time:   data.proposed_time,
        proposed_grade:  data.proposed_grade,
        horario_action:  data.horario_action,
        horario_time_new: data.horario_time_new,
        horario_time_old: data.horario_time_old,
        bloqueo_date:     data.bloqueo_date,
        bloqueo_date_end: data.bloqueo_date_end,
        bloqueo_time:     data.bloqueo_time,
        bloqueo_reason:   data.bloqueo_reason,
        psych_message:    data.psych_message,
        requested_by:     requestedBy,
      }])
      .select()
      .single()

    if (error) return { ok: false as const, error: error.message }
    if (!inserted?.id) return { ok: false as const, error: 'No se pudo crear la solicitud.' }

    // Notificar a la directora por correo
    try {
      const trans   = makeTransporter()
      const destino = DIRECTOR_EMAILS[data.level]
      const nivel   = LEVEL_LABELS[data.level]
      const tipo    = TYPE_LABELS[data.type]

      // Para solicitudes de reagendación/cambio de grado, mostrar fecha de nacimiento del alumno.
      let studentBirthDate: string | null = null
      if (data.type === 'reagendar' && data.appointment_id) {
        try {
          const { data: apptRow } = await supabase
            .from('admission_appointments')
            .select('student_birth_date')
            .eq('id', data.appointment_id)
            .single()
          studentBirthDate = apptRow?.student_birth_date ?? null
        } catch {
          studentBirthDate = null
        }
      }

    let detalles = ''
    if (data.type === 'reagendar') {
      const gradeChangeRow = data.proposed_grade
        ? `<tr><td style="padding:6px 10px;color:#64748b;font-weight:600;">Cambio de grado</td><td style="padding:6px 10px;">${data.proposed_grade}</td></tr>`
        : ''
      
      // Si hay cambio de fecha/hora
      const dateChangeRow = data.proposed_date
        ? `<tr><td style="padding:6px 10px;color:#64748b;font-weight:600;">Propone</td><td style="padding:6px 10px;">${data.proposed_date ?? '—'} ${data.proposed_time ?? ''}</td></tr>`
        : ''
      
      detalles = `
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:600;">Alumno</td><td style="padding:6px 10px;">${data.student_name ?? '—'}</td></tr>
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:600;">Fecha de nacimiento</td><td style="padding:6px 10px;">${studentBirthDate ?? '—'}</td></tr>
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:600;">Fecha actual</td><td style="padding:6px 10px;">${data.current_date ?? '—'} ${data.current_time ?? ''}</td></tr>
        ${dateChangeRow}${gradeChangeRow}`
    } else if (data.type === 'horario') {
      detalles = `
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:600;">Acción</td><td style="padding:6px 10px;">${data.horario_action === 'agregar' ? 'Agregar' : 'Eliminar'} horario</td></tr>
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:600;">Horario</td><td style="padding:6px 10px;">${data.horario_time_new ?? data.horario_time_old ?? '—'}</td></tr>`
    } else {
      const fechaStr = data.bloqueo_date_end
        ? `${data.bloqueo_date ?? '—'} al ${data.bloqueo_date_end}`
        : (data.bloqueo_date ?? '—')
      const alcanceStr = data.bloqueo_time ? `Solo horario ${data.bloqueo_time}` : 'Día completo'
      detalles = `
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:600;">Fecha${data.bloqueo_date_end ? 's' : ''}</td><td style="padding:6px 10px;">${fechaStr}</td></tr>
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:600;">Alcance</td><td style="padding:6px 10px;">${alcanceStr}</td></tr>
        <tr><td style="padding:6px 10px;color:#64748b;font-weight:600;">Motivo</td><td style="padding:6px 10px;">${data.bloqueo_reason ?? 'Sin motivo especificado'}</td></tr>`
    }

    const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://agendaw.vercel.app'}/admin/dashboard`

    const html = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);color:white;padding:1.5rem 2rem;border-radius:12px 12px 0 0;text-align:center;">
    <h2 style="margin:0;font-size:1.3rem;">📋 Nueva Solicitud de Autorización</h2>
    <p style="margin:0.4rem 0 0;opacity:0.85;font-size:0.95rem;">Nivel ${nivel}</p>
  </div>
  <div style="background:#f8fafc;padding:1.75rem 2rem;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
    <p style="margin:0 0 1rem;">Estimada Directora,</p>
    <p><strong>${requestedBy}</strong> solicita su autorización para:</p>
    <div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px;padding:0.85rem 1.25rem;margin:1rem 0;">
      <strong style="font-size:1.1rem;">🔑 ${tipo}</strong>
    </div>
    <table style="border-collapse:collapse;width:100%;background:white;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin:1rem 0;">
      ${detalles}
      ${data.psych_message ? `<tr><td style="padding:6px 10px;color:#64748b;font-weight:600;">Mensaje</td><td style="padding:6px 10px;font-style:italic;">"${data.psych_message}"</td></tr>` : ''}
    </table>
    <div style="text-align:center;margin-top:1.5rem;">
      <a href="${dashUrl}" style="display:inline-block;padding:0.85rem 2rem;background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;text-decoration:none;border-radius:8px;font-weight:700;font-size:1rem;">
        → Ir al Dashboard de Directoras
      </a>
    </div>
    <p style="margin-top:1.5rem;font-size:0.85rem;color:#94a3b8;text-align:center;">
      Sistema de Admisión — Instituto Educativo Winston / Winston Churchill
    </p>
  </div>
</body>
</html>`

      await trans.sendMail({
        from:    `"Sistema de Admisión" <${process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx'}>`,
        to:      destino,
        cc:      process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx',
        subject: `[Solicitud de Autorización] ${tipo} — ${nivel}`,
        html,
      })
    } catch (emailErr) {
      console.error('Error enviando email a directora:', emailErr)
      // No interrumpir el flujo si el email falla
    }

    revalidatePath('/admin/dashboard')
    return { ok: true as const, id: inserted.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error inesperado creando la solicitud.'
    console.error('[createPermissionRequest] Fatal:', e)
    return { ok: false as const, error: msg }
  }
}

// ─── OBTENER SOLICITUDES (para el panel psicólogas) ──────────────────────
export async function getAllRecentRequests() {
  const supabase = createAdminClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from(PERMISSION_TABLE)
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
  return (data ?? []) as PermissionRequest[]
}

// ─── OBTENER SOLICITUDES (para el dashboard directoras) ───────────────────
export async function getPermissionRequests(level: AdmissionLevel) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from(PERMISSION_TABLE)
    .select('*')
    .eq('level', level)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const requests = (data ?? []) as PermissionRequest[]

  // En solicitudes de reagendar/cambio de grado, traemos fecha de nacimiento desde admission_appointments.
  const appointmentIds = requests
    .map(r => r.appointment_id)
    .filter((id): id is string => Boolean(id))

  if (appointmentIds.length === 0) return requests

  const { data: appts } = await supabase
    .from('admission_appointments')
    .select('id, student_birth_date')
    .in('id', appointmentIds)

  const birthById = new Map<string, string | null>()
  ;(appts ?? []).forEach(a => birthById.set(a.id, a.student_birth_date ?? null))

  return requests.map(r => {
    if (!r.appointment_id) return r
    return { ...r, student_birth_date: birthById.get(r.appointment_id) ?? undefined }
  })
}

// ─── RESPONDER SOLICITUD ─────────────────────────────────────────────────
export async function respondPermissionRequest(
  id: string,
  decision: 'aprobada' | 'rechazada',
  director_notes?: string
) {
  const supabase = createAdminClient()

  // 1. Obtener la solicitud
  const { data: req, error: fetchErr } = await supabase
    .from(PERMISSION_TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !req) throw new Error('No se encontró la solicitud')

  // 2. Actualizar estado
  const { error: updateErr } = await supabase
    .from(PERMISSION_TABLE)
    .update({ status: decision, director_notes, responded_at: new Date().toISOString() })
    .eq('id', id)

  if (updateErr) throw new Error(updateErr.message)

  // 3. Si aprobada, ejecutar la acción
  if (decision === 'aprobada') {
    if (req.type === 'reagendar' && req.appointment_id && (req.proposed_date || req.proposed_grade)) {
      // Obtener datos actuales de la cita
      const { data: currentAppt } = await supabase
        .from('admission_appointments')
        .select('*')
        .eq('id', req.appointment_id)
        .single()
      
      const updateData: Record<string, string> = {}
      
      // Si hay cambio de fecha/hora
      if (req.proposed_date) {
        const proposedTime = req.proposed_time ?? 'Por confirmar'
        if (proposedTime !== 'Por confirmar' && currentAppt?.level) {
          const { data: existing } = await supabase
            .from('admission_appointments')
            .select('id')
            .eq('appointment_date', req.proposed_date)
            .eq('appointment_time', proposedTime)
            .in('level', bookingConflictLevels(currentAppt.level))
            .neq('id', req.appointment_id)
            .neq('status', 'cancelled')
            .limit(1)
          if (existing?.length) {
            throw new Error('Ese horario ya está ocupado por otra cita de preescolar. Elige otra fecha u horario.')
          }

          const pending = await fetchPendingRescheduleTimes(
            supabase,
            req.proposed_date,
            currentAppt.level,
            req.appointment_id
          )
          if (pending.includes(normalizeAppointmentTime(proposedTime))) {
            throw new Error('Ese horario tiene otra reagendación pendiente de autorización. No se puede aprobar.')
          }
        }
        updateData.appointment_date = req.proposed_date
        updateData.appointment_time = proposedTime
        updateData.status = 'confirmed'
      }
      
      // Si hay cambio de grado
      if (req.proposed_grade) {
        updateData.grade_level = req.proposed_grade
      }
      
      await supabase
        .from('admission_appointments')
        .update(updateData)
        .eq('id', req.appointment_id)
      
      // Actualizar eventos en Google Calendar si hay cambio de fecha/hora y tiene event IDs
      if (req.proposed_date && req.proposed_time && req.proposed_time !== 'Por confirmar' && currentAppt) {
        const calendars = getAllCalendarIdsForLevel(currentAppt.level)
        if (calendars) {
          try {
            const studentName = [currentAppt.student_name, currentAppt.student_last_name_p, currentAppt.student_last_name_m]
              .filter(Boolean).join(' ')
            
            const eventData = {
              summary: `Examen admisión: ${studentName} (${currentAppt.level})`,
              description: buildAdmisionEventDescription({
                studentName,
                level: currentAppt.level,
                gradeLevel: updateData.grade_level || currentAppt.grade_level,
                parentName: currentAppt.parent_name,
                parentPhone: currentAppt.parent_phone,
                parentEmail: currentAppt.parent_email,
                campus: currentAppt.campus,
              }),
              date: req.proposed_date,
              time: req.proposed_time,
            }

            // Actualizar evento de psicóloga
            if (currentAppt.google_event_id) {
              await updateCalendarEvent(calendars.psicologa, currentAppt.google_event_id, eventData)
            }

            // Si es primaria, actualizar también control escolar e inglés
            if (currentAppt.level === 'primaria') {
              if (calendars.controlEscolar && currentAppt.google_event_id_control_escolar) {
                await updateCalendarEvent(calendars.controlEscolar, currentAppt.google_event_id_control_escolar, eventData)
              }
              if (calendars.ingles && currentAppt.google_event_id_ingles) {
                await updateCalendarEvent(calendars.ingles, currentAppt.google_event_id_ingles, eventData)
              }
            }
          } catch (e) {
            console.warn('[respondPermissionRequest] Error actualizando eventos de calendar:', e)
          }
        }
      }
    }

    if (req.type === 'horario') {
      if (req.horario_action === 'agregar' && req.horario_time_new) {
        const existing = await supabase
          .from('admission_schedules')
          .select('sort_order')
          .eq('level', req.level)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle()
        const nextOrder = (existing.data?.sort_order ?? 0) + 1
        await supabase
          .from('admission_schedules')
          .insert([{ level: req.level, time_slot: req.horario_time_new, sort_order: nextOrder }])
      }
      if (req.horario_action === 'eliminar' && req.horario_time_old) {
        await supabase
          .from('admission_schedules')
          .delete()
          .eq('level', req.level)
          .eq('time_slot', req.horario_time_old)
      }
    }

    if (req.type === 'bloqueo' && req.bloqueo_date) {
      // Generar todas las fechas del rango (o solo la fecha inicial)
      const dates: string[] = []
      const start = new Date(req.bloqueo_date + 'T12:00:00')
      const end   = req.bloqueo_date_end
        ? new Date(req.bloqueo_date_end + 'T12:00:00')
        : start

      const cur = new Date(start)
      while (cur <= end) {
        dates.push(cur.toISOString().slice(0, 10))
        cur.setDate(cur.getDate() + 1)
      }

      // Insertar cada fecha por separado para que los conflictos (fechas ya bloqueadas)
      // se ignoren individualmente sin abortar el resto del lote
      for (const d of dates) {
        await supabase
          .from('blocked_dates')
          .insert({
            block_date: d,
            level:      req.level,
            reason:     req.bloqueo_reason ?? null,
            block_time: req.bloqueo_time ?? null,
          })
        // los errores de constraint único se ignoran silenciosamente
      }
    }
  }

  // 4. Notificar a sistemas (psicólogas) el resultado
  try {
    const trans  = makeTransporter()
    const nivel  = LEVEL_LABELS[req.level as AdmissionLevel]
    const tipo   = TYPE_LABELS[req.type]
    const badge  = decision === 'aprobada' ? '✅ Aprobada' : '❌ Rechazada'
    const color  = decision === 'aprobada' ? '#059669' : '#dc2626'

    const html = `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1e40af 100%);color:white;padding:1.5rem 2rem;border-radius:12px 12px 0 0;text-align:center;">
    <h2 style="margin:0;font-size:1.3rem;">📋 Respuesta a tu Solicitud</h2>
    <p style="margin:0.4rem 0 0;opacity:0.85;font-size:0.95rem;">Nivel ${nivel}</p>
  </div>
  <div style="background:#f8fafc;padding:1.75rem 2rem;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
    <p>Tu solicitud de <strong>${tipo}</strong> para el nivel <strong>${nivel}</strong> ha sido respondida:</p>
    <div style="background:${decision === 'aprobada' ? '#f0fdf4' : '#fef2f2'};border-left:4px solid ${color};border-radius:6px;padding:1rem 1.25rem;margin:1rem 0;font-size:1.2rem;font-weight:700;color:${color};">
      ${badge}
    </div>
    ${director_notes ? `<p><strong>Notas de la directora:</strong><br><em>"${director_notes}"</em></p>` : ''}
    ${decision === 'aprobada' ? '<p style="color:#059669;">✅ El cambio ha sido aplicado automáticamente en el sistema.</p>' : ''}
    <p style="margin-top:1.5rem;font-size:0.85rem;color:#94a3b8;text-align:center;">
      Sistema de Admisión — Instituto Educativo Winston / Winston Churchill
    </p>
  </div>
</body>
</html>`

    await trans.sendMail({
      from:    `"Sistema de Admisión" <${process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx'}>`,
      to:      process.env.MAIL_USER ?? 'avisos_no-replay@winston93.edu.mx',
      subject: `[Solicitud ${decision === 'aprobada' ? 'Aprobada' : 'Rechazada'}] ${tipo} — ${nivel}`,
      html,
    })
  } catch (e) {
    console.error('Error notificando psicóloga:', e)
  }

  revalidatePath('/admin/dashboard')
  revalidatePath('/admin')
  return { ok: true }
}
