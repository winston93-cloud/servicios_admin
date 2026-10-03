export const NIVELES_TALLER = [
  { valor: 1, etiqueta: 'Maternal', corto: 'MAT' },
  { valor: 2, etiqueta: 'Kinder', corto: 'KIN' },
  { valor: 3, etiqueta: 'Primaria', corto: 'PRI' },
  { valor: 4, etiqueta: 'Secundaria', corto: 'SEC' },
] as const

export const DIAS_TALLER = [
  { valor: 1, etiqueta: 'Lunes', corto: 'L' },
  { valor: 2, etiqueta: 'Martes', corto: 'M' },
  { valor: 3, etiqueta: 'Miércoles', corto: 'X' },
  { valor: 4, etiqueta: 'Jueves', corto: 'J' },
  { valor: 5, etiqueta: 'Viernes', corto: 'V' },
  { valor: 6, etiqueta: 'Sábado', corto: 'S' },
] as const

export const COLORES_TALLER = [
  '#00e3fd',
  '#f5b942',
  '#ff6b8b',
  '#8b7bff',
  '#34d399',
  '#fb923c',
  '#60a5fa',
  '#e879f9',
] as const

export const CATEGORIAS_TALLER = ['Deportivo', 'Artístico', 'Concurso', 'Académico', 'Tecnológico'] as const

export type Taller = {
  id: number
  nombre: string
  grados: string | null
  categoria: string | null
  descripcion: string | null
  niveles: number[]
  color: string | null
  /** Cupo base; cada grupo lo hereda y puede ajustarlo en Programados. */
  cupo_min: number | null
  cupo_max: number | null
  activo: boolean
}

export type TallerMaestro = {
  id: number
  nombre: string
  apellido_paterno: string | null
  apellido_materno: string | null
  email: string | null
  celular: string | null
  especialidad: string | null
  niveles: number[]
  notas: string | null
  activo: boolean
}

export type TallerHorario = {
  id?: number
  dia: number
  /** HH:MM (24 h) */
  hora_inicio: string
  hora_fin: string
  /** Solo si ese día cambia respecto a `TallerAsignacion.lugar`. */
  lugar?: string | null
}

export type TallerAsignacion = {
  id: number
  taller_id: number
  maestro_id: number
  ciclo_escolar: number
  niveles: number[]
  lugar: string | null
  cupo: number | null
  cupo_min: number | null
  notas: string | null
  activo: boolean
  horarios: TallerHorario[]
  /** Alumnos con estado 'inscrito'. */
  inscritos: number
}

/* ───────────── Inscripciones de alumnos ───────────── */

export type AlumnoTaller = {
  alumno_id: number
  alumno_ref: number | null
  nombre: string
  nivel: number
  grado: number | null
  grupo: number | null
  /** Baja general o temporal del colegio: no cuenta en cupo ni sale en asistencia. */
  baja_colegio?: boolean
}

export type EstadoInscripcion = 'inscrito' | 'baja'

export type TallerInscripcion = {
  id: number
  asignacion_id: number
  alumno: AlumnoTaller
  estado: EstadoInscripcion
  notas: string | null
  fecha_alta: string
  fecha_baja: string | null
  motivo_baja: string | null
  registrado_por: string | null
}

/** Resultado de búsqueda de alumnos: incluye sus grupos inscritos del ciclo. */
export type AlumnoBusquedaTaller = AlumnoTaller & { asignaciones: number[] }

/** Grado en escala única: K1..K3 = -2..0, 1°..6° = 1..6, 7°..9° = 7..9. */
export function gradoGlobal(nivel: number, grado: number | null): number | null {
  if (grado == null) return null
  if (nivel === 1) return grado - 5
  if (nivel === 2) return grado - 3
  if (nivel === 3) return grado
  if (nivel === 4) return grado + 6
  return null
}

export function etiquetaGradoAlumno(a: Pick<AlumnoTaller, 'nivel' | 'grado' | 'grupo'>): string {
  const letra = a.grupo && a.grupo >= 1 && a.grupo <= 26 ? String.fromCharCode(64 + a.grupo) : ''
  let g = ''
  if (a.grado != null) {
    if (a.nivel === 1) g = `Maternal ${a.grado}`
    else if (a.nivel === 2) g = `K${a.grado}`
    else if (a.nivel === 4) g = `${a.grado + 6}°`
    else g = `${a.grado}°`
  }
  return [g, letra].filter(Boolean).join(' ') || etiquetaNivel(a.nivel)
}

/**
 * Grados que admite un taller según su texto libre («1° a 3°», «K1 y K2», «Primaria y 7° a 9°»).
 * null = no se pudo interpretar → no se restringe.
 */
