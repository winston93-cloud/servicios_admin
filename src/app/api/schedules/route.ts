import { NextResponse } from 'next/server'
import { createAdmissionDbAdmin } from '@/lib/admission/admissionInsforge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const level = searchParams.get('level')
  if (!level || !['maternal_kinder', 'primaria', 'secundaria'].includes(level)) {
    return NextResponse.json({ error: 'level required: maternal_kinder | primaria | secundaria' }, { status: 400 })
  }

  try {
    const db = createAdmissionDbAdmin()
    const { data, error } = await db
      .from('admission_schedules')
      .select('time_slot')
      .eq('level', level)
      .order('sort_order', { ascending: true })
      .order('time_slot', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const times = (data || []).map((r) => r.time_slot)
    return NextResponse.json({ times })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de base de datos'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
