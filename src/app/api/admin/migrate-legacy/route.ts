import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/admission/admissionInsforge'
import { getMySQLPool } from '@/lib/admission/mysql'
import type { RowDataPacket } from 'mysql2'

interface AgAlumnoRow extends RowDataPacket {
  idalum: number
  nombre: string
  ap_pat: string
  ap_mat: string
  fecna: Date | null
  telefono: string
  email: string
  ciclo: number | null
  n_ing: number
  g_ing: string
  f_exa: Date | null
  h_exa: string
  e_pro: string
  contacto: string
  alumno_status: number
  npase: string
  alumno_registro: Date | null
}

function mapLevel(nIng: number): 'maternal' | 'kinder' | 'primaria' | 'secundaria' {
  switch (nIng) {
    case 1: return 'maternal'
    case 2: return 'kinder'
    case 3: return 'primaria'
    case 4: return 'secundaria'
    default: return 'primaria'
  }
}

function mapCampus(nIng: number): 'winston' | 'churchill' {
  return nIng <= 2 ? 'winston' : 'churchill'
}

function mapGradeLevel(nIng: number, gIng: number): string {
  if (nIng === 1) return gIng === 1 ? 'maternal_a' : 'maternal_b'
  if (nIng === 2) {
    const grades: Record<number, string> = { 1: 'kinder_1', 2: 'kinder_2', 3: 'kinder_3' }
    return grades[gIng] ?? 'kinder_1'
  }
  if (nIng === 3) return `primaria_${gIng}`
  if (nIng === 4) {
    const grades: Record<number, string> = { 1: 'secundaria_7', 2: 'secundaria_8', 3: 'secundaria_9' }
    return grades[gIng] ?? 'secundaria_7'
  }
  return 'primaria_1'
}

function calcAge(birthDate: Date | null): string {
  if (!birthDate) return 'N/D'
  const today = new Date()
  const birth = new Date(birthDate)
  const years = today.getFullYear() - birth.getFullYear()
  const months = today.getMonth() - birth.getMonth()
  const adjustedYears = months < 0 ? years - 1 : years
  const adjustedMonths = months < 0 ? months + 12 : months
  if (adjustedYears === 0) return `${adjustedMonths} meses`
  if (adjustedMonths === 0) return `${adjustedYears} años`
  return `${adjustedYears} años ${adjustedMonths} meses`
}

function formatDate(date: Date | null): string | null {
  if (!date) return null
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

function buildNotes(row: AgAlumnoRow): string {
  const parts: string[] = ['[Sistema anterior]']
  if (row.e_pro?.trim()) parts.push(`Escuela de procedencia: ${row.e_pro.trim()}`)
  if (row.npase?.trim() && row.npase !== '0') parts.push(`Pase anterior: ${row.npase.trim()}`)
  return parts.join(' | ')
}

function normalizeTime(legacyTime: string): string {
  if (!legacyTime) return 'Por confirmar'
  // Sistema anterior: '11.00', '9.00', etc. → normalizar a '11:00', '09:00'
  let time = legacyTime.trim().replace('.', ':')
  // Si solo tiene 1 dígito de hora, agregar cero inicial
  if (/^\d:\d{2}$/.test(time)) time = '0' + time
  // Si no tiene minutos, agregar :00
  if (/^\d{1,2}$/.test(time)) time = time.padStart(2, '0') + ':00'
  return time || 'Por confirmar'
}

// GET: Preview — cuántos registros hay pendientes de migrar
export async function GET() {
  try {
    const pool = getMySQLPool()
    const [rows] = await pool.query<AgAlumnoRow[]>(
      `SELECT COUNT(*) as total FROM ag_alumno WHERE ciclo IN (22, 23) AND (npase IS NULL OR npase = '' OR npase = '0') AND f_exa >= CURDATE()`
    )
    const totalMySQL = (rows[0] as unknown as { total: number }).total

    const supabase = createAdminClient()
    const { count } = await supabase
      .from('admission_appointments')
      .select('id', { count: 'exact', head: true })
      .eq('origin', 'legacy')

    return NextResponse.json({ ok: true, totalMySQL, alreadyMigrated: count ?? 0 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

// POST: Ejecutar migración
export async function POST(req: NextRequest) {
  // Verificar token básico
  const authHeader = req.headers.get('x-cron-secret')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const pool = getMySQLPool()
    const [legacyRows] = await pool.query<AgAlumnoRow[]>(
      `SELECT * FROM ag_alumno WHERE ciclo IN (22, 23) AND (npase IS NULL OR npase = '' OR npase = '0') AND f_exa >= CURDATE()`
    )

    const supabase = createAdminClient()

    // Obtener los legacy_id ya migrados para no duplicar
    const { data: existingRows } = await supabase
      .from('admission_appointments')
      .select('legacy_id')
      .eq('origin', 'legacy')
      .not('legacy_id', 'is', null)

    const existingIds = new Set((existingRows ?? []).map((r) => r.legacy_id as number))

    let inserted = 0
    let skipped = 0
    const errors: string[] = []

    for (const row of legacyRows) {
      if (existingIds.has(row.idalum)) {
        skipped++
        continue
      }

      const appointmentDate = formatDate(row.f_exa) ?? formatDate(row.alumno_registro)
      if (!appointmentDate) {
        errors.push(`idalum ${row.idalum}: sin fecha de examen ni registro, omitido`)
        skipped++
        continue
      }

      const record = {
        campus: mapCampus(row.n_ing),
        level: mapLevel(row.n_ing),
        grade_level: mapGradeLevel(row.n_ing, parseInt(String(row.g_ing)) || 1),
        student_name: row.nombre?.trim() ?? 'N/D',
        student_last_name_p: row.ap_pat?.trim() ?? '',
        student_last_name_m: row.ap_mat?.trim() ?? '',
        student_birth_date: formatDate(row.fecna),
        student_age: calcAge(row.fecna),
        parent_name: (!row.contacto?.trim() || row.contacto.trim().toUpperCase() === 'PSICOLOGIAS') ? 'N/A' : row.contacto.trim(),
        parent_email: row.email?.trim() ?? 'sin-email@legacy.local',
        parent_phone: row.telefono?.trim() ?? 'N/D',
        relationship: 'Padre/Madre',
        appointment_date: appointmentDate,
        appointment_time: normalizeTime(row.h_exa),
        status: 'confirmed',
        school_cycle: row.ciclo === 22 ? '2025-2026' : '2026-2027',
        notes: buildNotes(row),
        origin: 'legacy',
        legacy_id: row.idalum,
        created_at: row.alumno_registro ? (formatDate(row.alumno_registro) + 'T12:00:00.000Z') : undefined,
      }

      const { error } = await supabase.from('admission_appointments').insert(record)
      if (error) {
        errors.push(`idalum ${row.idalum}: ${error.message}`)
      } else {
        inserted++
      }
    }

    return NextResponse.json({ ok: true, inserted, skipped, errors })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