export function gradosPermitidos(texto: string | null): Set<number> | null {
  const t = (texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (!t.trim()) return null
  const out = new Set<number>()
  const rango = (a: number, b: number) => {
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i)
  }
  if (/maternal/.test(t)) rango(-4, -3)
  if (/kinder/.test(t)) rango(-2, 0)
  if (/primaria/.test(t)) rango(1, 6)
  if (/secundaria/.test(t)) rango(7, 9)
  const items = [...t.matchAll(/k\s*(\d)|(\d+)\s*°?/g)].map((m) => ({
    valor: m[1] ? Number(m[1]) - 3 : Number(m[2]),
    ini: m.index ?? 0,
    fin: (m.index ?? 0) + m[0].length,
  }))
  for (let i = 0; i < items.length; i++) {
    const sig = items[i + 1]
    if (sig && /^\s*(a|al|-|–)\s*$/.test(t.slice(items[i].fin, sig.ini))) {
      rango(items[i].valor, sig.valor)
      i++
    } else {
      out.add(items[i].valor)
    }
  }
  return out.size ? out : null
}

export type EstadoCupo = 'lleno' | 'casi' | 'bajo' | 'ok' | 'libre'

/** lleno ≥ máx · casi ≥ 85 % del máx · bajo < mínimo · ok · libre (sin cupo definido). */
export function estadoCupo(a: Pick<TallerAsignacion, 'cupo' | 'cupo_min' | 'inscritos'>): EstadoCupo {
  if (a.cupo && a.inscritos >= a.cupo) return 'lleno'
  if (a.cupo_min && a.inscritos < a.cupo_min) return 'bajo'
  if (a.cupo && a.inscritos >= Math.ceil(a.cupo * 0.85)) return 'casi'
  return a.cupo || a.cupo_min ? 'ok' : 'libre'
}

export function textoCupo(a: Pick<TallerAsignacion, 'cupo' | 'cupo_min' | 'inscritos'>): string {
  const e = estadoCupo(a)
  if (e === 'lleno') return 'Cupo lleno'
  if (e === 'bajo') return `Faltan ${(a.cupo_min ?? 0) - a.inscritos} para el mínimo`
  if (a.cupo) return `${a.cupo - a.inscritos} lugares libres`
  return 'Sin cupo definido'
}

export function lugarDeHorario(a: Pick<TallerAsignacion, 'lugar'>, h: TallerHorario): string | null {
  const propio = (h.lugar ?? '').trim()
  return propio || (a.lugar ?? '').trim() || null
}

export function etiquetaCupo(a: Pick<TallerAsignacion, 'cupo' | 'cupo_min'>): string | null {
  if (a.cupo_min && a.cupo) return `${a.cupo_min} a ${a.cupo} alumnos`
  if (a.cupo) return `Máx. ${a.cupo}`
  if (a.cupo_min) return `Mín. ${a.cupo_min}`
  return null
}

export type TalleresSnapshot = {
  ciclo: { valor: number; nombre: string }
  talleres: Taller[]
  maestros: TallerMaestro[]
  asignaciones: TallerAsignacion[]
}

export function etiquetaNivel(n: number): string {
  return NIVELES_TALLER.find((x) => x.valor === n)?.etiqueta ?? `Nivel ${n}`
}

export function etiquetaDia(d: number): string {
  return DIAS_TALLER.find((x) => x.valor === d)?.etiqueta ?? `Día ${d}`
}

