/**
 * Endpoint para sincronizar alumno_ref de MySQL a Supabase
 * Para citas completadas que no tienen alumno_ref
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/admission/admissionInsforge'
import { checkAlumnoExists } from '@/lib/admission/mysql'

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient()

    // 1. Obtener todas las citas completadas sin alumno_ref
    const { data: appointments, error } = await supabase
      .from('admission_appointments')
      .select('id, student_name, student_last_name_p, student_last_name_m')
      .eq('status', 'completed')
      .is('alumno_ref', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay citas completadas sin alumno_ref',
        synced: 0,
      })
    }

    console.log(`[Sync] Encontradas ${appointments.length} citas sin alumno_ref`)

    let synced = 0
    let notFound = 0
    const details: Array<{ id: string; name: string; ref: number | null }> = []

    // 2. Para cada cita, buscar en MySQL y actualizar si existe
    for (const apt of appointments) {
      const nombre = apt.student_name
      const apellido = apt.student_last_name_p || ''

      if (!nombre || !apellido) {
        console.log(`[Sync] Skip cita ${apt.id}: datos incompletos`)
        continue
      }

      // Buscar en MySQL
      const alumno_ref = await checkAlumnoExists(nombre, apellido)

      if (alumno_ref) {
        // Actualizar en Supabase
        const { error: updateErr } = await supabase
          .from('admission_appointments')
          .update({ alumno_ref })
          .eq('id', apt.id)

        if (!updateErr) {
          synced++
          details.push({ id: apt.id, name: `${nombre} ${apellido}`, ref: alumno_ref })
          console.log(`[Sync] ✓ ${nombre} ${apellido} → ref ${alumno_ref}`)
        }
      } else {
        notFound++
        console.log(`[Sync] ✗ ${nombre} ${apellido} → no encontrado en MySQL`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sincronización completada: ${synced} actualizados, ${notFound} no encontrados`,
      synced,
      notFound,
      total: appointments.length,
      details,
    })
  } catch (error) {
    console.error('[Sync] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
