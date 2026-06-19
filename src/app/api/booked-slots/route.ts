import { NextResponse } from 'next/server'
import { bookingConflictLevels, normalizeAppointmentTime } from '@/lib/admission/admissionBooking'
import { fetchPendingRescheduleTimes } from '@/lib/admission/pendingRescheduleSlots'
import { createAdminClient } from '@/lib/admission/admissionInsforge'

const VALID_LEVELS = ['maternal', 'kinder', 'primaria', 'secundaria']

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const level = searchParams.get('level')
  const date  = searchParams.get('date')

  if (!level || !VALID_LEVELS.includes(level)) {
    return NextResponse.json(
      { error: 'level required: maternal | kinder | primaria | secundaria' },
      { status: 400 }
    )
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }

  const excludeId = searchParams.get('exclude_id') || undefined

  try {
    const supabase = createAdminClient()
    // Maternal y Kinder comparten psicóloga → bloquear horarios de ambos niveles
    const groupLevels = bookingConflictLevels(level)
    
    let query = supabase
      .from('admission_appointments')
      .select('appointment_time')
      .eq('appointment_date', date)
      .in('level', groupLevels)
      .neq('status', 'cancelled')
    
    if (excludeId) query = query.neq('id', excludeId)
    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const bookedTimes = (data || [])
      .map((r) => r.appointment_time)
      .filter(Boolean)
      .map((t) => normalizeAppointmentTime(t as string))

    const pendingTimes = await fetchPendingRescheduleTimes(supabase, date, level, excludeId)

    const times = [...new Set([...bookedTimes, ...pendingTimes])]
    return NextResponse.json({ times })
  } catch {
    return NextResponse.json({ times: [] })
  }
}