export function nombreMaestroTaller(m: Pick<TallerMaestro, 'nombre' | 'apellido_paterno' | 'apellido_materno'>): string {
  return [m.nombre, m.apellido_paterno, m.apellido_materno]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

export function nombreTallerCompleto(t: Pick<Taller, 'nombre' | 'grados'>): string {
  const g = (t.grados ?? '').trim()
  return g ? `${t.nombre} ${g}` : t.nombre
}

/** Normaliza lista de niveles: solo 1..4, sin duplicados, ordenada. */
export function normalizarNiveles(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const set = new Set<number>()
  for (const v of raw) {
    const n = Number(v)
    if (NIVELES_TALLER.some((x) => x.valor === n)) set.add(n)
  }
  return [...set].sort((a, b) => a - b)
}

/** "15:00:00" | "15:00" → "15:00"; inválido → null. */
export function normalizarHora(raw: unknown): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(raw ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function minutosDeHora(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** "15:00" → "3:00 PM" */
export function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const sufijo = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`
}

export function rangosSeTraslapan(a: TallerHorario, b: TallerHorario): boolean {
  if (a.dia !== b.dia) return false
  return minutosDeHora(a.hora_inicio) < minutosDeHora(b.hora_fin) &&
    minutosDeHora(b.hora_inicio) < minutosDeHora(a.hora_fin)
}

/** "Lunes 3:00 PM – 4:00 PM · Miércoles …" */
export function resumenHorarios(horarios: TallerHorario[]): string {
  return [...horarios]
    .sort((a, b) => a.dia - b.dia || minutosDeHora(a.hora_inicio) - minutosDeHora(b.hora_inicio))
    .map((h) => `${etiquetaDia(h.dia)} ${hora12(h.hora_inicio)} – ${hora12(h.hora_fin)}`)
    .join(' · ')
}

/* ───────────── Asistencia diaria ───────────── */

export type AlumnoAsistencia = {
  alumno_id: number
  nombre: string
  nivel: number
  grado: string
}

/** El maestro no asistió, o llegó tarde y/o salió antes de la hora del horario (HH:MM; null = a tiempo). */
export type IncidenciaMaestro = {
  falto: boolean
  llegada: string | null
  salida: string | null
  motivo: string | null
  nota: string | null
  registrado_por: string | null
  updated_at: string | null
}

export type RegistroAsistencia = {
  /** Alumnos contados en el salón (puede diferir de la lista). */
  total_alumnos: number | null
  faltas: number[]
  registrado_por: string | null
  updated_at: string
}

export const MOTIVOS_INCIDENCIA = ['Se retiró', 'Permiso de dirección', 'Emergencia', 'Otro'] as const

/** "15:35" con 5 → "15:40" */
export function horaMasMinutos(hhmm: string, minutos: number): string {
  const t = minutosDeHora(hhmm) + minutos
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Minutos que no se impartieron respecto al horario `inicio`–`fin`. */
export function minutosIncidencia(
  inicio: string,
  fin: string,
  inc: Pick<IncidenciaMaestro, 'falto' | 'llegada' | 'salida'> | null
): { tarde: number; antes: number } {
  if (!inc) return { tarde: 0, antes: 0 }
  if (inc.falto) return { tarde: Math.max(0, minutosDeHora(fin) - minutosDeHora(inicio)), antes: 0 }
  return {
    tarde: inc.llegada ? Math.max(0, minutosDeHora(inc.llegada) - minutosDeHora(inicio)) : 0,
    antes: inc.salida ? Math.max(0, minutosDeHora(fin) - minutosDeHora(inc.salida)) : 0,
  }
}

/** "No asistió" · "Llegó 3:10 PM (+10 min) · Salió 3:35 PM (−25 min)" */
export function textoIncidencia(inicio: string, fin: string, inc: IncidenciaMaestro | null): string {
  if (inc?.falto) return 'El maestro no asistió'
  if (!inc || (!inc.llegada && !inc.salida)) return ''
  const { tarde, antes } = minutosIncidencia(inicio, fin, inc)
  const partes: string[] = []
  if (inc.llegada) partes.push(`Llegó ${hora12(inc.llegada)} (+${tarde} min)`)
  if (inc.salida) partes.push(`Salió ${hora12(inc.salida)} (−${antes} min)`)
  return partes.join(' · ')
}

export type SesionAsistencia = {
  asignacion_id: number
  taller: string
  grados: string | null
  color: string
  maestro: string
  niveles: number[]
  hora_inicio: string
  hora_fin: string
  lugar: string | null
  alumnos: AlumnoAsistencia[]
  registro: RegistroAsistencia | null
  /** Se puede registrar aunque no se haya pasado lista. */
  incidencia: IncidenciaMaestro | null
}

export type AsistenciaDia = {
  ciclo: { valor: number; nombre: string }
  /** YYYY-MM-DD consultado. */
  fecha: string
  /** YYYY-MM-DD de hoy en Ciudad de México. */
  hoy: string
  /** 0 = domingo … 6 = sábado. */
  dia: number
  /** Se puede guardar: hoy y hasta DIAS_EDITABLES_ASISTENCIA atrás (días futuros, solo consulta). */
  editable: boolean
  sesiones: SesionAsistencia[]
}

export const DIAS_EDITABLES_ASISTENCIA = 30

/* ───────────── Reportes ───────────── */

export type SesionHoras = {
  fecha: string
  /** 1 = lunes … 6 = sábado. */
  dia: number
  /** null si ese día no tiene horario (la asistencia se guardó fuera de horario). */
  hora_inicio: string | null
  hora_fin: string | null
  minutos: number
  alumnos: number | null
  /** Llegó tarde / salió antes: informativo, no se descuenta de `minutos`. Si faltó, `minutos` = 0. */
  incidencia: IncidenciaMaestro | null
  minutos_no_impartidos: number
}

export type GrupoHoras = {
  asignacion_id: number
  /** Maestro que impartió (si el grupo cambió de maestro, cada uno tiene su propio GrupoHoras). */
  maestro_id: number
  taller: string
  color: string
  niveles: number[]
  minutos: number
  sesiones: SesionHoras[]
}

export type MaestroHoras = {
  maestro_id: number
  nombre: string
  minutos: number
  sesiones: number
  /** YYYY-MM-DD con al menos una clase registrada. */
  dias: string[]
  grupos: GrupoHoras[]
  /** Clases en que llegó tarde o salió antes (informativo). */
  incidencias: number
  minutos_no_impartidos: number
  /** Clases a las que no asistió (no suman horas). */
  faltas_maestro: number
}

export type ReporteHorasMaestros = {
  ciclo: { valor: number; nombre: string }
  nivel: number
  desde: string
  hasta: string
  maestros: MaestroHoras[]
  total_minutos: number
  total_sesiones: number
  /** Sesiones con asistencia en un día sin horario definido (no suman horas). */
  sin_horario: number
  total_incidencias: number
  total_minutos_no_impartidos: number
  total_faltas_maestro: number
}

export const MAX_DIAS_REPORTE = 400

/** 750 → "12 h 30 min" */
export function textoDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}
