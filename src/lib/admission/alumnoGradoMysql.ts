/**
 * Convierte `grade_level` de AgendaW al valor de `alumno_grado` en MySQL (winston_general.alumno).
 *
 * Secundaria (`alumno_nivel = 4`): en BD el grado es 1 = 7mo, 2 = 8vo, 3 = 9no
 * (no 7, 8, 9 como en las etiquetas secundaria_7, etc.).
 */

const SECUNDARIA_GRADE_LEVEL_A_MYSQL: Record<string, string> = {
  secundaria_7: '1',
  secundaria_8: '2',
  secundaria_9: '3',
}

export function alumnoGradoParaMySQL(level: string, gradeLevel: string | null | undefined): string {
  const raw = String(gradeLevel ?? '').trim()
  if (!raw) return '1'

  if (level === 'secundaria') {
    const porClave = SECUNDARIA_GRADE_LEVEL_A_MYSQL[raw]
    if (porClave) return porClave
    const ultimoNumero = raw.match(/(\d+)$/)?.[1]
    if (ultimoNumero === '7') return '1'
    if (ultimoNumero === '8') return '2'
    if (ultimoNumero === '9') return '3'
    if (ultimoNumero === '1' || ultimoNumero === '2' || ultimoNumero === '3') return ultimoNumero
    return '1'
  }

  const gradeMatch = raw.match(/(\d+)$/)
  const gradeLetter = raw.match(/_([ab])$/i)
  if (gradeMatch) return gradeMatch[1]
  if (gradeLetter) return gradeLetter[1].toUpperCase() === 'A' ? '1' : '2'
  return '1'
}
