/**
 * Niveles que comparten psicóloga y no pueden tener cita el mismo día a la misma hora.
 * maternal_kinder es el identificador de horarios en admission_schedules.
 */
export function bookingConflictLevels(level: string): string[] {
  if (level === 'maternal' || level === 'kinder' || level === 'maternal_kinder') {
    return ['maternal', 'kinder']
  }
  if (level === 'primaria') return ['primaria']
  if (level === 'secundaria') return ['secundaria']
  return [level]
}

/** Nivel usado en admission_permission_requests */
export function permissionRequestLevel(level: string): 'maternal_kinder' | 'primaria' | 'secundaria' | null {
  if (level === 'maternal' || level === 'kinder' || level === 'maternal_kinder') return 'maternal_kinder'
  if (level === 'primaria') return 'primaria'
  if (level === 'secundaria') return 'secundaria'
  return null
}

/** Formato uniforme HH:MM para comparar horarios (legacy 9.00 → 09:00) */
export function normalizeAppointmentTime(time: string): string {
  if (!time || time === 'Por confirmar') return time
  let normalized = time.trim().replace('.', ':')
  if (/^\d:\d{2}$/.test(normalized)) normalized = '0' + normalized
  if (/^\d{1,2}$/.test(normalized)) normalized = normalized.padStart(2, '0') + ':00'
  return normalized
}
