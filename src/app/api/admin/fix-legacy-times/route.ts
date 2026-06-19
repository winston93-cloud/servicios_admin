import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/admission/admissionInsforge'

/**
 * Endpoint temporal para corregir formato de appointment_time en registros legacy
 * Sistema anterior: 11.00, 9.00 (punto decimal)
 * Sistema nuevo: 11:00, 09:00 (dos puntos, hora con cero inicial)
 */
export async function POST() {
  try {
    const supabase = createAdminClient()
    
    // 1. Obtener todos los registros legacy con punto en el appointment_time
    const { data: legacyAppts, error: fetchError } = await supabase
      .from('admission_appointments')
      .select('id, appointment_time')
      .eq('origin', 'legacy')
    
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!legacyAppts || legacyAppts.length === 0) {
      return NextResponse.json({ ok: true, message: 'No hay registros legacy para corregir', updated: 0 })
    }

    // 2. Normalizar formato y actualizar
    let updated = 0
    const errors: string[] = []

    for (const appt of legacyAppts) {
      const originalTime = appt.appointment_time
      if (!originalTime || originalTime === 'Por confirmar') continue
      
      // Normalizar formato
      let normalized = originalTime.trim().replace('.', ':')
      
      // Si tiene formato 9:00, agregar cero → 09:00
      if (/^\d:\d{2}$/.test(normalized)) {
        normalized = '0' + normalized
      }
      
      // Si solo tiene dígitos sin minutos, agregar :00
      if (/^\d{1,2}$/.test(normalized)) {
        normalized = normalized.padStart(2, '0') + ':00'
      }

      // Solo actualizar si cambió
      if (normalized !== originalTime) {
        const { error } = await supabase
          .from('admission_appointments')
          .update({ appointment_time: normalized })
          .eq('id', appt.id)
        
        if (error) {
          errors.push(`Error en ${appt.id}: ${error.message}`)
        } else {
          updated++
        }
      }
    }

    return NextResponse.json({ 
      ok: true, 
      total: legacyAppts.length,
      updated, 
      errors: errors.length > 0 ? errors : undefined 
    })

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
